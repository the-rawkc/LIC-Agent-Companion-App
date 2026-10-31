import { describe, it, expect } from 'vitest';
import { normalizeAndValidateExtractedRow } from '@/services/pdf/validatePolicy';

describe('Policy Normalization & Validation', () => {
  it('validates and normalizes complete policy row correctly', () => {
    const raw = {
      sNo: '1',
      policyNo: '242647587',
      name: 'Ravi Mohan Rohela',
      planTermPpt: '749/15/01',
      sumAssured: '1,81,250',
      doc: '30/06/2026',
      mode: 'Single',
      fup: '30/06/2027',
      premium: '1,45,000',
      dom: '30/06/2041',
      dob: '00/00/0000',
    };

    const existingPolicyIds = new Set<string>();
    const res = normalizeAndValidateExtractedRow(raw, 0, existingPolicyIds);

    expect(res.isValid).toBe(true);
    expect(res.row.policyNumber).toBe('242647587');
    expect(res.row.planCode).toBe('749');
    expect(res.row.term).toBe(15);
    expect(res.row.ppt).toBe(1);
    expect(res.row.sumAssured).toBe(181250);
    expect(res.row.premium).toBe(145000);
    expect(res.row.doc).toBe('2026-06-30');
    expect(res.row.fup).toBe('2027-06-30');
    expect(res.row.dom).toBe('2041-06-30');
    expect(res.row.dob).toBeNull(); // 00/00/0000 is converted to null cleanly
    expect(res.row.isDuplicate).toBe(false);
  });

  it('detects duplicate policy number against existing set', () => {
    const raw = {
      policyNo: '242647587',
      name: 'Ravi Mohan',
      planTermPpt: '749/15/01',
      doc: '30/06/2026',
      mode: 'Single',
      fup: '30/06/2027',
      dom: '30/06/2041',
    };

    const existingPolicyIds = new Set<string>(['242647587']);
    const res = normalizeAndValidateExtractedRow(raw, 0, existingPolicyIds);

    expect(res.row.isDuplicate).toBe(true);
  });

  it('flags warning when Sum Assured is recorded as 0', () => {
    const raw = {
      policyNo: '242647527',
      name: 'VEER SINGH',
      planTermPpt: '736/15/0',
      sumAssured: '0',
      doc: '28/06/2026',
      mode: 'NF',
      fup: '28/06/2026',
      premium: '12,021',
      dom: '28/06/2041',
    };

    const res = normalizeAndValidateExtractedRow(raw, 1, new Set());
    expect(res.isValid).toBe(true);
    expect(res.row.sumAssured).toBe(0);
    expect(res.warnings).toContain('Sum Assured is recorded as 0 in report');
  });

  it('fails validation when policy number or dates are invalid', () => {
    const raw = {
      policyNo: '',
      name: 'Incomplete Row',
      planTermPpt: '814/21/21',
      doc: 'invalid-date',
      mode: 'Half-Yearly',
      fup: '28/06/2026',
      dom: '28/06/2041',
    };

    const res = normalizeAndValidateExtractedRow(raw, 2, new Set());
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
