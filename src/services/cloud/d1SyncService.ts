import { db } from '@/db/database';
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

export const d1SyncService = {
  /**
   * Get API Base URL (defaults to window.location.origin)
   */
  async getApiBaseUrl(): Promise<string> {
    const customUrl = await settingsRepository.get<string>('d1_api_url', '');
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, '');
    }
    // When running in browser, relative path works with same-origin worker
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return '';
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
  async authenticate(agencyCode: string, pin: string, agentName?: string): Promise<{ isNew: boolean; message: string }> {
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

    // Save active agency code & name
    await settingsRepository.set('agency_code', agencyCode.trim());
    if (data.agentName) {
      await settingsRepository.set('agent_name', data.agentName);
    }

    return { isNew: Boolean(data.isNew), message: data.message };
  },

  /**
   * Push all local policies, customers, and reminders to Cloudflare D1
   */
  async pushToCloud(agencyCode: string, pin: string): Promise<{ syncedAt: string; counts: { policies: number; customers: number; reminders: number } }> {
    const base = await this.getApiBaseUrl();

    // Load local records
    const policies = await db.policies.toArray();
    const customers = await db.customers.toArray();
    const reminders = await db.reminders.toArray();
    const profileItem = await db.appSettings.get('agent_profile');
    const profile = profileItem?.value || null;

    const res = await fetch(`${base}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyCode: agencyCode.trim(),
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

    await settingsRepository.set('last_cloud_sync', data.syncedAt);
    return {
      syncedAt: data.syncedAt,
      counts: data.counts,
    };
  },

  /**
   * Pull all cloud policies, customers, and reminders for Agency Code and restore into local IndexedDB
   */
  async pullFromCloud(agencyCode: string, pin: string): Promise<{ policiesCount: number; customersCount: number; remindersCount: number; lastSyncAt?: string }> {
    const base = await this.getApiBaseUrl();

    const res = await fetch(`${base}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyCode: agencyCode.trim(),
        pin: pin.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to retrieve data from Cloudflare D1.');
    }

    const cloudPolicies: Policy[] = data.policies || [];
    const cloudCustomers: Customer[] = data.customers || [];
    const cloudReminders: Reminder[] = data.reminders || [];
    const cloudProfile = data.profile || null;

    // Atomically restore records into IndexedDB
    await db.transaction('rw', [db.policies, db.customers, db.reminders, db.appSettings], async () => {
      if (cloudCustomers.length > 0) {
        await db.customers.bulkPut(cloudCustomers);
      }
      if (cloudPolicies.length > 0) {
        await db.policies.bulkPut(cloudPolicies);
      }
      if (cloudReminders.length > 0) {
        await db.reminders.bulkPut(cloudReminders);
      }
      if (cloudProfile) {
        await db.appSettings.put({
          key: 'agent_profile',
          value: cloudProfile,
          updatedAt: new Date().toISOString(),
        });
        if (cloudProfile.fullName) {
          await db.appSettings.put({
            key: 'agent_name',
            value: cloudProfile.fullName,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    await settingsRepository.set('agency_code', agencyCode.trim());
    if (data.lastSyncAt) {
      await settingsRepository.set('last_cloud_sync', data.lastSyncAt);
    }

    return {
      policiesCount: cloudPolicies.length,
      customersCount: cloudCustomers.length,
      remindersCount: cloudReminders.length,
      lastSyncAt: data.lastSyncAt,
    };
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
