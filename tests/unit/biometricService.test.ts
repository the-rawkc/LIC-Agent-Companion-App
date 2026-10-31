import { describe, it, expect, beforeEach } from 'vitest';
import { biometricService } from '@/services/security/biometricService';

describe('Biometric Authentication Service (Fingerprint / WebAuthn)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('checks hardware availability without throwing errors', async () => {
    const isAvail = await biometricService.isHardwareAvailable();
    expect(typeof isAvail).toBe('boolean');
  });

  it('reports biometrics as disabled by default for new agency codes', () => {
    expect(biometricService.isBiometricEnabled('03847291')).toBe(false);
  });

  it('stores and clears biometric state cleanly', () => {
    localStorage.setItem('lic_biometrics_enabled_03847291', 'true');
    localStorage.setItem('lic_biometrics_last_agency', '03847291');

    expect(biometricService.isBiometricEnabled('03847291')).toBe(true);
    expect(biometricService.getLastBiometricAgencyCode()).toBe('03847291');

    biometricService.disableBiometrics('03847291');
    expect(biometricService.isBiometricEnabled('03847291')).toBe(false);
    expect(biometricService.getLastBiometricAgencyCode()).toBeNull();
  });

  it('throws an informative error if verifyBiometrics is called with no enrolled agency', async () => {
    await expect(biometricService.verifyBiometrics('')).rejects.toThrow(
      /No Agency Code enrolled for biometric access/
    );
  });
});
