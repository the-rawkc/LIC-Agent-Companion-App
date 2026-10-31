import { getActiveAgencyCode } from '@/db/database';

export interface BiometricStatus {
  isSupported: boolean;
  isEnabled: boolean;
  agencyCode: string | null;
}

const BIOMETRIC_ENABLED_PREFIX = 'lic_biometrics_enabled_';
const BIOMETRIC_CRED_PREFIX = 'lic_biometrics_cred_';
const BIOMETRIC_LAST_AGENCY_KEY = 'lic_biometrics_last_agency';

export const biometricService = {
  /**
   * Check if device hardware supports biometric authentication (Fingerprint / Touch ID / Face ID / Windows Hello)
   */
  async isHardwareAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!window.PublicKeyCredential || !navigator.credentials) return false;

    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Check if biometrics is enabled for an agency or on this device
   */
  isBiometricEnabled(agencyCode?: string): boolean {
    if (typeof window === 'undefined') return false;
    const targetCode = agencyCode || getActiveAgencyCode() || localStorage.getItem(BIOMETRIC_LAST_AGENCY_KEY);
    if (!targetCode) return false;
    return localStorage.getItem(`${BIOMETRIC_ENABLED_PREFIX}${targetCode.toUpperCase()}`) === 'true';
  },

  /**
   * Get the last agency code that enrolled in biometrics on this device
   */
  getLastBiometricAgencyCode(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(BIOMETRIC_LAST_AGENCY_KEY);
  },

  /**
   * Register device biometric authenticator (Fingerprint / Face ID / Platform Authenticator)
   */
  async registerBiometrics(agencyCode: string, agentName?: string): Promise<{ success: boolean; credentialId: string }> {
    const sanitizedCode = agencyCode.trim().toUpperCase();

    // Check availability
    const available = await this.isHardwareAvailable();
    if (!available) {
      throw new Error('Biometric hardware (Fingerprint scanner / Face unlock) is not available on this device or browser.');
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = new TextEncoder().encode(sanitizedCode);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'LIC Agent Companion',
            id: window.location.hostname || 'localhost',
          },
          user: {
            id: userId,
            name: sanitizedCode,
            displayName: agentName || `Agent ${sanitizedCode}`,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Platform = Device Fingerprint / Face ID / Windows Hello
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Biometric registration was canceled.');
      }

      const credId = Array.from(new Uint8Array(credential.rawId))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      localStorage.setItem(`${BIOMETRIC_CRED_PREFIX}${sanitizedCode}`, credId);
      localStorage.setItem(`${BIOMETRIC_ENABLED_PREFIX}${sanitizedCode}`, 'true');
      localStorage.setItem(BIOMETRIC_LAST_AGENCY_KEY, sanitizedCode);

      return { success: true, credentialId: credId };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Biometric registration was canceled or timed out.');
      }
      throw new Error(err.message || 'Failed to register biometric credential.');
    }
  },

  /**
   * Verify biometric identity (prompts native Fingerprint scanner / Face unlock)
   */
  async verifyBiometrics(agencyCodeInput?: string): Promise<{ success: boolean; agencyCode: string }> {
    const targetCode = (agencyCodeInput || getActiveAgencyCode() || localStorage.getItem(BIOMETRIC_LAST_AGENCY_KEY) || '').trim().toUpperCase();

    if (!targetCode) {
      throw new Error('No Agency Code enrolled for biometric access.');
    }

    const available = await this.isHardwareAvailable();
    if (!available) {
      throw new Error('Biometric hardware is not available on this device.');
    }

    const savedCredId = localStorage.getItem(`${BIOMETRIC_CRED_PREFIX}${targetCode}`);

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      // Build allowCredentials if known
      const allowCredentials: PublicKeyCredentialDescriptor[] = [];
      if (savedCredId) {
        const bytes = new Uint8Array(savedCredId.length / 2);
        for (let i = 0; i < savedCredId.length; i += 2) {
          bytes[i / 2] = parseInt(savedCredId.substring(i, i + 2), 16);
        }
        allowCredentials.push({
          id: bytes,
          type: 'public-key',
        });
      }

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname || 'localhost',
          userVerification: 'required',
          allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
          timeout: 60000,
        },
      });

      if (!assertion) {
        throw new Error('Fingerprint verification was canceled.');
      }

      // Mark session as unlocked
      sessionStorage.setItem('lic_app_unlocked', 'true');

      return { success: true, agencyCode: targetCode };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Fingerprint verification was canceled or not recognized.');
      }
      throw new Error(err.message || 'Biometric authentication failed.');
    }
  },

  /**
   * Disable biometric authentication for an agency
   */
  disableBiometrics(agencyCode?: string): void {
    if (typeof window === 'undefined') return;
    const targetCode = agencyCode || getActiveAgencyCode() || localStorage.getItem(BIOMETRIC_LAST_AGENCY_KEY);
    if (!targetCode) return;
    const sanitized = targetCode.trim().toUpperCase();
    localStorage.removeItem(`${BIOMETRIC_CRED_PREFIX}${sanitized}`);
    localStorage.removeItem(`${BIOMETRIC_ENABLED_PREFIX}${sanitized}`);
    if (localStorage.getItem(BIOMETRIC_LAST_AGENCY_KEY) === sanitized) {
      localStorage.removeItem(BIOMETRIC_LAST_AGENCY_KEY);
    }
  },
};
