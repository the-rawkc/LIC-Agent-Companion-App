import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { reminderRepository } from '@/db/repositories/reminderRepository';
import type { Policy, Customer } from '@/types';

describe('Database Repositories & Business Logic', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.reminders.clear();
    await db.auditLogs.clear();
  });

  it('creates and retrieves a policy', async () => {
    const policy: Policy = {
      id: 'pol-1',
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
    const found = await policyRepository.getByPolicyNumber('242647587');

    expect(found).toBeDefined();
    expect(found?.customerName).toBe('Rajesh Kumar');
    expect(found?.sumAssured).toBe(181250);
  });

  it('supports multiple policies linked to one customer', async () => {
    const cust = await customerRepository.create({
      displayName: 'Samarth Mishra',
      normalizedName: 'samarth mishra',
      mobileNumber: '9876543210',
    });

    const p1: Policy = {
      id: 'pol-166',
      policyNumber: '248870469',
      customerId: cust.id,
      customerName: 'SAMARTH MISHRA',
      planCode: '934',
      term: 18,
      premiumPayingTerm: 13,
      originalPlanString: '934/18/13',
      sumAssured: 0,
      commencementDate: '2022-10-28',
      premiumMode: 'N/F',
      firstUnpaidPremiumDate: '2026-04-28',
      premiumAmount: 3851,
      maturityDate: '2040-10-28',
      dateOfBirth: null,
      sourceSerialNumber: 166,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const p2: Policy = {
      id: 'pol-167',
      policyNumber: '248870470',
      customerId: cust.id,
      customerName: 'SAMARTH MISHRA',
      planCode: '934',
      term: 18,
      premiumPayingTerm: 13,
      originalPlanString: '934/18/13',
      sumAssured: 0,
      commencementDate: '2022-10-28',
      premiumMode: 'N/F',
      firstUnpaidPremiumDate: '2026-04-28',
      premiumAmount: 2629,
      maturityDate: '2040-10-28',
      dateOfBirth: null,
      sourceSerialNumber: 167,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await policyRepository.create(p1);
    await policyRepository.create(p2);

    const summary = await customerRepository.getWithSummary(cust.id);
    expect(summary?.policyCount).toBe(2);
    expect(summary?.totalRecordedPremium).toBe(3851 + 2629);
    expect(summary?.policies.length).toBe(2);
  });

  it('safely merges two customer profiles and reassigns policies and reminders', async () => {
    const cust1 = await customerRepository.create({
      displayName: 'Ghanshyam A',
      normalizedName: 'ghanshyam a',
      notes: 'Initial account',
    });

    const cust2 = await customerRepository.create({
      displayName: 'Ghanshyam Main',
      normalizedName: 'ghanshyam main',
      mobileNumber: '9988776655',
    });

    const p1: Policy = {
      id: 'p-1',
      policyNumber: '111111111',
      customerId: cust1.id,
      customerName: 'Ghanshyam',
      planCode: '814',
      term: 21,
      premiumPayingTerm: 21,
      originalPlanString: '814/21/21',
      sumAssured: 100000,
      commencementDate: '2019-11-28',
      premiumMode: 'Half-Yearly',
      firstUnpaidPremiumDate: '2020-05-28',
      premiumAmount: 2842,
      maturityDate: '2040-11-28',
      dateOfBirth: '1970-01-01',
      sourceSerialNumber: 288,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await policyRepository.create(p1);
    await reminderRepository.create({
      customerId: cust1.id,
      title: 'Call Ghanshyam',
      description: 'Check renewal',
      dueDate: '2026-11-15',
      reminderType: 'customer_followup',
      status: 'pending',
      priority: 'high',
    });

    // Execute merge
    await customerRepository.mergeCustomers(cust1.id, cust2.id);

    // Verify cust1 is deleted and cust2 now has policy p1 and the reminder
    const oldCust = await customerRepository.getById(cust1.id);
    expect(oldCust).toBeUndefined();

    const updatedP1 = await policyRepository.getById('p-1');
    expect(updatedP1?.customerId).toBe(cust2.id);

    const cust2Reminders = await reminderRepository.getByCustomerId(cust2.id);
    expect(cust2Reminders.length).toBe(1);
    expect(cust2Reminders[0].title).toBe('Call Ghanshyam');
  });

  it('prevents accidental deletion of customer with active policies', async () => {
    const cust = await customerRepository.create({
      displayName: 'Protected Customer',
      normalizedName: 'protected customer',
    });

    await policyRepository.create({
      id: 'p-protect',
      policyNumber: '999999999',
      customerId: cust.id,
      customerName: 'Protected Customer',
      planCode: '815',
      term: 21,
      premiumPayingTerm: 21,
      originalPlanString: '815/21/21',
      sumAssured: 100000,
      commencementDate: '2020-01-01',
      premiumMode: 'Yearly',
      firstUnpaidPremiumDate: '2026-01-01',
      premiumAmount: 5000,
      maturityDate: '2041-01-01',
      dateOfBirth: null,
      sourceSerialNumber: 1,
      sourceReportDate: '2026-10-29',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(customerRepository.delete(cust.id)).rejects.toThrow(/Cannot delete customer with 1 active policies/);
  });
});
