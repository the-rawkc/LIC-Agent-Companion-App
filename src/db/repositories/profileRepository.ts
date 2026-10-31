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
    if (!saved) {
      // Check if agency_code or agent_name exists in legacy settings
      const legacyCode = await settingsRepository.get<string>('agency_code', '');
      const legacyName = await settingsRepository.get<string>('agent_name', '');
      return {
        ...DEFAULT_PROFILE,
        agencyCode: legacyCode || DEFAULT_PROFILE.agencyCode,
        fullName: legacyName || DEFAULT_PROFILE.fullName,
      };
    }
    return {
      ...DEFAULT_PROFILE,
      ...saved,
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
