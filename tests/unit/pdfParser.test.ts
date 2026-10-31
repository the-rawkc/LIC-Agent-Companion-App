import { describe, it, expect } from 'vitest';
import { parseTokensToRow, parseRawLine, isHeaderOrFooterLine, extractReportDate } from '@/services/pdf/parsePolicyRows';

describe('PDF Row Reconstruction & Parser', () => {
  it('correctly detects header and footer lines', () => {
    expect(isHeaderOrFooterLine('DataFilterByName')).toBe(true);
    expect(isHeaderOrFooterLine('Data Filter String : Dated :29-10-2026')).toBe(true);
    expect(isHeaderOrFooterLine('S.No. Policy No. Name Plan/Term/PPT Sum Assured D.O.C. Mode F.U.P. Premium D.O.M. DOB')).toBe(true);
    expect(isHeaderOrFooterLine('To Be Continued...')).toBe(true);
    expect(isHeaderOrFooterLine('i) This Report is based on the last fup updation.')).toBe(true);
    expect(isHeaderOrFooterLine('-:1 :-')).toBe(true);
    expect(isHeaderOrFooterLine('1 242647587 Ravi Mohan Rohela 749/15/01 1,81,250 30/06/2026 Single 30/06/2027 1,45,000 30/06/2041')).toBe(false);
  });

  it('extracts report date from header string', () => {
    const header = 'Data Filter String : Dated :29-10-2026';
    expect(extractReportDate(header)).toBe('29-10-2026');
  });

  it('accurately parses standard policy row without DOB', () => {
    const rawLine = '1 242647587 Ravi Mohan Rohela 749/15/01 1,81,250 30/06/2026 Single 30/06/2027 1,45,000 30/06/2041';
    const parsed = parseRawLine(rawLine, 1);

    expect(parsed).not.toBeNull();
    expect(parsed?.sNo).toBe('1');
    expect(parsed?.policyNo).toBe('242647587');
    expect(parsed?.name).toBe('Ravi Mohan Rohela');
    expect(parsed?.planTermPpt).toBe('749/15/01');
    expect(parsed?.sumAssured).toBe('1,81,250');
    expect(parsed?.doc).toBe('30/06/2026');
    expect(parsed?.mode).toBe('Single');
    expect(parsed?.fup).toBe('30/06/2027');
    expect(parsed?.premium).toBe('1,45,000');
    expect(parsed?.dom).toBe('30/06/2041');
    expect(parsed?.dob).toBeUndefined();
  });

  it('accurately parses row with zero sum assured and NF mode', () => {
    const rawLine = '2 242647527 VEER SINGH 736/15/0 0 28/06/2026 NF 28/06/2026 12,021 28/06/2041';
    const parsed = parseRawLine(rawLine, 1);

    expect(parsed).not.toBeNull();
    expect(parsed?.policyNo).toBe('242647527');
    expect(parsed?.name).toBe('VEER SINGH');
    expect(parsed?.sumAssured).toBe('0');
    expect(parsed?.mode).toBe('NF');
    expect(parsed?.premium).toBe('12,021');
  });

  it('accurately parses row with N/F mode and single-word name', () => {
    const rawLine = '14 545859236 RIFAKAT 736/15/0 0 28/01/2026 N/F 28/07/2026 5,096 28/01/2041';
    const parsed = parseRawLine(rawLine, 1);

    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('RIFAKAT');
    expect(parsed?.mode).toBe('N/F');
    expect(parsed?.fup).toBe('28/07/2026');
  });

  it('accurately parses complex customer names containing S/O, D/O, or alias', () => {
    const rawLine = '1005 241958391 Hasnain S/O Lt.Sri Mohd.Majeed 75/20/20 50,000 28/10/2008 Half-Yearly 28/10/2025 1,680 28/10/2028 00/00/0000';
    const parsed = parseRawLine(rawLine, 51);

    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('Hasnain S/O Lt.Sri Mohd.Majeed');
    expect(parsed?.planTermPpt).toBe('75/20/20');
    expect(parsed?.mode).toBe('Half-Yearly');
    expect(parsed?.dob).toBe('00/00/0000');
  });

  it('accurately parses row with valid DOB at end', () => {
    const rawLine = '288 229021669 Ghanshyam 814/21/21 1,00,000 28/11/2019 Half-Yearly 28/05/2020 2,842 28/11/2040 01/01/1970';
    const parsed = parseRawLine(rawLine, 15);

    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('Ghanshyam');
    expect(parsed?.dom).toBe('28/11/2040');
    expect(parsed?.dob).toBe('01/01/1970');
  });

  it('accurately parses 99/99/9999 special F.U.P. date', () => {
    const rawLine = '1290 241007559 Sri Shyam Lal S/O Late Sri Bhim Sen 149/51/16 1,00,000 28/01/2004 Half-Yearly 99/99/9999 4,378 28/01/2055 30/01/1955';
    const parsed = parseRawLine(rawLine, 65);

    expect(parsed).not.toBeNull();
    expect(parsed?.fup).toBe('99/99/9999');
    expect(parsed?.premium).toBe('4,378');
    expect(parsed?.dom).toBe('28/01/2055');
    expect(parsed?.dob).toBe('30/01/1955');
  });

  it('returns null for unparseable or junk text lines', () => {
    expect(parseRawLine('Some random text without policy columns')).toBeNull();
    expect(parseRawLine('12345 short row')).toBeNull();
  });
});
