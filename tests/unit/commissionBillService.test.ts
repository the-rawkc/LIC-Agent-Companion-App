import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { commissionBillService } from '@/services/commission/commissionBillService';
import { SAMPLE_COMMISSION_ROWS } from '@/services/sampleData/licSampleCommissionBill';
import { generateUUID } from '@/utils/formatters';
import type { Policy, Customer } from '@/types';

describe('Commission Bill Service FUP Update Suite', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.auditLogs.clear();

    // Create a customer
    const customer: Customer = {
      id: 'cust-priyanshu',
      displayName: 'Priyanshu Ruhela',
      normalizedName: 'priyanshu ruhela',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.customers.add(customer);

    // Create policy matching the sample bill row 1:
    // Policy: 208793226, Mode: Half-Yearly, Current FUP: 2026-09-15
    const policy1: Policy = {
      id: 'pol-208793226',
      policyNumber: '208793226',
      customerId: customer.id,
      customerName: 'Priyanshu Ruhela',
      planCode: '833',
      term: 22,
      premiumPayingTerm: 22,
      originalPlanString: '833-22',
      sumAssured: 500000,
      commencementDate: '2018-09-15',
      premiumMode: 'Half-Yearly',
      firstUnpaidPremiumDate: '2026-09-15', // Due date about to be paid
      premiumAmount: 16664.0,
      maturityDate: '2040-09-15',
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
    await db.policies.add(policy1);

    // Create policy matching row 7:
    // Policy: 229066194, Mode: Yearly, Current FUP: 2026-04-28
    const policy7: Policy = {
      id: 'pol-229066194',
      policyNumber: '229066194',
      customerId: customer.id,
      customerName: 'Raj Kumar',
      planCode: '915',
      term: 16,
      premiumPayingTerm: 16,
      originalPlanString: '915-16',
      sumAssured: 200000,
      commencementDate: '2020-04-28',
      premiumMode: 'Yearly',
      firstUnpaidPremiumDate: '2026-04-28',
      premiumAmount: 5748.0,
      maturityDate: '2036-04-28',
      dateOfBirth: null,
      sourceSerialNumber: 7,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'lapsed', // Previously lapsed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.policies.add(policy7);
  });

  it('previews commission bill items, finds DB records, and calculates next FUP based on mode', async () => {
    const preview = await commissionBillService.preparePreview(SAMPLE_COMMISSION_ROWS);

    expect(preview.length).toBe(11);

    // Check policy 208793226 (Priyanshu Ruhela, Half-Yearly)
    const item1 = preview.find((i) => i.policyNo === '208793226');
    expect(item1).toBeDefined();
    expect(item1?.policyFoundInDb).toBe(true);
    expect(item1?.paidDueDate).toBe('2026-09-15');
    expect(item1?.mode).toBe('Half-Yearly');
    // From 2026-09-15 + 6 months -> 2027-03-15
    expect(item1?.calculatedNewFup).toBe('2027-03-15');
    expect(item1?.status).toBe('ready_to_update');
    expect(item1?.selected).toBe(true);

    // Check policy 229066194 (Raj Kumar, Yearly)
    const item7 = preview.find((i) => i.policyNo === '229066194');
    expect(item7).toBeDefined();
    expect(item7?.policyFoundInDb).toBe(true);
    expect(item7?.paidDueDate).toBe('2026-04-28');
    expect(item7?.mode).toBe('Yearly');
    // From 2026-04-28 + 12 months -> 2027-04-28
    expect(item7?.calculatedNewFup).toBe('2027-04-28');
    expect(item7?.status).toBe('ready_to_update');

    // Check an unindexed policy from sample rows (not in DB)
    const item2 = preview.find((i) => i.policyNo === '208841753');
    expect(item2).toBeDefined();
    expect(item2?.policyFoundInDb).toBe(false);
    expect(item2?.status).toBe('not_in_db');
  });

  it('recalculates projected next FUP dynamically when mode changes in UI', async () => {
    const preview = await commissionBillService.preparePreview(SAMPLE_COMMISSION_ROWS);
    const item1 = preview.find((i) => i.policyNo === '208793226')!;

    // Initial Half-Yearly -> 2027-03-15
    expect(item1.calculatedNewFup).toBe('2027-03-15');

    // Change to Quarterly -> should be 2026-12-15 (+3 months)
    const quarterlyItem = commissionBillService.recalculateItemMode(item1, 'Quarterly');
    expect(quarterlyItem.calculatedNewFup).toBe('2026-12-15');

    // Change to Yearly -> should be 2027-09-15 (+12 months)
    const yearlyItem = commissionBillService.recalculateItemMode(item1, 'Yearly');
    expect(yearlyItem.calculatedNewFup).toBe('2027-09-15');

    // Change to Monthly -> should be 2026-10-15 (+1 month)
    const monthlyItem = commissionBillService.recalculateItemMode(item1, 'Monthly');
    expect(monthlyItem.calculatedNewFup).toBe('2026-10-15');
  });

  it('commits FUP updates into IndexedDB, updates policy status to active, and creates audit log', async () => {
    const preview = await commissionBillService.preparePreview(SAMPLE_COMMISSION_ROWS);

    // Commit only selected items (item1 and item7)
    const result = await commissionBillService.commitUpdates(preview);

    expect(result.updatedCount).toBe(2);

    // Verify policy 208793226 in DB
    const updated1 = await policyRepository.getByPolicyNumber('208793226');
    expect(updated1).toBeDefined();
    expect(updated1?.firstUnpaidPremiumDate).toBe('2027-03-15');

    // Verify policy 229066194 in DB (was lapsed, now active)
    const updated7 = await policyRepository.getByPolicyNumber('229066194');
    expect(updated7).toBeDefined();
    expect(updated7?.firstUnpaidPremiumDate).toBe('2027-04-28');
    expect(updated7?.recordStatus).toBe('active');

    // Verify audit logs were created
    const logs = await db.auditLogs.toArray();
    expect(logs.length).toBeGreaterThanOrEqual(2);
    const log1 = logs.find((l) => l.entityId === 'pol-208793226');
    expect(log1).toBeDefined();
    expect(log1?.summary).toContain('2027-03-15');
  });

  it('always picks the latest DueDt when a policy appears multiple times in the uploaded file', async () => {
    // A single file contains 3 separate installment rows for policy 208793226:
    // March 2026, September 2026, and June 2026
    const multipleRows = [
      {
        sNo: '1',
        phName: 'Priyanshu Ruhela',
        policyNo: '208793226',
        planTerm: '833-22',
        dueDt: '15/03/2026',
        riskDate: '15/09/2018',
        premium: '16664.00',
        commission: '833.20',
      },
      {
        sNo: '2',
        phName: 'Priyanshu Ruhela',
        policyNo: '208793226',
        planTerm: '833-22',
        dueDt: '15/09/2026', // LATEST DATE
        riskDate: '15/09/2018',
        premium: '16664.00',
        commission: '833.20',
      },
      {
        sNo: '3',
        phName: 'Priyanshu Ruhela',
        policyNo: '208793226',
        planTerm: '833-22',
        dueDt: '15/06/2026',
        riskDate: '15/09/2018',
        premium: '16664.00',
        commission: '833.20',
      },
    ];

    const preview = await commissionBillService.preparePreview(multipleRows);

    // Grouped into 1 distinct policy item
    expect(preview.length).toBe(1);
    const item = preview[0];
    expect(item.policyNo).toBe('208793226');
    expect(item.occurrencesInBill).toBe(3);

    // Guaranteed to use the LATEST paid due date (2026-09-15)
    expect(item.paidDueDate).toBe('2026-09-15');
    // Advances from latest date + 6 months -> 2027-03-15
    expect(item.calculatedNewFup).toBe('2027-03-15');

    // Premium & Commission aggregated
    expect(item.premiumAmount).toBe(16664 * 3);
    expect(item.commissionAmount).toBe(833.2 * 3);
  });

  it('protects against overwriting or regressing when commission bills are uploaded multiple times', async () => {
    // 1. Policy 208793226 is currently at 2026-09-15
    // Upload Month 1 bill (DueDt: 15/09/2026) -> updates to 2027-03-15
    const bill1 = [
      {
        sNo: '1',
        phName: 'Priyanshu Ruhela',
        policyNo: '208793226',
        dueDt: '15/09/2026',
        premium: '16664.00',
        commission: '833.20',
      },
    ];
    const preview1 = await commissionBillService.preparePreview(bill1);
    expect(preview1[0].status).toBe('ready_to_update');
    await commissionBillService.commitUpdates(preview1);

    const polAfterBill1 = await policyRepository.getByPolicyNumber('208793226');
    expect(polAfterBill1?.firstUnpaidPremiumDate).toBe('2027-03-15');

    // 2. Upload SAME bill a second time:
    // It detects that the database is already up to date (2027-03-15 >= 2027-03-15)
    const previewDuplicate = await commissionBillService.preparePreview(bill1);
    expect(previewDuplicate[0].status).toBe('already_up_to_date');
    expect(previewDuplicate[0].selected).toBe(false);

    // 3. Upload an OLDER bill (DueDt: 15/03/2026 which calculates to 2026-09-15):
    const olderBill = [
      {
        sNo: '1',
        phName: 'Priyanshu Ruhela',
        policyNo: '208793226',
        dueDt: '15/03/2026',
        premium: '16664.00',
        commission: '833.20',
      },
    ];
    const previewOlder = await commissionBillService.preparePreview(olderBill);
    expect(previewOlder[0].status).toBe('already_up_to_date');
    expect(previewOlder[0].selected).toBe(false);

    // Even if forced selected, commitUpdates refuses to regress the date!
    previewOlder[0].selected = true;
    const resultOlder = await commissionBillService.commitUpdates(previewOlder);
    expect(resultOlder.skippedCount).toBe(1);
    expect(resultOlder.updatedCount).toBe(0);

    // Database still holds the newer date (2027-03-15)
    const polAfterOlder = await policyRepository.getByPolicyNumber('208793226');
    expect(polAfterOlder?.firstUnpaidPremiumDate).toBe('2027-03-15');

    // 4. Upload a NEWER bill (DueDt: 15/03/2027):
    const newerBill = [
      {
        sNo: '1',
        phName: 'Priyanshu Ruhela',
        policyNo: '208793226',
        dueDt: '15/03/2027',
        premium: '16664.00',
        commission: '833.20',
      },
    ];
    const previewNewer = await commissionBillService.preparePreview(newerBill);
    expect(previewNewer[0].status).toBe('ready_to_update');
    expect(previewNewer[0].calculatedNewFup).toBe('2027-09-15');

    await commissionBillService.commitUpdates(previewNewer);
    const polAfterNewer = await policyRepository.getByPolicyNumber('208793226');
    expect(polAfterNewer?.firstUnpaidPremiumDate).toBe('2027-09-15');
  });
});
