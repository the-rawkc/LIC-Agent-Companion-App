import { db } from '@/db/database';
import { formatDate } from '@/utils/formatters';
import type { Policy, Customer, Reminder, ImportHistory, AuditLog } from '@/types';

export interface BackupPayload {
  version: number;
  exportDate: string;
  sourceApp: string;
  data: {
    policies: Policy[];
    customers: Customer[];
    reminders: Reminder[];
    importHistory: ImportHistory[];
    auditLogs: AuditLog[];
  };
}

export interface EncryptedBackupContainer {
  encrypted: true;
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  exportDate: string;
}

export const backupService = {
  /**
   * Generates a complete backup payload of all IndexedDB tables
   */
  async generateBackupPayload(): Promise<BackupPayload> {
    const [policies, customers, reminders, importHistory, auditLogs] = await Promise.all([
      db.policies.toArray(),
      db.customers.toArray(),
      db.reminders.toArray(),
      db.importHistory.toArray(),
      db.auditLogs.toArray(),
    ]);

    return {
      version: 1,
      exportDate: new Date().toISOString(),
      sourceApp: 'LIC Agent Companion',
      data: {
        policies,
        customers,
        reminders,
        importHistory,
        auditLogs,
      },
    };
  },

  /**
   * Export unencrypted JSON file
   */
  async exportJsonBackup(): Promise<string> {
    const payload = await this.generateBackupPayload();
    return JSON.stringify(payload, null, 2);
  },

  /**
   * Export encrypted backup with password using Web Crypto AES-GCM + PBKDF2
   */
  async exportEncryptedBackup(password: string): Promise<string> {
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }

    const payload = await this.generateBackupPayload();
    const plaintext = JSON.stringify(payload);
    const enc = new TextEncoder();

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
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
      false,
      ['encrypt']
    );

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    const bufferToHex = (buf: Uint8Array | ArrayBuffer) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const container: EncryptedBackupContainer = {
      encrypted: true,
      version: 1,
      salt: bufferToHex(salt),
      iv: bufferToHex(iv),
      ciphertext: bufferToHex(ciphertextBuffer),
      exportDate: payload.exportDate,
    };

    return JSON.stringify(container, null, 2);
  },

  /**
   * Decrypt and validate encrypted backup
   */
  async decryptBackup(backupContent: string, password: string): Promise<BackupPayload> {
    let container: EncryptedBackupContainer;
    try {
      container = JSON.parse(backupContent);
    } catch {
      throw new Error('Invalid backup file format');
    }

    if (!container.encrypted || !container.salt || !container.iv || !container.ciphertext) {
      throw new Error('File is not a valid encrypted backup');
    }

    const hexToBytes = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return bytes;
    };

    const salt = hexToBytes(container.salt);
    const iv = hexToBytes(container.iv);
    const ciphertext = hexToBytes(container.ciphertext);

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
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
      false,
      ['decrypt']
    );

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted)) as BackupPayload;
    } catch {
      throw new Error('Incorrect password or corrupted backup file');
    }
  },

  /**
   * Validate raw or decrypted backup payload before restoration
   */
  validatePayload(payload: unknown): payload is BackupPayload {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Partial<BackupPayload>;
    return (
      typeof p.version === 'number' &&
      typeof p.data === 'object' &&
      Array.isArray(p.data?.policies) &&
      Array.isArray(p.data?.customers)
    );
  },

  /**
   * Restore backup into database (replace existing)
   */
  async restoreBackup(payload: BackupPayload): Promise<{ policiesCount: number; customersCount: number }> {
    if (!this.validatePayload(payload)) {
      throw new Error('Invalid backup structure');
    }

    await db.transaction('rw', [db.policies, db.customers, db.reminders, db.importHistory, db.auditLogs], async () => {
      // Clear existing
      await Promise.all([
        db.policies.clear(),
        db.customers.clear(),
        db.reminders.clear(),
        db.importHistory.clear(),
        db.auditLogs.clear(),
      ]);

      // Bulk add
      if (payload.data.customers.length > 0) {
        await db.customers.bulkAdd(payload.data.customers);
      }
      if (payload.data.policies.length > 0) {
        await db.policies.bulkAdd(payload.data.policies);
      }
      if (payload.data.reminders.length > 0) {
        await db.reminders.bulkAdd(payload.data.reminders);
      }
      if (payload.data.importHistory.length > 0) {
        await db.importHistory.bulkAdd(payload.data.importHistory);
      }
      if (payload.data.auditLogs.length > 0) {
        await db.auditLogs.bulkAdd(payload.data.auditLogs);
      }

      await db.auditLogs.add({
        id: crypto.randomUUID(),
        entityType: 'import',
        entityId: 'backup-restore',
        action: 'import',
        timestamp: new Date().toISOString(),
        summary: `Restored backup dated ${formatDate(payload.exportDate)}. Loaded ${payload.data.policies.length} policies and ${payload.data.customers.length} customers.`,
      });
    });

    return {
      policiesCount: payload.data.policies.length,
      customersCount: payload.data.customers.length,
    };
  },

  /**
   * Export policies as CSV
   */
  async exportPoliciesToCsv(): Promise<string> {
    const policies = await db.policies.toArray();
    const headers = [
      'Policy Number',
      'Customer Name',
      'Plan/Term/PPT',
      'Sum Assured',
      'D.O.C.',
      'Mode',
      'F.U.P.',
      'Premium',
      'D.O.M.',
      'DOB',
      'Status',
    ];

    const escapeCsv = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = policies.map((p) => [
      escapeCsv(p.policyNumber),
      escapeCsv(p.customerName),
      escapeCsv(p.originalPlanString),
      escapeCsv(p.sumAssured),
      escapeCsv(formatDate(p.commencementDate)),
      escapeCsv(p.premiumMode),
      escapeCsv(formatDate(p.firstUnpaidPremiumDate)),
      escapeCsv(p.premiumAmount),
      escapeCsv(formatDate(p.maturityDate)),
      escapeCsv(p.dateOfBirth ? formatDate(p.dateOfBirth) : '00/00/0000'),
      escapeCsv(p.recordStatus),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
};
