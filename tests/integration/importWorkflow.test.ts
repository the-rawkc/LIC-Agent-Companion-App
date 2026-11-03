import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { importService } from '@/services/import/importService';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { SAMPLE_RAW_POLICY_ROWS } from '@/services/sampleData/licSampleRecords';

describe('Import & Rollback Workflow', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.reminders.clear();
    await db.importHistory.clear();
    await db.auditLogs.clear();
  });

  it('runs complete import preview and transactional commit', async () => {
    // 1. Prepare preview
    const preview = await importService.preparePreview(SAMPLE_RAW_POLICY_ROWS, 76, []);
    expect(preview.totalRowsDetected).toBe(SAMPLE_RAW_POLICY_ROWS.length);
    expect(preview.readyToImportCount + preview.requiringReviewCount).toBe(SAMPLE_RAW_POLICY_ROWS.length);

    // 2. Commit import
    const result = await importService.commitImport({
      filename: 'LIC_Agent_Report_2026.pdf',
      reportDate: '2026-10-29',
      rows: preview.rows,
      duplicateHandling: 'update',
    });

    expect(result.createdCount).toBe(SAMPLE_RAW_POLICY_ROWS.length);
    expect(result.newCustomersCount).toBeGreaterThan(0);

    // 3. Verify in database
    const dbPolicies = await policyRepository.getAll();
    expect(dbPolicies.length).toBe(SAMPLE_RAW_POLICY_ROWS.length);

    const dbCustomers = await customerRepository.getAll();
    expect(dbCustomers.length).toBeGreaterThan(0);

    // 4. Repeat import with 'skip' should detect duplicates and skip
    const secondPreview = await importService.preparePreview(SAMPLE_RAW_POLICY_ROWS, 76, []);
    expect(secondPreview.potentialDuplicateCount).toBe(SAMPLE_RAW_POLICY_ROWS.length);

    const secondResult = await importService.commitImport({
      filename: 'LIC_Agent_Report_2026_Repeat.pdf',
      reportDate: '2026-10-29',
      rows: secondPreview.rows,
      duplicateHandling: 'skip',
    });

    expect(secondResult.skippedCount).toBe(SAMPLE_RAW_POLICY_ROWS.length);
    expect(secondResult.createdCount).toBe(0);

    // 5. Test Rollback
    const rollbackRes = await importService.rollbackImport(result.importId);
    expect(rollbackRes.deletedPolicies).toBe(SAMPLE_RAW_POLICY_ROWS.length);

    const afterRollbackPolicies = await policyRepository.getAll();
    expect(afterRollbackPolicies.length).toBe(0);
  }, 15000);
});
