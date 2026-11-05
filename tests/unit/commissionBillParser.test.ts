import { describe, it, expect } from 'vitest';
import {
  parseCommissionLine,
  parseCommissionTokens,
  isCommissionHeaderOrFooter,
} from '@/services/pdf/extractCommissionBill';
import { inferModeFromDates, normalizeMode } from '@/services/commission/commissionBillService';

describe('Commission Bill (Annexure-A) Parser & Mode Inference', () => {
  it('correctly detects header and footer lines in commission bills', () => {
    expect(isCommissionHeaderOrFooter('Agency Commission - Details (annexure-A)')).toBe(true);
    expect(isCommissionHeaderOrFooter('S.No PH Name PolicyNo Pln/Tm DueDt Risk Date CBO Adj.Date Premium Commn.')).toBe(true);
    expect(isCommissionHeaderOrFooter('Page Total Premium : 43,540.00 Commission : 2,226.55')).toBe(true);
    expect(isCommissionHeaderOrFooter('( Page No : 1 | 369 | LIC00743369 | 17923913663816) Batch : 1st of 10/2026')).toBe(true);
    expect(isCommissionHeaderOrFooter('1 PRIYANSHU RUHELA 208793226 833-22 15/09/2026 15/09/2018 EPS1 14/10/2026 16664.00 833.20')).toBe(false);
  });

  it('accurately parses standard Annexure-A row via regex', () => {
    const rawLine = '1 PRIYANSHU RUHELA 208793226 833-22 15/09/2026 15/09/2018 EPS1 14/10/2026 16664.00 833.20';
    const parsed = parseCommissionLine(rawLine, 1);

    expect(parsed).not.toBeNull();
    expect(parsed?.sNo).toBe('1');
    expect(parsed?.phName).toBe('PRIYANSHU RUHELA');
    expect(parsed?.policyNo).toBe('208793226');
    expect(parsed?.planTerm).toBe('833-22');
    expect(parsed?.dueDt).toBe('15/09/2026');
    expect(parsed?.riskDate).toBe('15/09/2018');
    expect(parsed?.cbo).toBe('EPS1');
    expect(parsed?.adjDate).toBe('14/10/2026');
    expect(parsed?.premium).toBe(16664.0);
    expect(parsed?.commission).toBe(833.2);
  });

  it('accurately parses row with multi-word title like SRI DINESH KUMAR', () => {
    const rawLine = '8 SRI DINESH KUMAR 240754422 111-25 27/08/2026 27/02/2002 CBK2 10/10/2026 601.00 36.06';
    const parsed = parseCommissionLine(rawLine, 1);

    expect(parsed).not.toBeNull();
    expect(parsed?.sNo).toBe('8');
    expect(parsed?.phName).toBe('SRI DINESH KUMAR');
    expect(parsed?.policyNo).toBe('240754422');
    expect(parsed?.planTerm).toBe('111-25');
    expect(parsed?.dueDt).toBe('27/08/2026');
    expect(parsed?.riskDate).toBe('27/02/2002');
    expect(parsed?.cbo).toBe('CBK2');
    expect(parsed?.premium).toBe(601.0);
    expect(parsed?.commission).toBe(36.06);
  });

  it('accurately parses tokenized row with numeric CBO like 369', () => {
    const tokens = ['10', 'NARAYAN', 'DAS', '241499103', '075-20', '15/05/2026', '15/11/2006', '369', '02/10/2026', '1696.00', '101.76'];
    const parsed = parseCommissionTokens(tokens, 1);

    expect(parsed).not.toBeNull();
    expect(parsed?.sNo).toBe('10');
    expect(parsed?.phName).toBe('NARAYAN DAS');
    expect(parsed?.policyNo).toBe('241499103');
    expect(parsed?.planTerm).toBe('075-20');
    expect(parsed?.dueDt).toBe('15/05/2026');
    expect(parsed?.riskDate).toBe('15/11/2006');
    expect(parsed?.cbo).toBe('369');
    expect(parsed?.adjDate).toBe('02/10/2026');
    expect(parsed?.premium).toBe(1696.0);
    expect(parsed?.commission).toBe(101.76);
  });

  it('infers mode correctly from Risk Date (DOC) and Due Date interval', () => {
    // 6 months difference -> Half-Yearly
    expect(inferModeFromDates('2019-02-28', '2026-08-28')).toBe('Half-Yearly');
    // 12 months difference (same month) -> Yearly
    expect(inferModeFromDates('2020-04-28', '2026-04-28')).toBe('Yearly');
    // 3 months difference -> Quarterly
    expect(inferModeFromDates('2020-01-15', '2026-04-15')).toBe('Quarterly');
    // 1 month difference -> Monthly
    expect(inferModeFromDates('2020-01-15', '2026-02-15')).toBe('Monthly');
  });

  it('normalizes various mode representations', () => {
    expect(normalizeMode('Hly')).toBe('Half-Yearly');
    expect(normalizeMode('Half-Yearly')).toBe('Half-Yearly');
    expect(normalizeMode('Qly')).toBe('Quarterly');
    expect(normalizeMode('Yly')).toBe('Yearly');
    expect(normalizeMode('Mly')).toBe('Monthly');
    expect(normalizeMode('NACH')).toBe('Monthly');
  });
});
