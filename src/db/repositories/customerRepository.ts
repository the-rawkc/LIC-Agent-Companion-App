import { db, getLegacyDatabase } from '../database';
import type { Customer, Policy } from '@/types';
import { normalizeSearchString, generateUUID } from '@/utils/formatters';
import { d1SyncService } from '@/services/cloud/d1SyncService';

export interface CustomerWithSummary extends Customer {
  policyCount: number;
  totalSumAssured: number;
  totalRecordedPremium: number;
  policies: Policy[];
  nextUpcomingDate?: string | null;
}

export const customerRepository = {
  async getAll(): Promise<Customer[]> {
    return await db.customers.toArray();
  },

  async getById(id: string): Promise<Customer | undefined> {
    return await db.customers.get(id);
  },

  async findByNormalizedName(name: string): Promise<Customer | undefined> {
    const norm = normalizeSearchString(name);
    return await db.customers.where('normalizedName').equals(norm).first();
  },

  async getWithSummary(id: string): Promise<CustomerWithSummary | undefined> {
    const customer = await db.customers.get(id);
    if (!customer) return undefined;

    const policies = await db.policies.where('customerId').equals(id).toArray();
    const policyCount = policies.length;
    const totalSumAssured = policies.reduce((sum, p) => sum + p.sumAssured, 0);
    const totalRecordedPremium = policies.reduce((sum, p) => sum + p.premiumAmount, 0);

    // Find next upcoming date requiring attention (either FUP or maturity)
    const upcomingDates = policies
      .flatMap((p) => [p.verifiedNextPremiumDate || p.firstUnpaidPremiumDate, p.maturityDate])
      .filter((d): d is string => Boolean(d))
      .sort();

    return {
      ...customer,
      policyCount,
      totalSumAssured,
      totalRecordedPremium,
      policies,
      nextUpcomingDate: upcomingDates[0] || null,
    };
  },

  async getAllWithSummary(): Promise<CustomerWithSummary[]> {
    const [customers, policies] = await Promise.all([
      db.customers.toArray(),
      db.policies.toArray(),
    ]);

    const policiesByCustomer = new Map<string, Policy[]>();
    for (const p of policies) {
      const list = policiesByCustomer.get(p.customerId) || [];
      list.push(p);
      policiesByCustomer.set(p.customerId, list);
    }

    // Automatically purge any orphan customers with 0 policies
    const orphanCustomers = customers.filter((c) => {
      const pList = policiesByCustomer.get(c.id);
      return !pList || pList.length === 0;
    });

    if (orphanCustomers.length > 0) {
      const orphanIds = orphanCustomers.map((c) => c.id);
      db.customers.bulkDelete(orphanIds).catch(() => {});
      try {
        const legacy = getLegacyDatabase();
        if (legacy.name !== db.name) {
          legacy.customers.bulkDelete(orphanIds).catch(() => {});
        }
      } catch {}
    }

    const activeCustomers = customers.filter((c) => {
      const pList = policiesByCustomer.get(c.id);
      return Boolean(pList && pList.length > 0);
    });

    return activeCustomers.map((c) => {
      const cPolicies = policiesByCustomer.get(c.id) || [];
      const totalSumAssured = cPolicies.reduce((sum, p) => sum + p.sumAssured, 0);
      const totalRecordedPremium = cPolicies.reduce((sum, p) => sum + p.premiumAmount, 0);
      
      const upcomingDates = cPolicies
        .flatMap((p) => [p.verifiedNextPremiumDate || p.firstUnpaidPremiumDate, p.maturityDate])
        .filter((d): d is string => Boolean(d))
        .sort();

      return {
        ...c,
        policyCount: cPolicies.length,
        totalSumAssured,
        totalRecordedPremium,
        policies: cPolicies,
        nextUpcomingDate: upcomingDates[0] || null,
      };
    });
  },

  /**
   * Automatically deletes all customers who have 0 associated policies
   */
  async cleanupOrphanCustomers(options?: { forceAll?: boolean }): Promise<number> {
    const [allCustomers, allPolicies] = await Promise.all([
      db.customers.toArray(),
      db.policies.toArray(),
    ]);

    const activeCustomerIds = new Set(allPolicies.map((p) => p.customerId).filter(Boolean));
    const nowMs = Date.now();
    const GRACE_PERIOD_MS = 60 * 1000; // 60 seconds grace period for brand new customers unless forceAll

    const orphanCustomers = allCustomers.filter((c) => {
      if (activeCustomerIds.has(c.id)) return false;
      if (options?.forceAll) return true;
      const createdMs = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return (nowMs - createdMs) > GRACE_PERIOD_MS;
    });

    if (orphanCustomers.length === 0) return 0;

    let legacyDb: any = null;
    try {
      const leg = getLegacyDatabase();
      if (leg.name !== db.name) legacyDb = leg;
    } catch {}

    const orphanIds = orphanCustomers.map((c) => c.id);
    await db.customers.bulkDelete(orphanIds);
    if (legacyDb) {
      try {
        await legacyDb.customers.bulkDelete(orphanIds);
      } catch {}
    }

    const nowIso = new Date().toISOString();
    const auditEntries = orphanCustomers.map((c) => ({
      id: generateUUID(),
      entityType: 'customer' as const,
      entityId: c.id,
      action: 'delete' as const,
      timestamp: nowIso,
      summary: `Cleaned up customer "${c.displayName}" (0 policies)`,
    }));
    await db.auditLogs.bulkAdd(auditEntries);

    d1SyncService.triggerAutoSync();
    return orphanCustomers.length;
  },

  async create(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Customer> {
    const id = customer.id || generateUUID();
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...customer,
      id,
      normalizedName: normalizeSearchString(customer.displayName),
      createdAt: now,
      updatedAt: now,
    };

    await db.customers.add(newCustomer);

    await db.auditLogs.add({
      id: generateUUID(),
      entityType: 'customer',
      entityId: id,
      action: 'create',
      timestamp: now,
      summary: `Created customer profile for "${customer.displayName}"`,
    });

    d1SyncService.triggerAutoSync();
    return newCustomer;
  },

  async update(id: string, updates: Partial<Customer>): Promise<void> {
    const existing = await db.customers.get(id);
    if (!existing) throw new Error(`Customer with ID ${id} not found.`);

    const now = new Date().toISOString();
    const updated: Customer = {
      ...existing,
      ...updates,
      normalizedName: updates.displayName ? normalizeSearchString(updates.displayName) : existing.normalizedName,
      updatedAt: now,
    };

    await db.customers.put(updated);

    await db.auditLogs.add({
      id: generateUUID(),
      entityType: 'customer',
      entityId: id,
      action: 'update',
      timestamp: now,
      summary: `Updated customer "${existing.displayName}"`,
    });

    d1SyncService.triggerAutoSync();
  },

  async mergeCustomers(sourceCustomerId: string, targetCustomerId: string): Promise<void> {
    if (sourceCustomerId === targetCustomerId) return;

    const source = await db.customers.get(sourceCustomerId);
    const target = await db.customers.get(targetCustomerId);
    if (!source || !target) throw new Error('One or both customers could not be found.');

    // Transactional reassignment of policies and reminders
    await db.transaction('rw', [db.customers, db.policies, db.reminders, db.auditLogs], async () => {
      const policies = await db.policies.where('customerId').equals(sourceCustomerId).toArray();
      const now = new Date().toISOString();

      for (const p of policies) {
        await db.policies.update(p.id, {
          customerId: targetCustomerId,
          updatedAt: now,
        });
      }

      const reminders = await db.reminders.where('customerId').equals(sourceCustomerId).toArray();
      for (const r of reminders) {
        await db.reminders.update(r.id, {
          customerId: targetCustomerId,
          updatedAt: now,
        });
      }

      // Append notes if any
      if (source.notes && source.notes !== target.notes) {
        const combinedNotes = (target.notes ? target.notes + '\n\n' : '') + `[Merged from ${source.displayName}]: ` + source.notes;
        await db.customers.update(targetCustomerId, { notes: combinedNotes, updatedAt: now });
      }

      // Delete the source customer
      await db.customers.delete(sourceCustomerId);

      await db.auditLogs.add({
        id: generateUUID(),
        entityType: 'customer',
        entityId: targetCustomerId,
        action: 'merge',
        timestamp: now,
        summary: `Merged customer "${source.displayName}" (ID: ${source.id}) into "${target.displayName}" (ID: ${target.id}). Reassigned ${policies.length} policies.`,
      });
      d1SyncService.triggerAutoSync();
    });
  },

  async delete(id: string): Promise<void> {
    const existing = await db.customers.get(id);
    if (existing) {
      const associatedPolicies = await db.policies.where('customerId').equals(id).count();
      if (associatedPolicies > 0) {
        throw new Error(`Cannot delete customer with ${associatedPolicies} active policies. Please reassign or delete policies first.`);
      }
      await db.customers.delete(id);
      try {
        const legacy = getLegacyDatabase();
        if (legacy.name !== db.name) {
          await legacy.customers.delete(id);
        }
      } catch {}
      await db.auditLogs.add({
        id: generateUUID(),
        entityType: 'customer',
        entityId: id,
        action: 'delete',
        timestamp: new Date().toISOString(),
        summary: `Deleted customer "${existing.displayName}"`,
      });
      d1SyncService.triggerAutoSync();
    }
  },

  async search(query: string): Promise<CustomerWithSummary[]> {
    const all = await this.getAllWithSummary();
    if (!query.trim()) return all;

    const q = normalizeSearchString(query);
    return all.filter((c) => {
      const nameMatch = c.normalizedName.includes(q);
      const mobileMatch = c.mobileNumber?.includes(q) ?? false;
      const policyMatch = c.policies.some((p) => p.policyNumber.toLowerCase().includes(q));
      return nameMatch || mobileMatch || policyMatch;
    });
  }
};
