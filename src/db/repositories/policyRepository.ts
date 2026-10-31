import { db } from '../database';
import type { Policy, PolicyRecordStatus } from '@/types';
import { normalizeSearchString } from '@/utils/formatters';

export interface PolicyFilterOptions {
  planCode?: string;
  premiumMode?: string;
  recordStatus?: PolicyRecordStatus;
  commencementYear?: string;
  maturityYear?: string;
  hasWarnings?: boolean;
}

export const policyRepository = {
  async getAll(): Promise<Policy[]> {
    return await db.policies.toArray();
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
      id: crypto.randomUUID(),
      entityType: 'policy',
      entityId: policy.id,
      action: 'create',
      timestamp: new Date().toISOString(),
      summary: `Created policy ${policy.policyNumber} for customer ${policy.customerName}`,
    });
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
      id: crypto.randomUUID(),
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
  },

  async delete(id: string): Promise<void> {
    const existing = await db.policies.get(id);
    if (existing) {
      await db.policies.delete(id);
      await db.auditLogs.add({
        id: crypto.randomUUID(),
        entityType: 'policy',
        entityId: id,
        action: 'delete',
        timestamp: new Date().toISOString(),
        summary: `Deleted policy ${existing.policyNumber}`,
      });
    }
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
      if (filters.hasWarnings !== undefined) {
        collection = collection.filter((p) => 
          filters.hasWarnings ? p.extractionWarnings.length > 0 : p.extractionWarnings.length === 0
        );
      }
    }

    return collection;
  },

  async getCounts() {
    const total = await db.policies.count();
    const active = await db.policies.where('recordStatus').equals('active').count();
    const needsVerification = await db.policies.where('recordStatus').equals('needs_verification').count();
    return { total, active, needsVerification };
  }
};
