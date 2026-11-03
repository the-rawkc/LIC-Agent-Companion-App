import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/shared/Modal';
import { importService } from '@/services/import/importService';
import { db } from '@/db/database';

describe('Modal Portal & Data Clean/Repair Test Suite', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.reminders.clear();
    await db.auditLogs.clear();
    document.body.innerHTML = '';
  });

  it('renders Modal directly on document.body top layer via createPortal', () => {
    const handleClose = () => {};
    const { container } = render(
      <div id="nested-parent" className="page-enter" style={{ transform: 'translateY(100px)' }}>
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Top Layer Modal Window"
          description="Visible without sliding down"
          footer={<button type="button">Submit Action</button>}
        >
          <p>Dialog body content</p>
        </Modal>
      </div>
    );

    // Modal must NOT be inside the nested-parent container
    const nestedParent = container.querySelector('#nested-parent');
    expect(nestedParent?.children.length).toBe(0);

    // Modal dialog must be mounted directly as a child of document.body
    const modalHeading = screen.getByText('Top Layer Modal Window');
    expect(modalHeading).toBeInTheDocument();
    expect(document.body.contains(modalHeading)).toBe(true);

    // Verify submit button is docked and rendered
    const submitBtn = screen.getByText('Submit Action');
    expect(submitBtn).toBeInTheDocument();

    // Verify document.body scroll lock was applied
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');
  });

  it('cleans corrupted punctuation, aligns customer names, and deletes orphaned customer records', async () => {
    const cust1Id = 'c-1';
    const cust2OrphanId = 'c-2-orphan';

    // Insert customer with corrupted punctuation and an orphan customer
    await db.customers.bulkAdd([
      {
        id: cust1Id,
        displayName: ',,Ravi Mohan Rohela;;',
        normalizedName: 'ravi mohan rohela',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: cust2OrphanId,
        displayName: 'Old Split Name Fragment',
        normalizedName: 'old split name fragment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    // Insert policy linking to cust1 with leading/trailing commas
    await db.policies.add({
      id: 'p-1',
      policyNumber: '242647587',
      customerId: cust1Id,
      customerName: ',,Ravi Mohan Rohela;;',
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
      sourceImportId: 'imp-1',
      extractionWarnings: [],
      recordStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await importService.cleanAndRepairDatabase();
    expect(res.fixedPolicies).toBe(1);
    expect(res.cleanedCustomers).toBe(1);
    expect(res.removedOrphans).toBe(1);

    // Verify policy has clean name
    const p = await db.policies.get('p-1');
    expect(p?.customerName).toBe('Ravi Mohan Rohela');

    // Verify customer has clean name
    const c = await db.customers.get(cust1Id);
    expect(c?.displayName).toBe('Ravi Mohan Rohela');

    // Verify orphan customer was removed
    const orphan = await db.customers.get(cust2OrphanId);
    expect(orphan).toBeUndefined();
  });
});
