import { getDatabase, getLegacyDatabase } from '@/db/database';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { parseDateToISO } from '@/utils/formatters';
import type { Policy, Customer, Reminder } from '@/types';

export interface SyncStatus {
  d1Ready: boolean;
  timestamp?: string;
  error?: string;
}

export interface SyncConfig {
  agencyCode: string;
  agentName: string;
  lastSyncAt: string | null;
  apiUrl: string;
}

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

async function safeJson(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new Error(`Sync server returned HTTP ${res.status}: ${res.statusText || 'Service unavailable'}`);
    }
    throw new Error('Sync server returned non-JSON response. Check your server URL in Settings.');
  }
  return await res.json();
}

export const d1SyncService = {
  /**
   * Get API Base URL (env -> localStorage -> settings -> origin)
   */
  async getApiBaseUrl(): Promise<string> {
    // 1. Vite Environment Variable
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_D1_API_URL) {
      return ((import.meta as any).env.VITE_D1_API_URL as string).trim().replace(/\/+$/, '');
    }
    // 2. Local device storage (persisted across sessions & reloads)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lic_d1_api_url');
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/+$/, '');
      }
    }
    // 3. Settings repository
    try {
      const customUrl = await settingsRepository.get<string>('d1_api_url', '');
      if (customUrl && customUrl.trim()) {
        return customUrl.trim().replace(/\/+$/, '');
      }
    } catch {
      // ignore
    }
    // 4. Default to same-origin in browser
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return '';
  },

  /**
   * Update API Base URL
   */
  async setApiBaseUrl(url: string): Promise<void> {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      if (cleaned) {
        localStorage.setItem('lic_d1_api_url', cleaned);
      } else {
        localStorage.removeItem('lic_d1_api_url');
      }
    }
    try {
      await settingsRepository.set('d1_api_url', cleaned);
    } catch {
      // ignore
    }
  },

  /**
   * Check connection to Cloudflare D1
   */
  async checkConnection(): Promise<SyncStatus> {
    try {
      const base = await this.getApiBaseUrl();
      const res = await fetch(`${base}/api/sync/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        return { d1Ready: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const data = await safeJson(res);
      return { d1Ready: Boolean(data.d1Ready), timestamp: data.timestamp };
    } catch (err: any) {
      return { d1Ready: false, error: err.message || 'Cannot reach Cloudflare sync server.' };
    }
  },

  /**
   * Authenticate or register an Agency Code with PIN
   */
  async authenticate(
    agencyCode: string,
    pin: string,
    agentName?: string
  ): Promise<{ isNew: boolean; message: string; agentName?: string }> {
    const base = await this.getApiBaseUrl();
    const res = await fetch(`${base}/api/sync/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyCode: agencyCode.trim(), pin: pin.trim(), agentName: agentName?.trim() }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed.');
    }

    try {
      await settingsRepository.set('agency_code', agencyCode.trim());
      if (data.agentName) {
        await settingsRepository.set('agent_name', data.agentName);
      }
    } catch {
      // ignore
    }

    return { isNew: Boolean(data.isNew), message: data.message, agentName: data.agentName };
  },

  /**
   * Push all local policies, customers, reminders, and profile to Cloudflare D1
   */
  async pushToCloud(
    agencyCode: string,
    pin: string
  ): Promise<{ syncedAt: string; counts: { policies: number; customers: number; reminders: number } }> {
    const sanitized = agencyCode.trim().toUpperCase();
    const base = await this.getApiBaseUrl();
    const targetDb = getDatabase(sanitized);

    // Load local records from the agent's database
    const policies = await targetDb.policies.toArray();
    const customers = await targetDb.customers.toArray();
    const reminders = await targetDb.reminders.toArray();
    const profileItem = await targetDb.appSettings.get('agent_profile');
    const profile = profileItem?.value || null;
    const lastAddedItem = await targetDb.appSettings.get('last_added_batch');
    const lastAddedBatch = lastAddedItem?.value || null;

    // Track deleted policies & customers so cloud replica stays in sync
    const deletedLogs = await targetDb.auditLogs.where({ entityType: 'policy', action: 'delete' }).toArray();
    const deletedPolicyIds = Array.from(new Set(deletedLogs.map((l) => l.entityId)));

    const deletedCustomerLogs = await targetDb.auditLogs.where({ entityType: 'customer', action: 'delete' }).toArray();
    const deletedCustomerIds = Array.from(new Set(deletedCustomerLogs.map((l) => l.entityId)));

    // Clean up orphan customers before pushing: only push customers with active policies
    const activeCustomerIds = new Set(policies.map((p) => p.customerId).filter(Boolean));
    const validCustomers = customers.filter(
      (c) => activeCustomerIds.has(c.id) && !deletedCustomerIds.includes(c.id)
    );

    // Strip bulky raw extraction caches to keep payload lightweight and avoid D1 SQL size limits
    const sanitizedPolicies = policies.map((p) => {
      const { rawExtractedValues, extractionWarnings, ...rest } = p;
      return rest;
    });

    const creds = this.getCredentials();
    const pinVal = (pin || creds.pin || '').trim();
    const pinHashVal = creds.pinHash || '';

    const res = await fetch(`${base}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyCode: sanitized,
        pin: pinVal,
        pinHash: pinHashVal,
        policies: sanitizedPolicies,
        customers: validCustomers,
        reminders,
        profile,
        lastAddedBatch,
        deletedPolicyIds,
        deletedCustomerIds,
      }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to push data to Cloudflare D1.');
    }

    try {
      await targetDb.appSettings.put({
        key: 'last_cloud_sync',
        value: data.syncedAt,
        updatedAt: new Date().toISOString(),
      });
      const legacyDb = getLegacyDatabase();
      if (legacyDb.name !== targetDb.name) {
        await legacyDb.appSettings.put({
          key: 'last_cloud_sync',
          value: data.syncedAt,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lic_cloud_synced', {
          detail: { agencyCode: sanitized, syncedAt: data.syncedAt, counts: data.counts },
        })
      );
    }

    return {
      syncedAt: data.syncedAt,
      counts: data.counts,
    };
  },

  /**
   * Pull all cloud policies, customers, and reminders for Agency Code and merge into local IndexedDB
   */
  async pullFromCloud(
    agencyCode: string,
    pin: string
  ): Promise<{
    policiesCount: number;
    customersCount: number;
    remindersCount: number;
    lastSyncAt?: string;
    agentName?: string;
    profile?: any;
  }> {
    const sanitized = agencyCode.trim().toUpperCase();
    const base = await this.getApiBaseUrl();
    const targetDb = getDatabase(sanitized);

    const creds = this.getCredentials();
    const pinVal = (pin || creds.pin || '').trim();
    const pinHashVal = creds.pinHash || '';

    const res = await fetch(`${base}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyCode: sanitized,
        pin: pinVal,
        pinHash: pinHashVal,
      }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to retrieve data from Cloudflare D1.');
    }

    const cloudPolicies: Policy[] = Array.isArray(data.policies) ? data.policies : [];
    const cloudCustomers: Customer[] = Array.isArray(data.customers) ? data.customers : [];
    const cloudReminders: Reminder[] = Array.isArray(data.reminders) ? data.reminders : [];
    const cloudProfile = data.profile || null;

    // Filter out any policies & customers marked as deleted locally
    const deletedLogs = await targetDb.auditLogs.where({ entityType: 'policy', action: 'delete' }).toArray();
    const deletedSet = new Set(deletedLogs.map((l) => l.entityId));

    const deletedCustomerLogs = await targetDb.auditLogs.where({ entityType: 'customer', action: 'delete' }).toArray();
    const deletedCustomerSet = new Set(deletedCustomerLogs.map((l) => l.entityId));

    const validCloudCustomers = cloudCustomers.filter((c) => !deletedCustomerSet.has(c.id));

    // Reconcile existing local policies by policyNumber so FUP updates and new policies merge cleanly across devices
    const localPolicies = await targetDb.policies.toArray();
    const localPolicyByNumber = new Map<string, Policy>();
    for (const lp of localPolicies) {
      const cleanNum = lp.policyNumber.replace(/[^0-9]/g, '').trim();
      if (cleanNum) {
        localPolicyByNumber.set(cleanNum, lp);
        localPolicyByNumber.set(cleanNum.replace(/^0+/, ''), lp);
      }
    }

    const newlyPulledPolicies: Policy[] = [];
    const policiesToPut: Policy[] = [];
    for (const cp of cloudPolicies) {
      if (deletedSet.has(cp.id)) continue;

      const cleanCpNum = cp.policyNumber.replace(/[^0-9]/g, '').trim();
      const existing = cleanCpNum
        ? localPolicyByNumber.get(cleanCpNum) || localPolicyByNumber.get(cleanCpNum.replace(/^0+/, ''))
        : null;

      if (existing) {
        // Parse dates to ISO to prevent string comparison bugs between 'DD/MM/YYYY' and 'YYYY-MM-DD'
        const existingFupIso = parseDateToISO(existing.firstUnpaidPremiumDate || existing.commencementDate) || '';
        const cloudFupIso = parseDateToISO(cp.firstUnpaidPremiumDate || cp.commencementDate) || '';
        const isCloudNewer = Boolean(cp.updatedAt && (!existing.updatedAt || cp.updatedAt >= existing.updatedAt));

        let chosenFup = cp.firstUnpaidPremiumDate || existing.firstUnpaidPremiumDate;
        if (existingFupIso && cloudFupIso) {
          chosenFup = (cloudFupIso >= existingFupIso || isCloudNewer)
            ? cp.firstUnpaidPremiumDate
            : existing.firstUnpaidPremiumDate;
        }

        policiesToPut.push({
          ...existing,
          ...cp,
          id: existing.id,
          customerId: existing.customerId || cp.customerId,
          firstUnpaidPremiumDate: chosenFup,
          premiumMode: cp.premiumMode || existing.premiumMode,
          updatedAt: isCloudNewer ? (cp.updatedAt || new Date().toISOString()) : existing.updatedAt,
        });
      } else {
        policiesToPut.push(cp);
        newlyPulledPolicies.push(cp);
      }
    }

    // Reconcile and clean any local orphan records that do not exist in cloud portfolio
    const cloudPolicyIds = new Set(cloudPolicies.map((p) => p.id));
    const cloudPolicyNums = new Set(
      cloudPolicies.map((p) => p.policyNumber.replace(/[^0-9]/g, '').trim()).filter(Boolean)
    );
    const orphanPolicyIds = cloudPolicies.length >= 1000
      ? localPolicies
          .filter((lp) => !cloudPolicyIds.has(lp.id) && !cloudPolicyNums.has(lp.policyNumber.replace(/[^0-9]/g, '').trim()))
          .map((lp) => lp.id)
      : [];

    // Atomically merge records into local IndexedDB
    await targetDb.transaction('rw', [targetDb.policies, targetDb.customers, targetDb.reminders, targetDb.appSettings], async () => {
      if (validCloudCustomers.length > 0) {
        await targetDb.customers.bulkPut(validCloudCustomers);
      }
      if (policiesToPut.length > 0) {
        await targetDb.policies.bulkPut(policiesToPut);
      }
      if (orphanPolicyIds.length > 0) {
        await targetDb.policies.bulkDelete(orphanPolicyIds);
      }
      if (cloudReminders.length > 0) {
        await targetDb.reminders.bulkPut(cloudReminders);
      }
      if (data.lastAddedBatch) {
        await targetDb.appSettings.put({
          key: 'last_added_batch',
          value: data.lastAddedBatch,
          updatedAt: new Date().toISOString(),
        });
      } else if (newlyPulledPolicies.length > 0) {
        await targetDb.appSettings.put({
          key: 'last_added_batch',
          value: {
            timestamp: new Date().toISOString(),
            count: newlyPulledPolicies.length,
            policyNumbers: newlyPulledPolicies.map((p) => p.policyNumber),
            policies: newlyPulledPolicies.map((p) => ({
              id: p.id,
              policyNumber: p.policyNumber,
              customerName: p.customerName,
              premiumMode: p.premiumMode,
              firstUnpaidPremiumDate: p.firstUnpaidPremiumDate,
              commencementDate: p.commencementDate,
              createdAt: p.createdAt,
            })),
          },
          updatedAt: new Date().toISOString(),
        });
      }
      if (cloudProfile) {
        await targetDb.appSettings.put({
          key: 'agent_profile',
          value: cloudProfile,
          updatedAt: new Date().toISOString(),
        });
        if (cloudProfile.fullName) {
          await targetDb.appSettings.put({
            key: 'agent_name',
            value: cloudProfile.fullName,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      if (data.lastSyncAt) {
        await targetDb.appSettings.put({
          key: 'last_cloud_sync',
          value: data.lastSyncAt,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    // Clean up any orphan customers who have 0 remaining policies
    const allFinalPolicies = await targetDb.policies.toArray();
    const finalCustIdsWithPolicies = new Set(allFinalPolicies.map((p) => p.customerId).filter(Boolean));
    const allFinalCustomers = await targetDb.customers.toArray();
    const orphanCustomerIds = allFinalCustomers
      .filter((c) => !finalCustIdsWithPolicies.has(c.id))
      .map((c) => c.id);

    if (orphanCustomerIds.length > 0) {
      await targetDb.customers.bulkDelete(orphanCustomerIds);
      try {
        const legacyDb = getLegacyDatabase();
        if (legacyDb.name !== targetDb.name) {
          await legacyDb.customers.bulkDelete(orphanCustomerIds);
        }
      } catch {}
    }

    // Mirror to legacyDb so all databases on the device stay in 100% sync
    try {
      const legacyDb = getLegacyDatabase();
      if (legacyDb.name !== targetDb.name) {
        await legacyDb.transaction('rw', [legacyDb.policies, legacyDb.customers, legacyDb.reminders, legacyDb.appSettings], async () => {
          if (cloudCustomers.length > 0) await legacyDb.customers.bulkPut(cloudCustomers);
          if (policiesToPut.length > 0) await legacyDb.policies.bulkPut(policiesToPut);
          if (orphanPolicyIds.length > 0) await legacyDb.policies.bulkDelete(orphanPolicyIds);
          if (cloudReminders.length > 0) await legacyDb.reminders.bulkPut(cloudReminders);
          if (data.lastAddedBatch) {
            await legacyDb.appSettings.put({
              key: 'last_added_batch',
              value: data.lastAddedBatch,
              updatedAt: new Date().toISOString(),
            });
          }
        });
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lic_cloud_synced', {
          detail: {
            agencyCode: sanitized,
            syncedAt: data.lastSyncAt,
            counts: {
              policies: cloudPolicies.length,
              customers: cloudCustomers.length,
              reminders: cloudReminders.length,
            },
          },
        })
      );
    }

    return {
      policiesCount: cloudPolicies.length,
      customersCount: cloudCustomers.length,
      remindersCount: cloudReminders.length,
      lastSyncAt: data.lastSyncAt,
      agentName: data.agentName,
      profile: cloudProfile,
    };
  },

  /**
   * Complete two-way sync:
   * 1. Authenticate with Cloudflare D1
   * 2. Pull all cloud records and merge into local IndexedDB
   * 3. Push local state up to Cloudflare D1
   */
  async fullTwoWaySync(
    agencyCode: string,
    pin: string,
    agentName?: string
  ): Promise<{
    pulledCount: number;
    pushedCount: number;
    syncedAt: string;
  }> {
    const sanitized = agencyCode.trim().toUpperCase();

    // 1. Authenticate / Register
    await this.authenticate(sanitized, pin, agentName);

    // 2. Pull from cloud and merge into local IndexedDB
    const pullResult = await this.pullFromCloud(sanitized, pin);

    // 3. Push local records up to Cloudflare D1
    const pushResult = await this.pushToCloud(sanitized, pin);

    return {
      pulledCount: pullResult.policiesCount,
      pushedCount: pushResult.counts.policies,
      syncedAt: pushResult.syncedAt,
    };
  },

  /**
   * Helper to retrieve currently authenticated agencyCode and pin/pinHash from any storage layer
   */
  getCredentials(): { agencyCode: string | null; pin: string | null; pinHash: string | null } {
    if (typeof window === 'undefined') return { agencyCode: null, pin: null, pinHash: null };
    const agencyCode =
      sessionStorage.getItem('lic_active_agency_code') ||
      localStorage.getItem('lic_active_agency_code') ||
      localStorage.getItem('lic_last_agency_code') ||
      null;
    const pin =
      sessionStorage.getItem('lic_session_pin') ||
      localStorage.getItem('lic_session_pin') ||
      null;

    let pinHash: string | null = null;
    try {
      const raw = localStorage.getItem('lic_agent_accounts_registry');
      if (raw && agencyCode) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const acc = parsed.find((a) => a.agencyCode.toUpperCase() === agencyCode.toUpperCase());
          if (acc?.pinHash) {
            pinHash = acc.pinHash;
          }
        }
      }
    } catch {}

    return { agencyCode, pin, pinHash };
  },

  /**
   * Automatically synchronize current agent data with Cloudflare D1 in background.
   * Debounced to batch rapid consecutive updates.
   */
  triggerAutoSync(delayMs = 1200): void {
    if (typeof window === 'undefined') return;
    const { agencyCode, pin, pinHash } = this.getCredentials();
    if (!agencyCode || (!pin && !pinHash)) return;

    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
    }

    autoSyncTimer = setTimeout(async () => {
      try {
        await this.pushToCloud(agencyCode, pin || '');
        console.log(`[CloudSync] Background sync successfully uploaded records for Agent ${agencyCode}`);
      } catch (err: any) {
        console.warn('[CloudSync] Background sync notice:', err?.message || err);
      }
    }, delayMs);
  },

  /**
   * Get sync configuration and state
   */
  async getSyncConfig(): Promise<SyncConfig> {
    const agencyCode = await settingsRepository.get<string>('agency_code', '');
    const agentName = await settingsRepository.get<string>('agent_name', '');
    const lastSyncAt = await settingsRepository.get<string | null>('last_cloud_sync', null);
    const apiUrl = await this.getApiBaseUrl();

    return { agencyCode, agentName, lastSyncAt, apiUrl };
  },
};
