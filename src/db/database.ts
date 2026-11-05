import Dexie, { type Table } from 'dexie';
import type { Policy, Customer, Reminder, ImportHistory, AuditLog } from '@/types';

export interface SettingItem {
  key: string;
  value: unknown;
  updatedAt: string;
}

export class LICDatabase extends Dexie {
  policies!: Table<Policy, string>;
  customers!: Table<Customer, string>;
  reminders!: Table<Reminder, string>;
  importHistory!: Table<ImportHistory, string>;
  auditLogs!: Table<AuditLog, string>;
  appSettings!: Table<SettingItem, string>;

  constructor(dbName = 'LICAgentCompanionDB') {
    super(dbName);

    // Version 1: Initial schema
    this.version(1).stores({
      policies: 'id, policyNumber, customerId, customerName, planCode, commencementDate, firstUnpaidPremiumDate, maturityDate, recordStatus, updatedAt',
      customers: 'id, displayName, normalizedName, mobileNumber, updatedAt',
      reminders: 'id, customerId, policyId, dueDate, status, reminderType, priority, updatedAt',
      importHistory: 'id, importDate, filename',
      auditLogs: 'id, entityType, entityId, action, timestamp',
      appSettings: 'key',
    });

    // Version 2: Enhanced indexes for multi-field fast search & compound lookups
    this.version(2).stores({
      policies: 'id, policyNumber, customerId, customerName, planCode, commencementDate, firstUnpaidPremiumDate, maturityDate, recordStatus, updatedAt, [customerId+recordStatus]',
      customers: 'id, displayName, normalizedName, mobileNumber, updatedAt',
      reminders: 'id, customerId, policyId, dueDate, status, reminderType, priority, updatedAt, [status+dueDate]',
      importHistory: 'id, importDate, filename',
      auditLogs: 'id, entityType, entityId, action, timestamp',
      appSettings: 'key',
    });

    // Version 3: Compound index on auditLogs for fast deletion and sync lookups
    this.version(3).stores({
      auditLogs: 'id, entityType, entityId, action, timestamp, [entityType+action]',
    });
  }
}

// Multi-tenant database cache per Agency Code
const dbInstances = new Map<string, LICDatabase>();

export function getActiveAgencyCode(): string | null {
  if (typeof window === 'undefined') return null;
  const code =
    sessionStorage.getItem('lic_active_agency_code') ||
    localStorage.getItem('lic_active_agency_code') ||
    localStorage.getItem('lic_last_agency_code') ||
    null;
  if (code && !sessionStorage.getItem('lic_active_agency_code')) {
    try {
      sessionStorage.setItem('lic_active_agency_code', code);
    } catch {}
  }
  return code;
}

export function getActiveDbName(): string {
  const code = getActiveAgencyCode();
  if (code && code.trim()) {
    return `LICAgentCompanionDB_${code.trim().toUpperCase()}`;
  }
  return 'LICAgentCompanionDB';
}

/**
 * Access the legacy single-tenant database ('LICAgentCompanionDB')
 * used before multi-tenant agency partitioning.
 */
export function getLegacyDatabase(): LICDatabase {
  const name = 'LICAgentCompanionDB';
  if (!dbInstances.has(name)) {
    dbInstances.set(name, new LICDatabase(name));
  }
  return dbInstances.get(name)!;
}

export function getDatabase(agencyCode?: string): LICDatabase {
  const name = agencyCode && agencyCode.trim()
    ? `LICAgentCompanionDB_${agencyCode.trim().toUpperCase()}`
    : getActiveDbName();

  if (!dbInstances.has(name)) {
    dbInstances.set(name, new LICDatabase(name));
  }
  return dbInstances.get(name)!;
}

export function switchAgentDatabase(agencyCode: string): LICDatabase {
  const sanitized = agencyCode.trim().toUpperCase();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('lic_active_agency_code', sanitized);
    localStorage.setItem('lic_active_agency_code', sanitized);
    localStorage.setItem('lic_last_agency_code', sanitized);
  }
  return getDatabase(sanitized);
}

/**
 * Automatically synchronizes policies and customer records across database
 * instances so the user always sees the exact same data everywhere without clicking buttons.
 */
let lastSyncCheckTime = 0;
export async function ensureDataSynchronized(force = false): Promise<void> {
  const now = Date.now();
  if (!force && (now - lastSyncCheckTime < 3000 || typeof window === 'undefined')) return;
  lastSyncCheckTime = now;
  try {
    const active = getDatabase();
    const legacy = getLegacyDatabase();
    if (active.name === legacy.name) return;

    const [activeCount, legacyCount] = await Promise.all([
      active.policies.count(),
      legacy.policies.count(),
    ]);

    if (activeCount === 0 && legacyCount > 0) {
      const [policies, customers, reminders, auditLogs] = await Promise.all([
        legacy.policies.toArray(),
        legacy.customers.toArray(),
        legacy.reminders.toArray(),
        legacy.auditLogs.toArray(),
      ]);
      await active.transaction('rw', [active.policies, active.customers, active.reminders, active.auditLogs], async () => {
        await active.policies.bulkPut(policies);
        await active.customers.bulkPut(customers);
        await active.reminders.bulkPut(reminders);
        await active.auditLogs.bulkPut(auditLogs);
      });
    } else if (legacyCount === 0 && activeCount > 0) {
      const [policies, customers, reminders, auditLogs] = await Promise.all([
        active.policies.toArray(),
        active.customers.toArray(),
        active.reminders.toArray(),
        active.auditLogs.toArray(),
      ]);
      await legacy.transaction('rw', [legacy.policies, legacy.customers, legacy.reminders, legacy.auditLogs], async () => {
        await legacy.policies.bulkPut(policies);
        await legacy.customers.bulkPut(customers);
        await legacy.reminders.bulkPut(reminders);
        await legacy.auditLogs.bulkPut(auditLogs);
      });
    } else if (activeCount > 0 && legacyCount > 0 && activeCount !== legacyCount) {
      // Reconcile records between active agent DB and legacy DB: whichever has more policies updates the other
      const [activeList, legacyList] = await Promise.all([
        active.policies.toArray(),
        legacy.policies.toArray(),
      ]);
      if (activeList.length >= legacyList.length) {
        await legacy.policies.bulkPut(activeList);
      } else {
        await active.policies.bulkPut(legacyList);
      }
    }
  } catch (err) {
    console.warn('Auto data sync notice:', err);
  }
}

/**
 * Proxy export for transparent backward compatibility.
 * All repositories (`db.policies`, `db.customers`, `db.transaction`, etc.)
 * dynamically access the database of the currently authenticated agent.
 */
export const db = new Proxy({} as LICDatabase, {
  get(_target, prop) {
    const active = getDatabase();
    const val = (active as any)[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  },
});
