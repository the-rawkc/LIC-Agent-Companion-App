import { settingsRepository } from '@/db/repositories/settingsRepository';

/**
 * Hash PIN using Web Crypto API PBKDF2-HMAC-SHA256
 */
export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function saltToHex(salt: Uint8Array): string {
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToSalt(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export const pinService = {
  async isPinConfigured(): Promise<boolean> {
    const isEnabled = await settingsRepository.get<boolean>('isPinEnabled', false);
    const pinHash = await settingsRepository.get<string>('pinHash', '');
    return Boolean(isEnabled && pinHash);
  },

  async setupPin(pin: string): Promise<void> {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);

    await settingsRepository.set('pinHash', hash);
    await settingsRepository.set('pinSalt', saltToHex(salt));
    await settingsRepository.set('isPinEnabled', true);
    sessionStorage.setItem('lic_app_unlocked', 'true');
  },

  async verifyPin(pin: string): Promise<boolean> {
    const storedHash = await settingsRepository.get<string>('pinHash', '');
    const storedSaltHex = await settingsRepository.get<string>('pinSalt', '');
    if (!storedHash || !storedSaltHex) return false;

    const salt = hexToSalt(storedSaltHex);
    const computedHash = await hashPin(pin, salt);

    if (computedHash === storedHash) {
      sessionStorage.setItem('lic_app_unlocked', 'true');
      return true;
    }
    return false;
  },

  async disablePin(): Promise<void> {
    await settingsRepository.set('isPinEnabled', false);
    await settingsRepository.set('pinHash', '');
    await settingsRepository.set('pinSalt', '');
    sessionStorage.removeItem('lic_app_unlocked');
  },

  isSessionUnlocked(): boolean {
    return sessionStorage.getItem('lic_app_unlocked') === 'true';
  },

  lockSession(): void {
    sessionStorage.removeItem('lic_app_unlocked');
  }
};
