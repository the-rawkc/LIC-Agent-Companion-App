import { db } from '../database';
import type { Policy, PolicyRecordStatus } from '@/types';
import { normalizeSearchString, advanceFupDate, generateUUID } from '@/utils/formatters';
import { d1SyncService } from '@/services/cloud/d1SyncService';

export interface PolicyFilterOptions {
  planCode?: string;
  premiumMode?: string;
  recordStatus?: PolicyRecordStatus;
  commencementYear?: string;
  maturityYear?: string;
  fupMonth?: string; // e.g. "2026-11"
  fupDateFrom?: string; // YYYY-MM-DD
  fupDateTo?: string; // YYYY-MM-DD
  hasWarnings?: boolean;
  sortBy?: 'serial_asc' | 'doc_desc' | 'doc_asc' | 'fup_asc' | 'fup_desc' | 'premium_desc' | 'policy_asc' | 'name_asc';
}

export const policyRepository = {
  async getAll(): Promise<Policy[]> {
    const list = await db.policies.toArray();
    return list.sort((a, b) => {
      const sA = a.sourceSerialNumber ?? 9999999;
      const sB = b.sourceSerialNumber ?? 9999999;
      if (sA !== sB) return sA - sB;
      return (b.commencementDate || '').localeCompare(a.commencementDate || '');
    });
  },

  async getById(id: string): Promise<Policy | undefined> {
    return await db.policies.get(id);
  },

  async getByPolicyNumber(policyNumber: string): Promise<Policy | undefined> {
    return await db.policies.where('policyNumber').equals(policyNumber.trim()).first();
  },

  async getByCustomerId(customerId: string): Promise<Policy[]> {
    return await db.policies.where('customerId').equals(customerId).toArray();
  },

  async create(policy: Policy): Promise<string> {
    await db.policies.add(policy);
    await db.auditLogs.add({
      id: generateUUID(),
      entityType: 'policy',
      entityId: policy.id,
      action: 'create',
      timestamp: new Date().toISOString(),
      summary: `Created policy ${policy.policyNumber} for customer ${policy.customerName}`,
    });
    d1SyncService.triggerAutoSync();
    return policy.id;
  },

  async update(id: string, updates: Partial<Policy>): Promise<void> {
    const existing = await db.policies.get(id);
    if (!existing) throw new Error(`Policy with ID ${id} not found.`);

    const now = new Date().toISOString();
    const updatedPolicy: Policy = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await db.policies.put(updatedPolicy);

    await db.auditLogs.add({
      id: generateUUID(),
      entityType: 'policy',
      entityId: id,
      action: 'update',
      timestamp: now,
      summary: `Updated policy ${existing.policyNumber}`,
      changedFields: Object.keys(updates).reduce((acc, key) => {
        const k = key as keyof Policy;
        if (existing[k] !== updates[k]) {
          acc[key] = { old: existing[k], new: updates[k] };
        }
        return acc;
      }, {} as Record<string, { old: unknown; new: unknown }>),
    });
    d1SyncService.triggerAutoSync();
  },

  async delete(id: string): Promise<void> {
    const existing = await db.policies.get(id);
    if (existing) {
      await db.policies.delete(id);
      await db.reminders.where('policyId').equals(id).delete();
      await db.auditLogs.add({
        id: generateUUID(),
        entityType: 'policy',
        entityId: id,
        action: 'delete',
        timestamp: new Date().toISOString(),
        summary: `Deleted policy ${existing.policyNumber}`,
      });
      d1SyncService.triggerAutoSync();
    }
  },

  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    let deletedCount = 0;
    for (const id of ids) {
      const existing = await db.policies.get(id);
      if (existing) {
        await db.policies.delete(id);
        await db.reminders.where('policyId').equals(id).delete();
        await db.auditLogs.add({
          id: generateUUID(),
          entityType: 'policy',
          entityId: id,
          action: 'delete',
          timestamp: new Date().toISOString(),
          summary: `Deleted policy ${existing.policyNumber}`,
        });
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      d1SyncService.triggerAutoSync();
    }
    return deletedCount;
  },

  /**
   * Record a premium payment: automatically advances F.U.P. date based on mode and logs audit history
   */
  async recordPayment(id: string): Promise<{ policy: Policy; oldFup: string; newFup: string }> {
    const existing = await db.policies.get(id);
    if (!existing) throw new Error(`Policy with ID ${id} not found.`);

    const oldFup = existing.firstUnpaidPremiumDate || existing.commencementDate;
    const newFup = advanceFupDate(oldFup, existing.premiumMode);
    const now = new Date().toISOString();

    const updated: Policy = {
      ...existing,
      firstUnpaidPremiumDate: newFup,
      recordStatus: 'active',
      updatedAt: now,
    };

    await db.policies.put(updated);

    await db.auditLogs.add({
      id: generateUUID(),
      entityType: 'policy',
      entityId: id,
      action: 'update',
      timestamp: now,
      summary: `Recorded premium payment for Policy ${existing.policyNumber}. FUP updated from ${oldFup} to ${newFup} (${existing.premiumMode}).`,
      changedFields: {
        firstUnpaidPremiumDate: { old: oldFup, new: newFup },
        recordStatus: { old: existing.recordStatus, new: 'active' },
      },
    });
    d1SyncService.triggerAutoSync();

    return { policy: updated, oldFup, newFup };
  },

  async search(query: string, filters?: PolicyFilterOptions): Promise<Policy[]> {
    let collection = await db.policies.toArray();

    if (query.trim()) {
      const q = normalizeSearchString(query);
      collection = collection.filter((p) => {
        const pNum = p.policyNumber.toLowerCase();
        const pName = normalizeSearchString(p.customerName);
        const pPlan = p.planCode.toLowerCase();
        return pNum.includes(q) || pName.includes(q) || pPlan.includes(q);
      });
    }

    if (filters) {
      if (filters.planCode) {
        collection = collection.filter((p) => p.planCode === filters.planCode);
      }
      if (filters.premiumMode) {
        collection = collection.filter((p) => p.premiumMode.toLowerCase() === filters.premiumMode?.toLowerCase());
      }
      if (filters.recordStatus) {
        collection = collection.filter((p) => p.recordStatus === filters.recordStatus);
      }
      if (filters.commencementYear) {
        collection = collection.filter((p) => p.commencementDate.startsWith(filters.commencementYear!));
      }
      if (filters.maturityYear) {
        collection = collection.filter((p) => p.maturityDate.startsWith(filters.maturityYear!));
      }
      if (filters.fupMonth) {
        collection = collection.filter((p) => (p.firstUnpaidPremiumDate || '').startsWith(filters.fupMonth!));
      }
      if (filters.fupDateFrom) {
        collection = collection.filter((p) => (p.firstUnpaidPremiumDate || '') >= filters.fupDateFrom!);
      }
      if (filters.fupDateTo) {
        collection = collection.filter((p) => (p.firstUnpaidPremiumDate || '') <= filters.fupDateTo!);
      }
      if (filters.hasWarnings !== undefined) {
        collection = collection.filter((p) => 
          filters.hasWarnings ? p.extractionWarnings.length > 0 : p.extractionWarnings.length === 0
        );
      }
    }

    // Default sorting: Preserves exact original Excel/report row order (sourceSerialNumber: 1, 2, 3...)
    const sortBy = filters?.sortBy || 'serial_asc';
    collection.sort((a, b) => {
      if (sortBy === 'serial_asc') {
        const sA = a.sourceSerialNumber ?? 9999999;
        const sB = b.sourceSerialNumber ?? 9999999;
        if (sA !== sB) return sA - sB;
        return (b.commencementDate || '').localeCompare(a.commencementDate || '');
      }
      if (sortBy === 'doc_desc') {
        return (b.commencementDate || '').localeCompare(a.commencementDate || '');
      }
      if (sortBy === 'doc_asc') {
        return (a.commencementDate || '').localeCompare(b.commencementDate || '');
      }
      if (sortBy === 'fup_asc') {
        return (a.firstUnpaidPremiumDate || '').localeCompare(b.firstUnpaidPremiumDate || '');
      }
      if (sortBy === 'fup_desc') {
        return (b.firstUnpaidPremiumDate || '').localeCompare(a.firstUnpaidPremiumDate || '');
      }
      if (sortBy === 'premium_desc') {
        return (b.premiumAmount || 0) - (a.premiumAmount || 0);
      }
      if (sortBy === 'policy_asc') {
        return a.policyNumber.localeCompare(b.policyNumber);
      }
      if (sortBy === 'name_asc') {
        return (a.customerName || '').localeCompare(b.customerName || '');
      }
      const sA = a.sourceSerialNumber ?? 9999999;
      const sB = b.sourceSerialNumber ?? 9999999;
      return sA - sB;
    });

    return collection;
  },

  async getCounts() {
    const total = await db.policies.count();
    const active = await db.policies.where('recordStatus').equals('active').count();
    const needsVerification = await db.policies.where('recordStatus').equals('needs_verification').count();
    return { total, active, needsVerification };
  }
};
