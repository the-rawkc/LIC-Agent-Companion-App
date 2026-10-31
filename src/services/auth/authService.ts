import { hashPin, generateSalt, saltToHex, hexToSalt } from '@/services/security/pinService';
import { switchAgentDatabase, getDatabase, getActiveAgencyCode } from '@/db/database';
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

const REGISTRY_STORAGE_KEY = 'lic_agent_accounts_registry';
const AUTH_FLAG_KEY = 'lic_authenticated';
const ACTIVE_AGENCY_KEY = 'lic_active_agency_code';
const UNLOCKED_KEY = 'lic_app_unlocked';

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
   * Check whether any agent is currently authenticated
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    const isAuth = sessionStorage.getItem(AUTH_FLAG_KEY) === 'true';
    const activeAgency = sessionStorage.getItem(ACTIVE_AGENCY_KEY);
    return Boolean(isAuth && activeAgency);
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
  }): Promise<{ success: boolean; agent: AgentAccount; message: string }> {
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

    // Check if legacy single-tenant DB had data and copy it over if this new DB is empty
    try {
      await this.maybeMigrateLegacyData(agencyCode);
    } catch (e) {
      console.warn('Legacy migration notice:', e);
    }

    // Attempt online registration with Cloudflare D1
    try {
      await d1SyncService.authenticate(agencyCode, pin, agentName);
    } catch {
      // Offline mode works seamlessly
    }

    // Set active session
    sessionStorage.setItem(ACTIVE_AGENCY_KEY, agencyCode);
    sessionStorage.setItem(AUTH_FLAG_KEY, 'true');
    sessionStorage.setItem(UNLOCKED_KEY, 'true');

    return {
      success: true,
      agent: newAgent,
      message: `Account created successfully for Agent ${agencyCode}!`,
    };
  },

  /**
   * Log in an agent using their Agency Code and 4-digit PIN
   */
  async login(
    agencyCodeInput: string,
    pinInput: string
  ): Promise<{ success: boolean; agent: AgentAccount; restoredFromCloud?: boolean }> {
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

      // Set active session
      sessionStorage.setItem(ACTIVE_AGENCY_KEY, agencyCode);
      sessionStorage.setItem(AUTH_FLAG_KEY, 'true');
      sessionStorage.setItem(UNLOCKED_KEY, 'true');

      return { success: true, agent: localAgent };
    }

    // Not found locally: Check Cloudflare D1 (e.g. re-install or new device)
    try {
      const authResult = await d1SyncService.authenticate(agencyCode, pin);
      if (authResult) {
        const salt = generateSalt();
        const pinHash = await hashPin(pin, salt);
        const now = new Date().toISOString();

        const restoredAgent: AgentAccount = {
          agencyCode,
          agentName: `Agent ${agencyCode}`,
          mobileNumber: '',
          pinHash,
          pinSalt: saltToHex(salt),
          createdAt: now,
          lastLoginAt: now,
        };

        agents.push(restoredAgent);
        this.saveRegisteredAgents(agents);
        switchAgentDatabase(agencyCode);

        // Pull policies & customers from Cloudflare D1
        await d1SyncService.pullFromCloud(agencyCode, pin);

        sessionStorage.setItem(ACTIVE_AGENCY_KEY, agencyCode);
        sessionStorage.setItem(AUTH_FLAG_KEY, 'true');
        sessionStorage.setItem(UNLOCKED_KEY, 'true');

        return { success: true, agent: restoredAgent, restoredFromCloud: true };
      }
    } catch {
      // Fall through to not found error
    }

    throw new Error(
      `Agency Code "${agencyCode}" was not found. Please click "Register New Agent" to create your personal account.`
    );
  },

  /**
   * Log out of current agent workspace
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ACTIVE_AGENCY_KEY);
      sessionStorage.removeItem(AUTH_FLAG_KEY);
      sessionStorage.removeItem(UNLOCKED_KEY);
      localStorage.removeItem(ACTIVE_AGENCY_KEY);
    }
  },

  /**
   * Migrate legacy data if existing DB has records and new agent DB is empty
   */
  async maybeMigrateLegacyData(agencyCode: string): Promise<void> {
    const legacyDb = getDatabase(''); // Default single-tenant DB
    const agentDb = getDatabase(agencyCode);

    const agentPolicyCount = await agentDb.policies.count();
    if (agentPolicyCount > 0) return; // Agent already has data

    const legacyPolicyCount = await legacyDb.policies.count();
    if (legacyPolicyCount === 0) return; // No legacy data to copy

    // Copy legacy policies, customers, and reminders
    const [policies, customers, reminders] = await Promise.all([
      legacyDb.policies.toArray(),
      legacyDb.customers.toArray(),
      legacyDb.reminders.toArray(),
    ]);

    await agentDb.transaction('rw', [agentDb.policies, agentDb.customers, agentDb.reminders], async () => {
      await agentDb.policies.bulkAdd(policies);
      await agentDb.customers.bulkAdd(customers);
      await agentDb.reminders.bulkAdd(reminders);
    });
  },
};
