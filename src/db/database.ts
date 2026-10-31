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
  }
}

// Multi-tenant database cache per Agency Code
const dbInstances = new Map<string, LICDatabase>();

export function getActiveAgencyCode(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('lic_active_agency_code') || localStorage.getItem('lic_active_agency_code') || null;
}

export function getActiveDbName(): string {
  const code = getActiveAgencyCode();
  if (code && code.trim()) {
    return `LICAgentCompanionDB_${code.trim().toUpperCase()}`;
  }
  return 'LICAgentCompanionDB';
}

export function getDatabase(agencyCode?: string): LICDatabase {
  const name = agencyCode
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
  }
  return getDatabase(sanitized);
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
