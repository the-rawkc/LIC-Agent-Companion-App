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
    const [customers, policies] = await Promise.all([
      db.customers.toArray(),
      db.policies.toArray(),
    ]);
    const activeCustomerIds = new Set(policies.map((p) => p.customerId).filter(Boolean));
    const nowMs = Date.now();
    return customers.filter((c) => {
      if (activeCustomerIds.has(c.id)) return true;
      const createdMs = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return Number.isFinite(createdMs) && (nowMs - createdMs) < 60000;
    });
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
    // Run deduplication & orphan purge first
    await this.deduplicateAndPurgeOrphans();

    const [customers, policies] = await Promise.all([
      db.customers.toArray(),
      db.policies.toArray(),
    ]);

    const policiesByCustomer = new Map<string, Policy[]>();
    for (const p of policies) {
      if (!p.customerId) continue;
      const list = policiesByCustomer.get(p.customerId) || [];
      list.push(p);
      policiesByCustomer.set(p.customerId, list);
    }

    // Filter to active customers with at least 1 policy, and guarantee uniqueness by name
    const seenNames = new Set<string>();
    const uniqueActiveCustomers: CustomerWithSummary[] = [];

    for (const c of customers) {
      const cPolicies = policiesByCustomer.get(c.id) || [];
      if (cPolicies.length === 0) continue;

      const normName = normalizeSearchString(c.displayName || '');
      if (seenNames.has(normName)) {
        // Remove duplicate customer entry from database
        db.customers.delete(c.id).catch(() => {});
        continue;
      }
      seenNames.add(normName);

      const totalSumAssured = cPolicies.reduce((sum, p) => sum + p.sumAssured, 0);
      const totalRecordedPremium = cPolicies.reduce((sum, p) => sum + p.premiumAmount, 0);
      
      const upcomingDates = cPolicies
        .flatMap((p) => [p.verifiedNextPremiumDate || p.firstUnpaidPremiumDate, p.maturityDate])
        .filter((d): d is string => Boolean(d))
        .sort();

      uniqueActiveCustomers.push({
        ...c,
        policyCount: cPolicies.length,
        totalSumAssured,
        totalRecordedPremium,
        policies: cPolicies,
        nextUpcomingDate: upcomingDates[0] || null,
      });
    }

    return uniqueActiveCustomers;
  },

  /**
   * Automatically merges duplicate customers with the same name and deletes all customers with 0 policies.
   */
  async deduplicateAndPurgeOrphans(): Promise<{ mergedCount: number; purgedOrphans: number }> {
    const [allCustomers, allPolicies] = await Promise.all([
      db.customers.toArray(),
      db.policies.toArray(),
    ]);

    // 1. Group policies by customerId
    const policiesByCustomerId = new Map<string, Policy[]>();
    for (const p of allPolicies) {
      if (!p.customerId) continue;
      const list = policiesByCustomerId.get(p.customerId) || [];
      list.push(p);
      policiesByCustomerId.set(p.customerId, list);
    }

    // 2. Group customers by normalized name
    const customersByName = new Map<string, Customer[]>();
    for (const c of allCustomers) {
      const normKey = normalizeSearchString(c.displayName || '');
      const list = customersByName.get(normKey) || [];
      list.push(c);
      customersByName.set(normKey, list);
    }

    let mergedCount = 0;
    const customerIdsToDelete = new Set<string>();
    const policiesToUpdate: { id: string; customerId: string }[] = [];

    // 3. For any duplicate names, keep primary and merge/delete duplicates
    for (const [normKey, custList] of customersByName.entries()) {
      if (!normKey || custList.length <= 1) continue;

      // Sort by policy count descending
      custList.sort((a, b) => {
        const countA = policiesByCustomerId.get(a.id)?.length || 0;
        const countB = policiesByCustomerId.get(b.id)?.length || 0;
        return countB - countA;
      });

      const primary = custList[0];
      const duplicates = custList.slice(1);

      for (const dup of duplicates) {
        customerIdsToDelete.add(dup.id);
        mergedCount++;

        // Reassign any policies from duplicate to primary
        const dupPolicies = policiesByCustomerId.get(dup.id) || [];
        for (const p of dupPolicies) {
          policiesToUpdate.push({ id: p.id, customerId: primary.id });
          const primaryPolicies = policiesByCustomerId.get(primary.id) || [];
          primaryPolicies.push(p);
          policiesByCustomerId.set(primary.id, primaryPolicies);
        }
      }
    }

    // 4. Mark all remaining customers with 0 policies for deletion
    for (const c of allCustomers) {
      if (customerIdsToDelete.has(c.id)) continue;
      const pCount = policiesByCustomerId.get(c.id)?.length || 0;
      if (pCount === 0) {
        // Check if any policy has matching name but unlinked customerId
        const nameNorm = normalizeSearchString(c.displayName || '');
        const matchingPolicy = allPolicies.find(
          (p) => normalizeSearchString(p.customerName || '') === nameNorm && !customerIdsToDelete.has(p.customerId)
        );
        if (matchingPolicy) {
          policiesToUpdate.push({ id: matchingPolicy.id, customerId: c.id });
          policiesByCustomerId.set(c.id, [matchingPolicy]);
        } else {
          customerIdsToDelete.add(c.id);
        }
      }
    }

    // 5. Apply updates in database
    let legacyDb: any = null;
    try {
      const leg = getLegacyDatabase();
      if (leg.name !== db.name) legacyDb = leg;
    } catch {}

    const deleteIds = Array.from(customerIdsToDelete);
    if (policiesToUpdate.length > 0) {
      for (const u of policiesToUpdate) {
        await db.policies.update(u.id, { customerId: u.customerId });
        if (legacyDb) {
          try {
            await legacyDb.policies.update(u.id, { customerId: u.customerId });
          } catch {}
        }
      }
    }

    if (deleteIds.length > 0) {
      await db.customers.bulkDelete(deleteIds);
      if (legacyDb) {
        try {
          await legacyDb.customers.bulkDelete(deleteIds);
        } catch {}
      }
    }

    return { mergedCount, purgedOrphans: deleteIds.length };
  },

  /**
   * Automatically deletes all customers who have 0 associated policies
   */
  async cleanupOrphanCustomers(options?: { forceAll?: boolean }): Promise<number> {
    const res = await this.deduplicateAndPurgeOrphans();
    return res.purgedOrphans;
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
