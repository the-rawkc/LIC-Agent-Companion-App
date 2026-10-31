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

  constructor() {
    super('LICAgentCompanionDB');

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

export const db = new LICDatabase();
