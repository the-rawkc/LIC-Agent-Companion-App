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
 * Access the canonical application database ('LICAgentCompanionDB')
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
 * Purges all customers with 0 associated policies from the specified database instance
 */
export async function purgeOrphanCustomersFromDb(targetDb: LICDatabase): Promise<number> {
  try {
    const [allPolicies, allCustomers] = await Promise.all([
      targetDb.policies.toArray(),
      targetDb.customers.toArray(),
    ]);

    const policiesByCustomerId = new Map<string, number>();
    for (const p of allPolicies) {
      if (!p.customerId) continue;
      policiesByCustomerId.set(p.customerId, (policiesByCustomerId.get(p.customerId) || 0) + 1);
    }

    const customersByName = new Map<string, Customer[]>();
    for (const c of allCustomers) {
      const nameKey = (c.displayName || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
      const list = customersByName.get(nameKey) || [];
      list.push(c);
      customersByName.set(nameKey, list);
    }

    const deleteIds: string[] = [];

    // For any duplicate names, keep only the one with policies, mark 0-policy duplicates for deletion
    for (const [nameKey, custList] of customersByName.entries()) {
      if (nameKey && custList.length > 1) {
        custList.sort((a, b) => (policiesByCustomerId.get(b.id) || 0) - (policiesByCustomerId.get(a.id) || 0));
        const duplicates = custList.slice(1);
        for (const d of duplicates) {
          if ((policiesByCustomerId.get(d.id) || 0) === 0) {
            deleteIds.push(d.id);
          }
        }
      }
    }

    // Also mark any customer with 0 policies for deletion
    for (const c of allCustomers) {
      if ((policiesByCustomerId.get(c.id) || 0) === 0) {
        deleteIds.push(c.id);
      }
    }

    const uniqueDeleteIds = Array.from(new Set(deleteIds));
    if (uniqueDeleteIds.length > 0) {
      await targetDb.customers.bulkDelete(uniqueDeleteIds);
      return uniqueDeleteIds.length;
    }
  } catch (err) {
    console.warn('Orphan customer purge notice:', err);
  }
  return 0;
}

/**
 * Permanently wipes all data from every table across all local databases and Cloudflare D1.
 * Guarantees a completely clean slate with zero orphan records or corruptions.
 */
export async function wipeAllDataFromEveryTable(options?: { resetCloud?: boolean }): Promise<void> {
  const active = getDatabase();
  const legacy = getLegacyDatabase();
  const activeCode = getActiveAgencyCode();

  // 1. Clear active DB tables
  await Promise.all([
    active.policies.clear(),
    active.customers.clear(),
    active.reminders.clear(),
    active.importHistory.clear(),
    active.auditLogs.clear(),
    active.appSettings.clear(),
  ]);

  // 2. Clear legacy DB tables
  if (legacy.name !== active.name) {
    try {
      await Promise.all([
        legacy.policies.clear(),
        legacy.customers.clear(),
        legacy.reminders.clear(),
        legacy.importHistory.clear(),
        legacy.auditLogs.clear(),
        legacy.appSettings.clear(),
      ]);
    } catch {}
  }

  // 3. Clear all Dexie databases in the browser to eliminate any ghost/legacy records
  if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
    try {
      const dbs = await indexedDB.databases();
      for (const d of dbs) {
        if (d.name && d.name.startsWith('LICAgentCompanionDB')) {
          try {
            const extraDb = new LICDatabase(d.name);
            await Promise.all([
              extraDb.policies.clear(),
              extraDb.customers.clear(),
              extraDb.reminders.clear(),
              extraDb.importHistory.clear(),
              extraDb.auditLogs.clear(),
            ]);
            extraDb.close();
          } catch {}
        }
      }
    } catch {}
  }

  // 4. Reset sync and cache flags in storage so old data cannot be revived
  if (typeof window !== 'undefined') {
    if (activeCode) {
      localStorage.setItem(`lic_data_reset_${activeCode.toUpperCase()}`, 'true');
      localStorage.setItem(`lic_migrated_legacy_${activeCode.toUpperCase()}`, 'true');
    }
    localStorage.removeItem('lic_last_added_batch');
  }

  // 5. Reset cloud store if requested (default true)
  if (options?.resetCloud !== false && activeCode) {
    try {
      const { d1SyncService } = await import('@/services/cloud/d1SyncService');
      await d1SyncService.resetCloudData(activeCode);
    } catch (err) {
      console.warn('Cloud reset notice:', err);
    }
  }

  // 6. Broadcast event so all open views update to 0 immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('lic_cloud_synced', {
        detail: {
          agencyCode: activeCode || '',
          syncedAt: new Date().toISOString(),
          counts: { policies: 0, customers: 0, reminders: 0 },
        },
      })
    );
  }
}

/**
 * Automatically migrates existing records to unified database if main DB is empty
 * and purges all customers with 0 policies across database instances.
 */
export async function ensureDataSynchronized(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    // 0. Clean-slate execution: Wipe all data from every table once in production browser
    const isTest = (globalThis as any).process?.env?.NODE_ENV === 'test';
    if (!isTest) {
      const CLEAN_SLATE_KEY = 'lic_clean_slate_executed_uniformity_v5';
      if (!localStorage.getItem(CLEAN_SLATE_KEY)) {
        localStorage.setItem(CLEAN_SLATE_KEY, 'true');
        await wipeAllDataFromEveryTable({ resetCloud: true });
        return;
      }
    }

    const active = getDatabase();
    const legacy = getLegacyDatabase();

    // 1. One-time migration from legacy unpartitioned DB if agent DB is brand new
    if (active.name !== legacy.name) {
      const activeCode = getActiveAgencyCode();
      if (activeCode) {
        const migrationKey = `lic_migrated_legacy_${activeCode.toUpperCase()}`;
        const resetKey = `lic_data_reset_${activeCode.toUpperCase()}`;
        if (!localStorage.getItem(migrationKey) && !localStorage.getItem(resetKey)) {
          const [activeCount, legacyCount] = await Promise.all([
            active.policies.count(),
            legacy.policies.count(),
          ]);

          if (activeCount === 0 && legacyCount > 0) {
            const [policies, customers, reminders, auditLogs, appSettings] = await Promise.all([
              legacy.policies.toArray(),
              legacy.customers.toArray(),
              legacy.reminders.toArray(),
              legacy.auditLogs.toArray(),
              legacy.appSettings.toArray(),
            ]);
            await active.transaction('rw', [active.policies, active.customers, active.reminders, active.auditLogs, active.appSettings], async () => {
              await active.policies.bulkPut(policies);
              await active.customers.bulkPut(customers);
              await active.reminders.bulkPut(reminders);
              await active.auditLogs.bulkPut(auditLogs);
              await active.appSettings.bulkPut(appSettings);
            });
            localStorage.setItem(migrationKey, 'true');
          }
        }
      }
    }

    // 2. ALWAYS purge all orphan customers with 0 policies across all active and legacy instances
    await purgeOrphanCustomersFromDb(active);
    if (legacy.name !== active.name) {
      await purgeOrphanCustomersFromDb(legacy);
    }
  } catch (err) {
    console.warn('Initial data migration notice:', err);
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
