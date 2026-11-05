import { hashPin, generateSalt, saltToHex, hexToSalt } from '@/services/security/pinService';
import { switchAgentDatabase, getDatabase, getLegacyDatabase, getActiveAgencyCode } from '@/db/database';
import { profileRepository } from '@/db/repositories/profileRepository';
import { d1SyncService } from '@/services/cloud/d1SyncService';

export interface AgentAccount {
  agencyCode: string;
  agentName: string;
  mobileNumber: string;
  pinHash: string;
  pinSalt: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface AutoRestoreResult {
  restored: boolean;
  count: number;
  source: 'legacy' | 'cloud' | 'none';
}

const REGISTRY_STORAGE_KEY = 'lic_agent_accounts_registry';
const AUTH_FLAG_KEY = 'lic_authenticated';
const ACTIVE_AGENCY_KEY = 'lic_active_agency_code';
const UNLOCKED_KEY = 'lic_app_unlocked';
const LAST_AGENCY_KEY = 'lic_last_agency_code';

// Clean up any stale persistent auth flags from localStorage so opening in a new session/browser always requires PIN authentication
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(AUTH_FLAG_KEY);
    localStorage.removeItem(ACTIVE_AGENCY_KEY);
    localStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

export const authService = {
  /**
   * Get all registered agent accounts on this local device
   */
  getRegisteredAgents(): AgentAccount[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Save agent accounts to local device storage
   */
  saveRegisteredAgents(agents: AgentAccount[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(agents));
  },

  /**
   * Check whether any agent is currently authenticated in the active session
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    const isAuth = sessionStorage.getItem(AUTH_FLAG_KEY) === 'true';
    const localAuth = localStorage.getItem('lic_auth_logged_in') === 'true';
    const activeAgency = getActiveAgencyCode();
    return Boolean((isAuth || localAuth) && activeAgency);
  },

  /**
   * Set active authenticated agent session (session-scoped for security)
   */
  setSession(agencyCode: string, pin?: string): void {
    if (typeof window === 'undefined') return;
    const sanitized = agencyCode.trim().toUpperCase();
    sessionStorage.setItem(ACTIVE_AGENCY_KEY, sanitized);
    sessionStorage.setItem(AUTH_FLAG_KEY, 'true');
    sessionStorage.setItem(UNLOCKED_KEY, 'true');
    localStorage.setItem('lic_auth_logged_in', 'true');
    localStorage.setItem(ACTIVE_AGENCY_KEY, sanitized);
    localStorage.setItem(LAST_AGENCY_KEY, sanitized);
    if (pin) {
      sessionStorage.setItem('lic_session_pin', pin.trim());
      localStorage.setItem('lic_session_pin', pin.trim());
    }
  },

  /**
   * Clear active agent session on logout
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(ACTIVE_AGENCY_KEY);
    sessionStorage.removeItem(AUTH_FLAG_KEY);
    sessionStorage.removeItem(UNLOCKED_KEY);
    sessionStorage.removeItem('lic_session_pin');
    localStorage.removeItem('lic_session_pin');
    localStorage.removeItem(ACTIVE_AGENCY_KEY);
    localStorage.removeItem(AUTH_FLAG_KEY);
    localStorage.removeItem('lic_auth_logged_in');
    localStorage.removeItem(UNLOCKED_KEY);
  },

  /**
   * Get active logged in agent account
   */
  getCurrentAgent(): AgentAccount | null {
    const code = getActiveAgencyCode();
    if (!code) return null;
    const all = this.getRegisteredAgents();
    return all.find((a) => a.agencyCode.toUpperCase() === code.toUpperCase()) || null;
  },

  /**
   * Register a new agent with their Agency Code, Phone Number, and 4-digit PIN
   */
  async register(params: {
    agencyCode: string;
    mobileNumber: string;
    agentName?: string;
    pin: string;
  }): Promise<{ success: boolean; agent: AgentAccount; message: string; restoredCount?: number }> {
    const agencyCode = params.agencyCode.trim().toUpperCase();
    const mobileNumber = params.mobileNumber.replace(/\D/g, '').slice(-10);
    const agentName = params.agentName?.trim() || `Agent ${agencyCode}`;
    const pin = params.pin.trim();

    // Validations
    if (!agencyCode || agencyCode.length < 4) {
      throw new Error('Please enter a valid Agency Code (at least 4 characters).');
    }
    if (!mobileNumber || mobileNumber.length !== 10) {
      throw new Error('Please enter a valid 10-digit Indian Mobile Number.');
    }
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('Security PIN must be exactly 4 numeric digits.');
    }

    const agents = this.getRegisteredAgents();
    const existingIndex = agents.findIndex((a) => a.agencyCode === agencyCode);

    if (existingIndex >= 0) {
      throw new Error(
        `Agency Code ${agencyCode} is already registered on this device. Please log in using your 4-digit PIN.`
      );
    }

    // Generate PBKDF2 hash & salt
    const salt = generateSalt();
    const pinHash = await hashPin(pin, salt);
    const now = new Date().toISOString();

    const newAgent: AgentAccount = {
      agencyCode,
      agentName,
      mobileNumber,
      pinHash,
      pinSalt: saltToHex(salt),
      createdAt: now,
      lastLoginAt: now,
    };

    agents.push(newAgent);
    this.saveRegisteredAgents(agents);

    // Switch active database to this agent's isolated DB
    switchAgentDatabase(agencyCode);

    // Seed/Update agent profile
    await profileRepository.saveProfile({
      agencyCode,
      fullName: agentName,
      mobileNumber,
      whatsappNumber: mobileNumber,
    });

    // Check if legacy single-tenant DB had data or Cloudflare D1 has data and restore it!
    let restoreResult: AutoRestoreResult = { restored: false, count: 0, source: 'none' };
    try {
      restoreResult = await this.autoRestoreOrMigrateData(agencyCode, pin);
    } catch (e) {
      console.warn('Auto restore on register notice:', e);
    }

    // Set active persistent session with PIN
    this.setSession(agencyCode, pin);

    // Attempt online registration and initial backup with Cloudflare D1
    try {
      await d1SyncService.authenticate(agencyCode, pin, agentName);
      await d1SyncService.pushToCloud(agencyCode, pin);
    } catch {
      // Offline mode works seamlessly
    }

    return {
      success: true,
      agent: newAgent,
      message: restoreResult.restored
        ? `Account created & restored ${restoreResult.count} policies for Agent ${agencyCode}!`
        : `Account created successfully for Agent ${agencyCode}!`,
      restoredCount: restoreResult.count,
    };
  },

  /**
   * Log in an agent using their Agency Code and 4-digit PIN
   */
  async login(
    agencyCodeInput: string,
    pinInput: string
  ): Promise<{
    success: boolean;
    agent: AgentAccount;
    restoredFromCloud?: boolean;
    restoredFromLegacy?: boolean;
    restoredCount?: number;
  }> {
    const agencyCode = agencyCodeInput.trim().toUpperCase();
    const pin = pinInput.trim();

    if (!agencyCode || agencyCode.length < 4) {
      throw new Error('Please enter a valid Agency Code.');
    }
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 numeric digits.');
    }

    const agents = this.getRegisteredAgents();
    const localAgent = agents.find((a) => a.agencyCode === agencyCode);

    if (localAgent) {
      // Verify local PIN using PBKDF2
      const salt = hexToSalt(localAgent.pinSalt);
      const computedHash = await hashPin(pin, salt);

      if (computedHash !== localAgent.pinHash) {
        throw new Error('Incorrect 4-digit PIN. Please enter your valid registered PIN.');
      }

      // Update lastLoginAt
      localAgent.lastLoginAt = new Date().toISOString();
      this.saveRegisteredAgents(agents);

      // Switch active database
      switchAgentDatabase(agencyCode);

      // Set active persistent session with PIN
      this.setSession(agencyCode, pin);

      // Check if data needs to be restored from legacy local DB or Cloudflare D1
      let restoreInfo: AutoRestoreResult = { restored: false, count: 0, source: 'none' };
      try {
        restoreInfo = await this.autoRestoreOrMigrateData(agencyCode, pin);
      } catch (e) {
        console.warn('Auto restore notice:', e);
      }

      return {
        success: true,
        agent: localAgent,
        restoredFromCloud: restoreInfo.source === 'cloud',
        restoredFromLegacy: restoreInfo.source === 'legacy',
        restoredCount: restoreInfo.count,
      };
    }

    // Not found locally: Check Cloudflare D1 (e.g. login on new device or fresh browser)
    try {
      const authResult = await d1SyncService.authenticate(agencyCode, pin);
      if (authResult) {
        const salt = generateSalt();
        const pinHash = await hashPin(pin, salt);
        const now = new Date().toISOString();

        const restoredAgent: AgentAccount = {
          agencyCode,
          agentName: authResult.agentName || `Agent ${agencyCode}`,
          mobileNumber: '',
          pinHash,
          pinSalt: saltToHex(salt),
          createdAt: now,
          lastLoginAt: now,
        };

        agents.push(restoredAgent);
        this.saveRegisteredAgents(agents);
        switchAgentDatabase(agencyCode);
        this.setSession(agencyCode, pin);

        // Pull policies & customers from Cloudflare D1 or legacy DB
        let restoreInfo: AutoRestoreResult = { restored: false, count: 0, source: 'none' };
        try {
          restoreInfo = await this.autoRestoreOrMigrateData(agencyCode, pin);
        } catch (e) {
          console.warn('Auto restore on cloud login notice:', e);
        }

        // Enrich local agent account if profile has agent name/phone
        try {
          const agentDb = getDatabase(agencyCode);
          const prof = await agentDb.appSettings.get('agent_profile');
          if (prof?.value && (prof.value as any).fullName) {
            restoredAgent.agentName = (prof.value as any).fullName;
            if ((prof.value as any).mobileNumber) {
              restoredAgent.mobileNumber = (prof.value as any).mobileNumber;
            }
            this.saveRegisteredAgents(agents);
          }
        } catch {}

        return {
          success: true,
          agent: restoredAgent,
          restoredFromCloud: restoreInfo.source === 'cloud' || restoreInfo.count > 0,
          restoredFromLegacy: restoreInfo.source === 'legacy',
          restoredCount: restoreInfo.count,
        };
      }
    } catch (err: any) {
      if (err?.message && (err.message.toLowerCase().includes('pin') || err.message.includes('401'))) {
        throw new Error('Incorrect security PIN for Agency Code ' + agencyCode + '. Please check and try again.');
      }
      if (err?.message && !err.message.includes('404') && !err.message.includes('not found')) {
        console.warn('Cloud sync error on login:', err.message);
      }
    }

    throw new Error(
      `Agency Code "${agencyCode}" was not found on this device or cloud backup. Please click "Register First Time" to create your personal account.`
    );
  },

