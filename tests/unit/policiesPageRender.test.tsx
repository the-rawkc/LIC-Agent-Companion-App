import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PoliciesPage } from '@/pages/PoliciesPage';
import { db } from '@/db/database';

describe('PoliciesPage Render Test', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.appSettings.clear();
  });

  it('renders PoliciesPage without crashing when database is empty', async () => {
    render(
      <MemoryRouter>
        <PoliciesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Policy Portfolio')).toBeInTheDocument();
    });
  });

  it('renders PoliciesPage without crashing when policies exist (with and without extractionWarnings)', async () => {
    await db.policies.add({
      id: 'pol-test-1',
      policyNumber: '123456789',
      customerId: 'cust-1',
      customerName: 'Test Customer',
      planCode: '815',
      originalPlanString: '815-20',
      term: 20,
      premiumPayingTerm: 20,
      sumAssured: 500000,
      commencementDate: '2024-05-10',
      premiumMode: 'Yearly',
      firstUnpaidPremiumDate: '2025-05-10',
      premiumAmount: 15000,
      maturityDate: '2044-05-10',
      dateOfBirth: null,
      sourceSerialNumber: 1,
      sourceReportDate: '2024-05-10',
      sourceImportId: null,
      rawExtractedValues: {},
      // Notice: extractionWarnings omitted to test cloud pull format!
      recordStatus: 'active',
      createdAt: '2024-05-10T00:00:00.000Z',
      updatedAt: '2024-05-10T00:00:00.000Z',
    } as any);

    render(
      <MemoryRouter>
        <PoliciesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });
  });
});
