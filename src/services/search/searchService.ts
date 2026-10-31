import { db } from '@/db/database';
import { normalizeSearchString } from '@/utils/formatters';
import type { Policy, Customer } from '@/types';

export interface GlobalSearchResult {
  query: string;
  customers: (Customer & { policyCount: number })[];
  policies: Policy[];
  totalMatches: number;
}

export const searchService = {
  async globalSearch(query: string, maxResults = 25): Promise<GlobalSearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { query, customers: [], policies: [], totalMatches: 0 };
    }

    const q = normalizeSearchString(trimmed);
    const [policies, customers] = await Promise.all([
      db.policies.toArray(),
      db.customers.toArray(),
    ]);

    // Count policies per customer
    const policyCountByCustomer = new Map<string, number>();
    for (const p of policies) {
      policyCountByCustomer.set(p.customerId, (policyCountByCustomer.get(p.customerId) || 0) + 1);
    }

    // Match Customers
    const matchingCustomers = customers
      .filter((c) => {
        const nameMatch = c.normalizedName.includes(q);
        const mobileMatch = c.mobileNumber ? c.mobileNumber.includes(trimmed) : false;
        return nameMatch || mobileMatch;
      })
      .map((c) => ({
        ...c,
        policyCount: policyCountByCustomer.get(c.id) || 0,
      }))
      .slice(0, maxResults);

    // Match Policies
    const matchingPolicies = policies
      .filter((p) => {
        const numMatch = p.policyNumber.toLowerCase().includes(q);
        const nameMatch = normalizeSearchString(p.customerName).includes(q);
        const planMatch = p.planCode.toLowerCase().includes(q);
        return numMatch || nameMatch || planMatch;
      })
      .slice(0, maxResults);

    return {
      query: trimmed,
      customers: matchingCustomers,
      policies: matchingPolicies,
      totalMatches: matchingCustomers.length + matchingPolicies.length,
    };
  }
};
