import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePolicyWhatsAppMessage,
  getPolicyLifecycleStatus,
  formatCurrency,
  formatDate
} from '@/utils/formatters';
import { db } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import type { Policy } from '@/types';

describe('WhatsApp Policy Details Sharing & Status Labeling', () => {
  it('generates complete WhatsApp message and labels status as PREMIUM DUE when FUP is past or due', () => {
    const policy: Policy = {
      id: 'test-pol-1',
      policyNumber: '123456789',
      customerName: 'Rajesh Kumar',
      customerId: 'cust-1',
      agencyCode: 'TEST_AGENCY',
      planCode: '833',
      policyTerm: 22,
      premiumPayingTerm: 22,
      premiumMode: 'Half-Yearly',
      premiumAmount: 18500,
      sumAssured: 500000,
      commencementDate: '2015-05-10',
      firstUnpaidPremiumDate: '2023-05-10', // Past due
      maturityDate: '2037-05-10',
      recordStatus: 'active',
      extractionWarnings: [],
      rawExtractedValues: {},
    };

    const msg = generatePolicyWhatsAppMessage(policy);

    expect(msg).toContain('LIC Policy Details');
    expect(msg).toContain('123456789');
    expect(msg).toContain('Rajesh Kumar');
    expect(msg).toContain('Plan: 833');
    expect(msg).toContain('Term: 22 yrs');
    expect(msg).toContain('₹5,00,000');
    expect(msg).toContain('₹18,500');
    expect(msg).toContain('STATUS: PREMIUM DUE');
    expect(msg).toContain('Kindly pay the premium at the earliest');
  });

  it('generates complete WhatsApp message and labels status as MATURED when maturity date has passed', () => {
    const policy: Policy = {
      id: 'test-pol-2',
      policyNumber: '987654321',
      customerName: 'Sunita Sharma',
      customerId: 'cust-2',
      agencyCode: 'TEST_AGENCY',
      planCode: '149',
      policyTerm: 15,
      premiumMode: 'Yearly',
      premiumAmount: 12000,
      sumAssured: 200000,
      commencementDate: '2005-01-15',
      firstUnpaidPremiumDate: '2020-01-15',
      maturityDate: '2020-01-15', // Past maturity
      recordStatus: 'matured',
      extractionWarnings: [],
      rawExtractedValues: {},
    };

    const msg = generatePolicyWhatsAppMessage(policy);

    expect(msg).toContain('987654321');
    expect(msg).toContain('Sunita Sharma');
    expect(msg).toContain('STATUS: MATURED');
  });

  it('generates complete WhatsApp message and labels status as ACTIVE when FUP is in future', () => {
    const futureYear = new Date().getFullYear() + 2;
    const policy: Policy = {
      id: 'test-pol-3',
      policyNumber: '555666777',
      customerName: 'Amit Patel',
      customerId: 'cust-3',
      agencyCode: 'TEST_AGENCY',
      planCode: '914',
      policyTerm: 20,
      premiumMode: 'Quarterly',
      premiumAmount: 6200,
      sumAssured: 300000,
      commencementDate: '2021-03-01',
      firstUnpaidPremiumDate: `${futureYear}-09-01`,
      maturityDate: `${futureYear + 15}-03-01`,
      recordStatus: 'active',
      extractionWarnings: [],
      rawExtractedValues: {},
    };

    const msg = generatePolicyWhatsAppMessage(policy);

    expect(msg).toContain('555666777');
    expect(msg).toContain('Amit Patel');
    expect(msg).toContain('STATUS: ACTIVE');
  });
});

describe('Policy Repository Month Search with Mixed Date Formats', () => {
  beforeEach(async () => {
    await db.policies.clear();
  });

  it('matches DD/MM/YYYY dates with YYYY-MM month filters', async () => {
    await db.policies.bulkAdd([
      {
        id: 'p1',
        policyNumber: '111111111',
        customerName: 'A',
        customerId: 'c1',
        agencyCode: 'TEST',
        planCode: '814',
        premiumMode: 'Yearly',
        premiumAmount: 10000,
        sumAssured: 100000,
        commencementDate: '15/11/2020',
        firstUnpaidPremiumDate: '15/11/2026', // DD/MM/YYYY
        maturityDate: '15/11/2040',
        recordStatus: 'active',
        extractionWarnings: [],
        rawExtractedValues: {},
      },
      {
        id: 'p2',
        policyNumber: '222222222',
        customerName: 'B',
        customerId: 'c2',
        agencyCode: 'TEST',
        planCode: '814',
        premiumMode: 'Yearly',
        premiumAmount: 10000,
        sumAssured: 100000,
        commencementDate: '2020-12-01',
        firstUnpaidPremiumDate: '2026-12-01', // YYYY-MM-DD
        maturityDate: '2040-12-01',
        recordStatus: 'active',
        extractionWarnings: [],
        rawExtractedValues: {},
      },
    ]);

    // Search for 2026-11
    const novResults = await policyRepository.search('', { fupMonth: '2026-11' });
    expect(novResults.length).toBe(1);
    expect(novResults[0].policyNumber).toBe('111111111');

    // Search for 2026-12
    const decResults = await policyRepository.search('', { fupMonth: '2026-12' });
    expect(decResults.length).toBe(1);
    expect(decResults[0].policyNumber).toBe('222222222');
  });
});
