import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsePlanTermPpt,
  calculateMaturityDate,
  getPolicyMaturityDate,
  getPolicyLifecycleStatus,
} from '@/utils/formatters';
import { commissionBillService } from '@/services/commission/commissionBillService';
import { db } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import type { Policy, RawCommissionRow } from '@/types';

describe('Policy Lifecycle Status & Term Maturity Calculation Suite', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.auditLogs.clear();
    await db.appSettings.clear();
  });

  describe('parsePlanTermPpt', () => {
    it('parses hyphenated and slashed plan strings correctly', () => {
      expect(parsePlanTermPpt('833-22')).toEqual({ planCode: '833', term: 22, ppt: 22 });
      expect(parsePlanTermPpt('815-21')).toEqual({ planCode: '815', term: 21, ppt: 21 });
      expect(parsePlanTermPpt('736/16/10')).toEqual({ planCode: '736', term: 16, ppt: 10 });
      expect(parsePlanTermPpt('717/1/1')).toEqual({ planCode: '717', term: 1, ppt: 1 });
      expect(parsePlanTermPpt('814')).toEqual({ planCode: '814', term: null, ppt: null });
      expect(parsePlanTermPpt('')).toEqual({ planCode: '', term: null, ppt: null });
    });
  });

  describe('calculateMaturityDate', () => {
    it('calculates Date of Maturity by adding term years to commencement date', () => {
      // 15/09/2018 + 22 years = 15/09/2040
      expect(calculateMaturityDate('2018-09-15', 22)).toBe('2040-09-15');
      // 28/02/2019 + 21 years = 28/02/2040
      expect(calculateMaturityDate('2019-02-28', 21)).toBe('2040-02-28');
      // 15/11/2000 + 16 years = 15/11/2016
      expect(calculateMaturityDate('2000-11-15', 16)).toBe('2016-11-15');
    });

    it('handles leap year commencement date (Feb 29) transitioning to non-leap year (Feb 28)', () => {
      // 2020 is leap year. 2020-02-29 + 21 years = 2041 (non-leap year, max 28 days)
      expect(calculateMaturityDate('2020-02-29', 21)).toBe('2041-02-28');
      // 2020-02-29 + 20 years = 2040 (leap year) -> 2040-02-29
      expect(calculateMaturityDate('2020-02-29', 20)).toBe('2040-02-29');
    });

    it('returns null for missing or invalid dates / terms', () => {
      expect(calculateMaturityDate(null, 20)).toBeNull();
      expect(calculateMaturityDate('2020-05-10', null)).toBeNull();
      expect(calculateMaturityDate('2020-05-10', 0)).toBeNull();
    });
  });

  describe('getPolicyMaturityDate', () => {
    it('fixes corrupt maturity dates (such as previous buggy 1-year FUP advance)', () => {
      const corruptPolicy = {
        commencementDate: '2018-09-15',
        originalPlanString: '833-22',
        term: 22,
        maturityDate: '2019-09-15', // Wrongly set to 1 year ahead
      };
      // Must recalculate to 2040-09-15 using term 22
      expect(getPolicyMaturityDate(corruptPolicy)).toBe('2040-09-15');
    });

    it('preserves valid stored maturity date', () => {
      const validPolicy = {
        commencementDate: '2018-09-15',
        originalPlanString: '833-22',
        term: 22,
        maturityDate: '2040-09-15',
      };
      expect(getPolicyMaturityDate(validPolicy)).toBe('2040-09-15');
    });
  });

  describe('getPolicyLifecycleStatus', () => {
    it('detects claimed, surrendered, matured, due, and active policies correctly', () => {
      expect(getPolicyLifecycleStatus({ recordStatus: 'claimed' })).toBe('claimed');
      expect(getPolicyLifecycleStatus({ recordStatus: 'surrendered' })).toBe('surrendered');
      expect(getPolicyLifecycleStatus({ recordStatus: 'surendered' })).toBe('surrendered');

      // Matured due to maturity date passed (e.g. 2016-11-15)
      expect(
        getPolicyLifecycleStatus({
          recordStatus: 'active',
          maturityDate: '2016-11-15',
          commencementDate: '2000-11-15',
          firstUnpaidPremiumDate: '2026-05-01',
        })
      ).toBe('matured');

      // Due because FUP has arrived or is in past (e.g. 2026-01-01)
      expect(
        getPolicyLifecycleStatus({
          recordStatus: 'active',
          maturityDate: '2040-11-15',
          firstUnpaidPremiumDate: '2026-01-01',
        })
      ).toBe('due');

      // Active because FUP is in future and maturity date is in future
      expect(
        getPolicyLifecycleStatus({
          recordStatus: 'active',
          maturityDate: '2040-11-15',
          firstUnpaidPremiumDate: '2028-01-01',
        })
      ).toBe('active');
    });
  });

  describe('Commission Bill New Policy Creation & Last Bill Labeling', () => {
    it('creates policies with only real bill values and no random numbers or fake sum assured', async () => {
      const billRows: RawCommissionRow[] = [
        {
          sNo: '101',
          phName: 'AMIT SHARMA',
          policyNo: '998877665',
          planTerm: '815-21',
          dueDt: '15/05/2026',
          riskDate: '15/05/2019',
          premium: '4500.00',
          commission: '225.00',
        },
      ];

      const preview = await commissionBillService.preparePreview(billRows);
      expect(preview.length).toBe(1);
      expect(preview[0].status).toBe('not_in_db');

      const commitResult = await commissionBillService.commitUpdates(preview);
      expect(commitResult.createdCount).toBe(1);

      const created = await policyRepository.getByPolicyNumber('998877665');
      expect(created).toBeDefined();
      expect(created?.policyNumber).toBe('998877665');
      expect(created?.customerName).toBe('AMIT SHARMA');
      expect(created?.planCode).toBe('815');
      expect(created?.term).toBe(21);
      expect(created?.premiumPayingTerm).toBe(21);
      // Sum assured is not present in bill -> must be 0, NOT multiplied by 10 or hardcoded 200000!
      expect(created?.sumAssured).toBe(0);
      expect(created?.premiumAmount).toBe(4500);
      expect(created?.commencementDate).toBe('2019-05-15');
      // Maturity date must be calculated with the term 21: 2019 + 21 = 2040-05-15!
      expect(created?.maturityDate).toBe('2040-05-15');

      // Verify that this policy is in last_added_batch
      const lastBatchSetting = await db.appSettings.get('last_added_batch');
      expect(lastBatchSetting?.value).toBeDefined();
      const batchVal = lastBatchSetting?.value as any;
      expect(batchVal.count).toBe(1);
      expect(batchVal.policyNumbers).toContain('998877665');

      // Now simulate uploading a NEXT commission bill that contains NO new policies (only existing updates)
      const nextBillRows: RawCommissionRow[] = [
        {
          sNo: '1',
          phName: 'AMIT SHARMA',
          policyNo: '998877665',
          dueDt: '15/11/2026',
          premium: '4500.00',
          commission: '225.00',
        },
      ];

      const nextPreview = await commissionBillService.preparePreview(nextBillRows);
      const nextCommitResult = await commissionBillService.commitUpdates(nextPreview);
      expect(nextCommitResult.updatedCount).toBe(1);
      expect(nextCommitResult.createdCount).toBe(0);

      // The new bill had 0 new policies -> old "new" labels must be removed!
      const updatedBatchSetting = await db.appSettings.get('last_added_batch');
      const updatedBatchVal = updatedBatchSetting?.value as any;
      expect(updatedBatchVal.count).toBe(0);
      expect(updatedBatchVal.policyNumbers).toEqual([]);
    });
  });
});
