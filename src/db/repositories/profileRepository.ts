import { settingsRepository } from './settingsRepository';

export interface AgentProfile {
  fullName: string;
  agencyCode: string;
  branchName: string;
  branchCode: string;
  division: string;
  mobileNumber: string;
  whatsappNumber: string;
  email: string;
  clubMembership: string;
  developmentOfficerName: string;
  developmentOfficerMobile: string;
  agencyStartDate: string;
  officeAddress: string;
  whatsappSignature: string;
  avatarUrl?: string;
  updatedAt: string;
}

export const DEFAULT_PROFILE: AgentProfile = {
  fullName: 'LIC Financial Advisor',
  agencyCode: '',
  branchName: 'Main City Branch',
  branchCode: '',
  division: '',
  mobileNumber: '',
  whatsappNumber: '',
  email: '',
  clubMembership: "Chairman's Club Member",
  developmentOfficerName: '',
  developmentOfficerMobile: '',
  agencyStartDate: '2018-04-01',
  officeAddress: '',
  whatsappSignature: 'With warm regards,\nLIC Life Insurance Advisor\nLife Insurance Corporation of India',
  updatedAt: new Date().toISOString(),
};

export const profileRepository = {
  async getProfile(): Promise<AgentProfile> {
    const saved = await settingsRepository.get<AgentProfile | null>('agent_profile', null);

    // Retrieve active logged in agent account from session/local storage
    let activeAgency = '';
    let activeName = '';
    let activeMobile = '';
    try {
      const stored = localStorage.getItem('lic_companion_current_agent');
      if (stored) {
        const ag = JSON.parse(stored);
        activeAgency = ag.agencyCode || '';
        activeName = ag.agentName && ag.agentName !== 'LIC Advisor' ? ag.agentName : '';
        activeMobile = ag.mobile || '';
      }
    } catch {}

    const legacyCode = await settingsRepository.get<string>('agency_code', '');
    const legacyName = await settingsRepository.get<string>('agent_name', '');

    const resolvedAgency = saved?.agencyCode || activeAgency || legacyCode || DEFAULT_PROFILE.agencyCode;
    const resolvedName =
      saved?.fullName && saved.fullName !== DEFAULT_PROFILE.fullName
        ? saved.fullName
        : activeName || legacyName || DEFAULT_PROFILE.fullName;
    const resolvedMobile = saved?.mobileNumber || activeMobile || DEFAULT_PROFILE.mobileNumber;

    if (!saved) {
      return {
        ...DEFAULT_PROFILE,
        agencyCode: resolvedAgency,
        fullName: resolvedName,
        mobileNumber: resolvedMobile,
        whatsappNumber: resolvedMobile || DEFAULT_PROFILE.whatsappNumber,
      };
    }

    return {
      ...DEFAULT_PROFILE,
      ...saved,
      agencyCode: resolvedAgency,
      fullName: resolvedName,
      mobileNumber: resolvedMobile,
    };
  },

  async saveProfile(profile: Partial<AgentProfile>): Promise<AgentProfile> {
    const current = await this.getProfile();
    const updated: AgentProfile = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString(),
    };

    await settingsRepository.set('agent_profile', updated);

    // Keep legacy keys in sync
    if (updated.agencyCode) {
      await settingsRepository.set('agency_code', updated.agencyCode);
    }
    if (updated.fullName) {
      await settingsRepository.set('agent_name', updated.fullName);
    }

    return updated;
  },
};
