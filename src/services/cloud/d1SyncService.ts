import { getDatabase } from '@/db/database';
import { settingsRepository } from '@/db/repositories/settingsRepository';
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
      const data = await res.json();
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

    const data = await res.json();
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

    const res = await fetch(`${base}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyCode: sanitized,
        pin: pin.trim(),
        policies,
        customers,
        reminders,
        profile,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to push data to Cloudflare D1.');
    }

    try {
      await targetDb.appSettings.put({
        key: 'last_cloud_sync',
        value: data.syncedAt,
        updatedAt: new Date().toISOString(),
      });
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

    const res = await fetch(`${base}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyCode: sanitized,
        pin: pin.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to retrieve data from Cloudflare D1.');
    }

    const cloudPolicies: Policy[] = Array.isArray(data.policies) ? data.policies : [];
    const cloudCustomers: Customer[] = Array.isArray(data.customers) ? data.customers : [];
    const cloudReminders: Reminder[] = Array.isArray(data.reminders) ? data.reminders : [];
    const cloudProfile = data.profile || null;

    // Atomically merge records into local IndexedDB
    await targetDb.transaction('rw', [targetDb.policies, targetDb.customers, targetDb.reminders, targetDb.appSettings], async () => {
      if (cloudCustomers.length > 0) {
        await targetDb.customers.bulkPut(cloudCustomers);
      }
      if (cloudPolicies.length > 0) {
        await targetDb.policies.bulkPut(cloudPolicies);
      }
      if (cloudReminders.length > 0) {
        await targetDb.reminders.bulkPut(cloudReminders);
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
   * Automatically synchronize current agent data with Cloudflare D1 in background.
   * Debounced to batch rapid consecutive updates.
   */
  triggerAutoSync(delayMs = 1200): void {
    if (typeof window === 'undefined') return;
    const agencyCode = sessionStorage.getItem('lic_active_agency_code');
    const pin = sessionStorage.getItem('lic_session_pin');
    if (!agencyCode || !pin) return;

    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
    }

    autoSyncTimer = setTimeout(async () => {
      try {
        await this.pushToCloud(agencyCode, pin);
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
