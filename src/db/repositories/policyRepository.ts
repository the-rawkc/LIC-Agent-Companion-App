import { db, getLegacyDatabase } from '../database';
import type { Policy, PolicyRecordStatus } from '@/types';
import { normalizeSearchString, advanceFupDate, generateUUID, parseDateToISO } from '@/utils/formatters';
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
      const customerId = existing.customerId;
      await db.policies.delete(id);
      await db.reminders.where('policyId').equals(id).delete();
      let legacyDb: any = null;
      try {
        const legacy = getLegacyDatabase();
        if (legacy.name !== db.name) legacyDb = legacy;
      } catch {}

      if (legacyDb) {
        try {
          await legacyDb.policies.delete(id);
          await legacyDb.reminders.where('policyId').equals(id).delete();
        } catch {}
      }

      await db.auditLogs.add({
        id: generateUUID(),
        entityType: 'policy',
        entityId: id,
        action: 'delete',
        timestamp: new Date().toISOString(),
        summary: `Deleted policy ${existing.policyNumber}`,
      });

      // When the policy is deleted, if its customer now has 0 policies, delete the customer too
      if (customerId) {
        const remainingCount = await db.policies.where('customerId').equals(customerId).count();
        if (remainingCount === 0) {
          const cust = await db.customers.get(customerId);
          await db.customers.delete(customerId);
          if (legacyDb) {
            try {
              await legacyDb.customers.delete(customerId);
            } catch {}
          }
          await db.auditLogs.add({
            id: generateUUID(),
            entityType: 'customer',
            entityId: customerId,
            action: 'delete',
            timestamp: new Date().toISOString(),
            summary: `Deleted customer "${cust?.displayName || customerId}" because all associated policies were deleted`,
          });
        }
      }

      d1SyncService.triggerAutoSync();
    }
  },

  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    let deletedCount = 0;
    let legacyDb: any = null;
    try {
      const leg = getLegacyDatabase();
      if (leg.name !== db.name) legacyDb = leg;
    } catch {}

    const affectedCustomerIds = new Set<string>();

    for (const id of ids) {
      const existing = await db.policies.get(id);
      if (existing) {
        if (existing.customerId) affectedCustomerIds.add(existing.customerId);
        await db.policies.delete(id);
        await db.reminders.where('policyId').equals(id).delete();
        if (legacyDb) {
          try {
            await legacyDb.policies.delete(id);
            await legacyDb.reminders.where('policyId').equals(id).delete();
          } catch {}
        }
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

    // Clean up any affected customers who now have 0 remaining policies
    for (const custId of affectedCustomerIds) {
      const remainingCount = await db.policies.where('customerId').equals(custId).count();
      if (remainingCount === 0) {
        const cust = await db.customers.get(custId);
        await db.customers.delete(custId);
        if (legacyDb) {
          try {
            await legacyDb.customers.delete(custId);
          } catch {}
        }
        await db.auditLogs.add({
          id: generateUUID(),
          entityType: 'customer',
          entityId: custId,
          action: 'delete',
          timestamp: new Date().toISOString(),
          summary: `Deleted customer "${cust?.displayName || custId}" because all associated policies were deleted`,
        });
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
          filters.hasWarnings
            ? Boolean(p.extractionWarnings && p.extractionWarnings.length > 0)
            : Boolean(!p.extractionWarnings || p.extractionWarnings.length === 0)
        );
      }
    }

    // Default sorting: Descending by DOC (Date of Commencement) - latest/newest comes first
    const sortBy = filters?.sortBy || 'doc_desc';
    collection.sort((a, b) => {
      if (sortBy === 'doc_desc') {
        const dateA = parseDateToISO(a.commencementDate) || a.commencementDate || '';
        const dateB = parseDateToISO(b.commencementDate) || b.commencementDate || '';
        const cmp = dateB.localeCompare(dateA);
        if (cmp !== 0) return cmp;
        const crA = a.createdAt || '';
        const crB = b.createdAt || '';
        return crB.localeCompare(crA);
      }
      if (sortBy === 'doc_asc') {
        const dateA = parseDateToISO(a.commencementDate) || a.commencementDate || '';
        const dateB = parseDateToISO(b.commencementDate) || b.commencementDate || '';
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return cmp;
        return (a.policyNumber || '').localeCompare(b.policyNumber || '');
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
