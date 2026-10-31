import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '@/services/auth/authService';
import { db, getActiveAgencyCode } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import type { Policy } from '@/types';

describe('Multi-Agent Authentication & Isolated Data Tenancy', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('registers a new agent account with Agency Code, Mobile, and 4-digit PIN', async () => {
    const res = await authService.register({
      agencyCode: '03847291',
      mobileNumber: '9876543210',
      agentName: 'Ramesh Kumar',
      pin: '1234',
    });

    expect(res.success).toBe(true);
    expect(res.agent.agencyCode).toBe('03847291');
    expect(res.agent.agentName).toBe('Ramesh Kumar');
    expect(res.agent.mobileNumber).toBe('9876543210');
    expect(res.agent.pinHash).toBeDefined();

    expect(authService.isAuthenticated()).toBe(true);
    expect(getActiveAgencyCode()).toBe('03847291');
  });

  it('rejects registration with invalid PIN format or mobile length', async () => {
    await expect(
      authService.register({
        agencyCode: '03847291',
        mobileNumber: '123',
        agentName: 'Test',
        pin: '1234',
      })
    ).rejects.toThrow(/10-digit Indian Mobile Number/);

    await expect(
      authService.register({
        agencyCode: '03847291',
        mobileNumber: '9876543210',
        agentName: 'Test',
        pin: '12',
      })
    ).rejects.toThrow(/exactly 4 numeric digits/);
  });

  it('logs in successfully with correct Agency Code and 4-digit PIN', async () => {
    await authService.register({
      agencyCode: '03847291',
      mobileNumber: '9876543210',
      agentName: 'Ramesh Kumar',
      pin: '5678',
    });

    authService.logout();
    expect(authService.isAuthenticated()).toBe(false);

    const loginRes = await authService.login('03847291', '5678');
    expect(loginRes.success).toBe(true);
    expect(loginRes.agent.agencyCode).toBe('03847291');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('rejects login with an incorrect PIN', async () => {
    await authService.register({
      agencyCode: '03847291',
      mobileNumber: '9876543210',
      agentName: 'Ramesh Kumar',
      pin: '9999',
    });

    authService.logout();

    await expect(authService.login('03847291', '1111')).rejects.toThrow(/Incorrect 4-digit PIN/);
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('strictly isolates policy and customer data between different agents', async () => {
    // 1. Agent A registers and creates a policy
    await authService.register({
      agencyCode: 'AGENT_A',
      mobileNumber: '9811111111',
      agentName: 'Agent Alice',
      pin: '1111',
    });

    const policyA: Policy = {
      id: 'pol-alice-1',
      policyNumber: 'ALICE-999',
      customerId: 'cust-alice-1',
      customerName: 'Alice Client',
      planCode: '749',
      term: 15,
      premiumPayingTerm: 1,
      originalPlanString: '749/15/01',
      sumAssured: 200000,
      commencementDate: '2026-01-01',
      premiumMode: 'Yearly',
      firstUnpaidPremiumDate: '2027-01-01',
      premiumAmount: 15000,
      maturityDate: '2041-01-01',
      dateOfBirth: null,
      sourceSerialNumber: 1,
      sourceReportDate: 'Manual',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await policyRepository.create(policyA);
    const alicePolicies = await policyRepository.getAll();
    expect(alicePolicies).toHaveLength(1);
    expect(alicePolicies[0].policyNumber).toBe('ALICE-999');

    // 2. Agent B registers on same device
    authService.logout();

    await authService.register({
      agencyCode: 'AGENT_B',
      mobileNumber: '9822222222',
      agentName: 'Agent Bob',
      pin: '2222',
    });

    // Agent B should NOT see Agent A's policies!
    const bobPolicies = await policyRepository.getAll();
    expect(bobPolicies).toHaveLength(0);

    // Agent B creates a customer
    await customerRepository.create({
      displayName: 'Bob Client Special',
      mobileNumber: '9988776655',
    });

    const bobCustomers = await customerRepository.getAll();
    expect(bobCustomers).toHaveLength(1);
    expect(bobCustomers[0].displayName).toBe('Bob Client Special');

    // 3. Agent A logs back in
    authService.logout();
    await authService.login('AGENT_A', '1111');

    const aliceReturnedPolicies = await policyRepository.getAll();
    expect(aliceReturnedPolicies).toHaveLength(1);
    expect(aliceReturnedPolicies[0].policyNumber).toBe('ALICE-999');

    // Alice should NOT see Bob's customer!
    const aliceCustomers = await customerRepository.getAll();
    const bobClientInAlice = aliceCustomers.find((c) => c.displayName === 'Bob Client Special');
    expect(bobClientInAlice).toBeUndefined();
  });
});
