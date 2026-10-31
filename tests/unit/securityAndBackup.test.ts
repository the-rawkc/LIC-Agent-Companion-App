import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { hashPin, generateSalt } from '@/services/security/pinService';
import { backupService } from '@/services/backup/backupService';
import { policyRepository } from '@/db/repositories/policyRepository';
import type { Policy } from '@/types';

describe('Security, Encryption & Backup Pipeline', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.reminders.clear();
    await db.importHistory.clear();
    await db.auditLogs.clear();
  });

  it('hashes PIN using PBKDF2 with salt consistently', async () => {
    const pin = '1234';
    const salt = generateSalt();

    const hash1 = await hashPin(pin, salt);
    const hash2 = await hashPin(pin, salt);
    expect(hash1).toBe(hash2);

    const wrongHash = await hashPin('4321', salt);
    expect(wrongHash).not.toBe(hash1);
  });

  it('encrypts and successfully decrypts backup payload with AES-GCM', async () => {
    // Add sample policy to DB
    const policy: Policy = {
      id: 'pol-backup-test',
      policyNumber: '242647587',
      customerId: 'cust-1',
      customerName: 'Rajesh Kumar',
      planCode: '749',
      term: 15,
      premiumPayingTerm: 1,
      originalPlanString: '749/15/01',
      sumAssured: 181250,
      commencementDate: '2026-06-30',
      premiumMode: 'Single',
      firstUnpaidPremiumDate: '2027-06-30',
      premiumAmount: 145000,
      maturityDate: '2041-06-30',
      dateOfBirth: null,
      sourceSerialNumber: 1,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await policyRepository.create(policy);

    const password = 'SuperSecretAgentKey2026';
    const encryptedJson = await backupService.exportEncryptedBackup(password);

    // Verify container
    const container = JSON.parse(encryptedJson);
    expect(container.encrypted).toBe(true);
    expect(container.ciphertext).toBeDefined();
    expect(container.salt).toBeDefined();
    expect(container.iv).toBeDefined();

    // Decrypt with correct password
    const decryptedPayload = await backupService.decryptBackup(encryptedJson, password);
    expect(decryptedPayload.data.policies.length).toBe(1);
    expect(decryptedPayload.data.policies[0].policyNumber).toBe('242647587');

    // Decrypt with wrong password should fail
    await expect(backupService.decryptBackup(encryptedJson, 'WrongPassword')).rejects.toThrow();
  });

  it('formats policy records into clean CSV with headers', async () => {
    const policy: Policy = {
      id: 'pol-csv-test',
      policyNumber: '242647527',
      customerId: 'cust-2',
      customerName: 'VEER SINGH',
      planCode: '736',
      term: 15,
      premiumPayingTerm: 0,
      originalPlanString: '736/15/0',
      sumAssured: 0,
      commencementDate: '2026-06-28',
      premiumMode: 'NF',
      firstUnpaidPremiumDate: '2026-06-28',
      premiumAmount: 12021,
      maturityDate: '2041-06-28',
      dateOfBirth: null,
      sourceSerialNumber: 2,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await policyRepository.create(policy);

    const csv = await backupService.exportPoliciesToCsv();
    expect(csv).toContain('Policy Number,Customer Name,Plan/Term/PPT,Sum Assured');
    expect(csv).toContain('"242647527","VEER SINGH","736/15/0"');
  });
});