  /**
   * Log out of current agent workspace
   */
  logout(): void {
    this.clearSession();
  },

  /**
   * Automatically restores or migrates personal profile and settings
   * from legacy database or registered account credentials.
   */
  async restoreOrMigrateProfile(agencyCode: string, pin?: string): Promise<boolean> {
    const sanitized = agencyCode.trim().toUpperCase();
    const agentDb = getDatabase(sanitized);

    try {
      const currentProfileItem = await agentDb.appSettings.get('agent_profile');
      const curVal = currentProfileItem?.value as any;
      const hasValidCurrentProfile =
        curVal &&
        curVal.fullName &&
        curVal.fullName !== 'LIC Financial Advisor';

      // 1. Check legacy database for saved profile or settings
      let legacyProfile: any = null;
      try {
        const legacyDb = getLegacyDatabase();
        const legacyProfileItem = await legacyDb.appSettings.get('agent_profile');
        if (legacyProfileItem && legacyProfileItem.value) {
          legacyProfile = legacyProfileItem.value;
        }

        // Migrate other legacy settings (theme, reportDate, etc.)
        const legacySettings = await legacyDb.appSettings.toArray();
        for (const item of legacySettings) {
          const existing = await agentDb.appSettings.get(item.key);
          if (!existing) {
            await agentDb.appSettings.put(item);
          }
        }
      } catch {}

      // 2. Lookup registered account info
      const account =
        this.getRegisteredAgents().find((a) => a.agencyCode === sanitized) ||
        this.getCurrentAgent();

      if (!hasValidCurrentProfile) {
        const mergedProfile = {
          fullName: legacyProfile?.fullName || account?.agentName || 'LIC Financial Advisor',
          agencyCode: sanitized,
          branchName: legacyProfile?.branchName || 'Main City Branch',
          branchCode: legacyProfile?.branchCode || '',
          division: legacyProfile?.division || '',
          mobileNumber: legacyProfile?.mobileNumber || account?.mobileNumber || '',
          whatsappNumber: legacyProfile?.whatsappNumber || account?.mobileNumber || '',
          email: legacyProfile?.email || '',
          clubMembership: legacyProfile?.clubMembership || "Chairman's Club Member",
          developmentOfficerName: legacyProfile?.developmentOfficerName || '',
          developmentOfficerMobile: legacyProfile?.developmentOfficerMobile || '',
          agencyStartDate: legacyProfile?.agencyStartDate || '2018-04-01',
          officeAddress: legacyProfile?.officeAddress || '',
          whatsappSignature:
            legacyProfile?.whatsappSignature ||
            'With warm regards,\nLIC Life Insurance Advisor\nLife Insurance Corporation of India',
          updatedAt: new Date().toISOString(),
        };

        await agentDb.appSettings.put({
          key: 'agent_profile',
          value: mergedProfile,
          updatedAt: new Date().toISOString(),
        });
        await agentDb.appSettings.put({
          key: 'agent_name',
          value: mergedProfile.fullName,
          updatedAt: new Date().toISOString(),
        });
        await agentDb.appSettings.put({
          key: 'agency_code',
          value: sanitized,
          updatedAt: new Date().toISOString(),
        });
        return true;
      }
    } catch (e) {
      console.warn('Profile restore error:', e);
    }
    return false;
  },

