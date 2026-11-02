import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateUUID } from '@/utils/formatters';
import { authService } from '@/services/auth/authService';
import { d1SyncService } from '@/services/cloud/d1SyncService';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { getDatabase, switchAgentDatabase } from '@/db/database';
import type { Policy } from '@/types';

describe('Multi-Device Sync & UUID Fallback Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('generates valid RFC4122 v4 UUIDs even when window.crypto.randomUUID is undefined (insecure context/HTTP)', () => {
    // Simulate non-secure HTTP or older mobile browser where crypto.randomUUID is undefined
    const originalCrypto = globalThis.crypto;
    const mockCryptoWithoutRandomUUID = {
      getRandomValues: (buffer: Uint8Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
        return buffer;
      },
    };

    // @ts-ignore
    delete globalThis.crypto;
    // @ts-ignore
    globalThis.crypto = mockCryptoWithoutRandomUUID;

    const uuid = generateUUID();
    expect(uuid).toBeDefined();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    // Restore crypto
    globalThis.crypto = originalCrypto;
  });

  it('allows adding customer and policy without crashing when crypto.randomUUID is undefined', async () => {
    const originalRandomUUID = globalThis.crypto?.randomUUID;
    if (globalThis.crypto) {
      // @ts-ignore
      delete globalThis.crypto.randomUUID;
    }

    switchAgentDatabase('TEST_AGENCY');

    const customer = await customerRepository.create({
      displayName: 'Surendra Verma',
      mobileNumber: '9876543210',
    });

    expect(customer.id).toBeDefined();
    expect(customer.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const policy: Policy = {
      id: generateUUID(),
      policyNumber: '887766554',
      customerId: customer.id,
      customerName: customer.displayName,
      planCode: '849',
      term: 20,
      premiumPayingTerm: 20,
      originalPlanString: '849/20/20',
      sumAssured: 500000,
      commencementDate: '2022-01-01',
      premiumMode: 'Yearly',
      firstUnpaidPremiumDate: '2026-11-01',
      premiumAmount: 25000,
      maturityDate: '2042-01-01',
      dateOfBirth: '1985-05-15',
      sourceSerialNumber: null,
      sourceReportDate: 'Manual Entry',
      sourceImportId: null,
      rawExtractedValues: {},
      extractionWarnings: [],
      recordStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const policyId = await policyRepository.create(policy);
    expect(policyId).toBe(policy.id);

    const saved = await policyRepository.getById(policyId);
    expect(saved).toBeDefined();
    expect(saved?.policyNumber).toBe('887766554');

    // Restore original method
    if (globalThis.crypto && originalRandomUUID) {
      globalThis.crypto.randomUUID = originalRandomUUID;
    }
  });

  it('restores policies and customers from Cloudflare D1 on a second device during login', async () => {
    const agencyCode = 'MULTI_DEV_AGENT';
    const pin = '4321';

    // Mock Cloudflare D1 response for second device
    const mockCloudData = {
      success: true,
      agencyCode,
      agentName: 'Vikram Malhotra',
      lastSyncAt: new Date().toISOString(),
      policies: [
        {
          id: 'pol-cloud-1',
          policyNumber: '998877665',
          customerId: 'cust-cloud-1',
          customerName: 'Vikram Malhotra',
          planCode: '914',
          term: 15,
          premiumPayingTerm: 15,
          originalPlanString: '914/15/15',
          sumAssured: 300000,
          commencementDate: '2023-01-01',
          premiumMode: 'Half-Yearly',
          firstUnpaidPremiumDate: '2026-12-01',
          premiumAmount: 12000,
          maturityDate: '2038-01-01',
          dateOfBirth: null,
          sourceSerialNumber: null,
          sourceReportDate: 'Manual Entry',
          sourceImportId: null,
          rawExtractedValues: {},
          extractionWarnings: [],
          recordStatus: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      customers: [
        {
          id: 'cust-cloud-1',
          displayName: 'Vikram Malhotra',
          normalizedName: 'vikram malhotra',
          mobileNumber: '9898989898',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      reminders: [],
      profile: {
        agencyCode,
        fullName: 'Vikram Malhotra',
        mobileNumber: '9898989898',
      },
    };

    vi.spyOn(d1SyncService, 'authenticate').mockResolvedValue({
      isNew: false,
      message: 'Authenticated successfully',
      agentName: 'Vikram Malhotra',
    });

    vi.spyOn(d1SyncService, 'pullFromCloud').mockImplementation(async (code) => {
      const targetDb = getDatabase(code);
      await targetDb.policies.bulkPut(mockCloudData.policies as any);
      await targetDb.customers.bulkPut(mockCloudData.customers as any);
      return {
        policiesCount: mockCloudData.policies.length,
        customersCount: mockCloudData.customers.length,
        remindersCount: 0,
        lastSyncAt: mockCloudData.lastSyncAt,
        agentName: mockCloudData.agentName,
        profile: mockCloudData.profile,
      };
    });

    vi.spyOn(d1SyncService, 'pushToCloud').mockResolvedValue({
      syncedAt: new Date().toISOString(),
      counts: { policies: 1, customers: 1, reminders: 0 },
    });

    // Execute login as on a fresh device (agent not in local storage)
    const result = await authService.login(agencyCode, pin);

    expect(result.success).toBe(true);
    expect(result.agent.agencyCode).toBe(agencyCode);
    expect(result.restoredFromCloud).toBe(true);
    expect(result.restoredCount).toBe(1);

    // Verify data exists in isolated local IndexedDB on device 2
    const agentDb = getDatabase(agencyCode);
    const policies = await agentDb.policies.toArray();
    const customers = await agentDb.customers.toArray();

    expect(policies).toHaveLength(1);
    expect(policies[0].policyNumber).toBe('998877665');
    expect(customers).toHaveLength(1);
    expect(customers[0].displayName).toBe('Vikram Malhotra');
  });

  it('syncs complete dataset of policies and customers from Device 1 to Device 2', async () => {
    const agencyCode = 'SYNC_TEST_AGENT';
    const pin = '9999';

    // Simulate Cloudflare D1 cloud store
    let cloudStore: any = null;

    // Device 1: Populate 100 policies and customers
    switchAgentDatabase(agencyCode);
    const db1 = getDatabase(agencyCode);
    await db1.policies.clear();
    await db1.customers.clear();

    const samplePolicies: Policy[] = [];
    const sampleCustomers: any[] = [];
    for (let i = 1; i <= 50; i++) {
      const custId = `cust-${i}`;
      sampleCustomers.push({
        id: custId,
        displayName: `Customer ${i}`,
        normalizedName: `customer ${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      samplePolicies.push({
        id: `pol-${i}`,
        policyNumber: `10000000${i}`,
        customerId: custId,
        customerName: `Customer ${i}`,
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
        sourceSerialNumber: String(i),
        sourceReportDate: '2026-01-01',
        sourceImportId: null,
        rawExtractedValues: {},
        extractionWarnings: [],
        recordStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await db1.customers.bulkPut(sampleCustomers);
    await db1.policies.bulkPut(samplePolicies);

    // Mock network fetch to simulate Cloudflare D1 endpoints
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (urlStr.includes('/api/sync/auth')) {
        return new Response(JSON.stringify({ success: true, isNew: false, agencyCode, agentName: 'Sync Agent' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/api/sync/push')) {
        cloudStore = {
          agencyCode: body.agencyCode,
          policies: body.policies,
          customers: body.customers,
          reminders: body.reminders,
          profile: body.profile,
          syncedAt: new Date().toISOString(),
        };
        return new Response(JSON.stringify({ success: true, syncedAt: cloudStore.syncedAt, counts: { policies: body.policies.length, customers: body.customers.length, reminders: 0 } }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/api/sync/pull')) {
        return new Response(JSON.stringify({
          success: true,
          agencyCode,
          agentName: 'Sync Agent',
          lastSyncAt: cloudStore?.syncedAt,
          policies: cloudStore?.policies || [],
          customers: cloudStore?.customers || [],
          reminders: cloudStore?.reminders || [],
          profile: cloudStore?.profile || null,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true, d1Ready: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Device 1 pushes to cloud
    const pushRes = await d1SyncService.pushToCloud(agencyCode, pin);
    expect(pushRes.counts.policies).toBe(50);
    expect(cloudStore.policies).toHaveLength(50);

    // Device 2: Fresh browser/device (empty database)
    const db2 = getDatabase(agencyCode);
    await db2.policies.clear();
    await db2.customers.clear();
    expect(await db2.policies.count()).toBe(0);

    // Device 2 pulls from cloud
    const pullRes = await d1SyncService.pullFromCloud(agencyCode, pin);
    expect(pullRes.policiesCount).toBe(50);
    expect(pullRes.customersCount).toBe(50);

    // Verify all policies and customers are now in Device 2 IndexedDB
    const dev2Policies = await db2.policies.toArray();
    const dev2Customers = await db2.customers.toArray();
    expect(dev2Policies).toHaveLength(50);
    expect(dev2Customers).toHaveLength(50);
    expect(dev2Policies.find((p) => p.policyNumber === '100000001')).toBeDefined();
    expect(dev2Policies.find((p) => p.policyNumber === '1000000050')).toBeDefined();
  });
});