  /**
   * Automatically restore or migrate policies, customers, and reminders for an agent.
   * Checks:
   * 1. Personal Profile & Settings Migration
   * 2. Legacy single-tenant IndexedDB ('LICAgentCompanionDB')
   * 3. Cloudflare D1 Cloud Backup
   */
  async autoRestoreOrMigrateData(
    agencyCode: string,
    pin?: string
  ): Promise<AutoRestoreResult> {
    const sanitized = agencyCode.trim().toUpperCase();
    const agentDb = getDatabase(sanitized);

    // Step 0: Always ensure personal profile and credentials are recovered and restored
    await this.restoreOrMigrateProfile(sanitized, pin);

    // 1. Check legacy single-tenant database ('LICAgentCompanionDB')
    try {
      const legacyDb = getLegacyDatabase();
      const legacyCount = await legacyDb.policies.count();
      if (legacyCount > 0) {
        const currentCount = await agentDb.policies.count();
        if (currentCount === 0) {
          const [policies, customers, reminders, auditLogs] = await Promise.all([
            legacyDb.policies.toArray(),
            legacyDb.customers.toArray(),
            legacyDb.reminders.toArray(),
            legacyDb.auditLogs.toArray(),
          ]);

          await agentDb.transaction('rw', [agentDb.policies, agentDb.customers, agentDb.reminders, agentDb.auditLogs], async () => {
            await agentDb.policies.bulkPut(policies);
            await agentDb.customers.bulkPut(customers);
            await agentDb.reminders.bulkPut(reminders);
            await agentDb.auditLogs.bulkPut(auditLogs);
          });

          // Also push to Cloudflare D1 so their data is backed up to cloud under their agency code!
          if (pin) {
            try {
              await d1SyncService.pushToCloud(sanitized, pin);
            } catch {
              // offline mode
            }
          }

          console.log(`Successfully migrated ${policies.length} records from legacy database to ${sanitized}!`);
          return { restored: true, count: policies.length, source: 'legacy' };
        }
      }
    } catch (e) {
      console.warn('Legacy DB migration notice:', e);
    }

    // 2. TWO-WAY CLOUD SYNC WITH CLOUDFLARE D1
    if (pin) {
      try {
        let restoredCount = 0;
        // Step A: Pull from cloud and merge
        const pullResult = await d1SyncService.pullFromCloud(sanitized, pin);
        if (pullResult.policiesCount > 0) {
          restoredCount = pullResult.policiesCount;
          console.log(`Successfully restored ${pullResult.policiesCount} policies from Cloudflare D1 for ${sanitized}`);
        }

        // Step B: Push local records to cloud so cloud is always guaranteed up to date!
        const pushResult = await d1SyncService.pushToCloud(sanitized, pin);
        console.log(`Successfully synced ${pushResult.counts.policies} policies to Cloudflare D1 for ${sanitized}`);

        const totalPolicies = await agentDb.policies.count();
        if (restoredCount > 0) {
          return { restored: true, count: restoredCount, source: 'cloud' };
        }
        return { restored: false, count: totalPolicies, source: 'none' };
      } catch (e) {
        console.warn('Cloud sync on login notice:', e);
      }
    }

    const currentCount = await agentDb.policies.count();
    return { restored: false, count: currentCount, source: 'none' };
  },
};
