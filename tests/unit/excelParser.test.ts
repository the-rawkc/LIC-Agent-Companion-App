import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractPoliciesFromExcel } from '@/services/excel/extractExcelData';

describe('Excel Policy Data Extraction', () => {
  it('extracts policies cleanly from a structured Excel worksheet', async () => {
    // Generate a test workbook in-memory
    const data = [
      ['LIFE INSURANCE CORPORATION OF INDIA', '', '', '', '', '', '', '', '', '', ''],
      ['AGENT PORTFOLIO REPORT - 29/10/2026', '', '', '', '', '', '', '', '', '', ''],
      ['S.No.', 'Policy No.', 'Name', 'Plan/Term/PPT', 'Sum Assured', 'D.O.C.', 'Mode', 'F.U.P.', 'Premium', 'D.O.M.', 'DOB'],
      [1, '123456789', 'RAMESH KUMAR', '914/20/20', '500000', '15/05/2015', 'YLY', '15/05/2026', '24500', '15/05/2035', '10/08/1985'],
      [2, '987654321', 'SUNITA SHARMA', '945/15/15', '1000000', '01/01/2020', 'MLY', '01/11/2026', '6200', '01/01/2035', '22/11/1990'],
      ['Grand Total', '', '', '', '1500000', '', '', '', '30700', '', ''],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Policies');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const result = await extractPoliciesFromExcel(buffer);

    expect(result.extractedRows.length).toBe(2);
    expect(result.sheetName).toBe('Policies');
    expect(result.extractedRows[0].policyNo).toBe('123456789');
    expect(result.extractedRows[0].name).toBe('RAMESH KUMAR');
    expect(result.extractedRows[0].premium).toBe('24500');
    expect(result.extractedRows[0].planTermPpt).toBe('914/20/20');
    expect(result.extractedRows[1].policyNo).toBe('987654321');
    expect(result.extractedRows[1].name).toBe('SUNITA SHARMA');
  });

  it('matches fuzzy column names like "Policy Number", "Client Name", "SA", etc.', async () => {
    const data = [
      ['SL NO', 'Policy Number', 'Client Name', 'Plan Code', 'SA', 'DOC', 'Pay Mode', 'Due Date', 'Premium Amount', 'Maturity Date'],
      ['1', '556677889', 'AMIT VERMA', '814', '250000', '20/03/2018', 'QLY', '20/12/2026', '4150', '20/03/2038'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const result = await extractPoliciesFromExcel(buffer);

    expect(result.extractedRows.length).toBe(1);
    expect(result.extractedRows[0].policyNo).toBe('556677889');
    expect(result.extractedRows[0].name).toBe('AMIT VERMA');
    expect(result.extractedRows[0].sumAssured).toBe('250000');
  });

  it('correctly distinguishes Policyholder Name from Policy Number and Premium Mode from Premium Amount in exact row order', async () => {
    const data = [
      ['POLICY STATEMENT REPORT - LIC OF INDIA', '', '', '', '', '', '', '', ''],
      ['Agency Code: 08345678', 'Agent Name: RAMESH KUMAR', '', '', '', '', '', '', ''],
      ['Sl No', 'Policyholder Name', 'Policy Number', 'Plan', 'Term', 'PPT', 'Premium Mode', 'Installment Premium', 'Due Date'],
      ['1', 'PRIYA SHARMA', '334455667', '914', '20', '20', 'HLY', '14250', '15/11/2026'],
      ['2', 'VIJAY VERMA', '778899001', '814', '15', '15', 'YLY', '28900', '28/12/2026'],
      ['3', 'ANITA DEVI', '445566778', '945', '21', '18', 'QLY', '4600', '10/01/2027'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BranchReport');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const result = await extractPoliciesFromExcel(buffer);

    expect(result.extractedRows.length).toBe(3);

    // Row 1
    expect(result.extractedRows[0].sNo).toBe('1');
    expect(result.extractedRows[0].policyNo).toBe('334455667');
    expect(result.extractedRows[0].name).toBe('PRIYA SHARMA');
    expect(result.extractedRows[0].planTermPpt).toBe('914/20/20');
    expect(result.extractedRows[0].mode).toBe('HLY');
    expect(result.extractedRows[0].premium).toBe('14250');
    expect(result.extractedRows[0].fup).toBe('15/11/2026');

    // Row 2 (Sequential order preserved)
    expect(result.extractedRows[1].sNo).toBe('2');
    expect(result.extractedRows[1].policyNo).toBe('778899001');
    expect(result.extractedRows[1].name).toBe('VIJAY VERMA');
    expect(result.extractedRows[1].planTermPpt).toBe('814/15/15');
    expect(result.extractedRows[1].mode).toBe('YLY');
    expect(result.extractedRows[1].premium).toBe('28900');

    // Row 3 (Sequential order preserved)
    expect(result.extractedRows[2].sNo).toBe('3');
    expect(result.extractedRows[2].policyNo).toBe('445566778');
    expect(result.extractedRows[2].name).toBe('ANITA DEVI');
    expect(result.extractedRows[2].planTermPpt).toBe('945/21/18');
    expect(result.extractedRows[2].mode).toBe('QLY');
    expect(result.extractedRows[2].premium).toBe('4600');
  });

  it('correctly stitches split "First Name" and "Second Name / Last Name" columns without data loss', async () => {
    const data = [
      ['S.No', 'Policy No', 'First Name', 'Second Name', 'Plan', 'Installment Premium', 'Due Date'],
      ['1', '112233445', 'RAJESH', 'KUMAR', '914/20/20', '15000', '10/11/2026'],
      ['2', '998877665', 'RAJESH', 'SHARMA', '814/15/15', '22000', '12/12/2026'],
      ['3', '554433221', 'SUNIL', 'VERMA', '945/25/20', '8500', '05/01/2027'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SplitNames');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const result = await extractPoliciesFromExcel(buffer);

    expect(result.extractedRows.length).toBe(3);
    // Verified: First Name + Second Name are combined properly
    expect(result.extractedRows[0].name).toBe('RAJESH KUMAR');
    expect(result.extractedRows[0].policyNo).toBe('112233445');

    // Second man with same first name retains his distinct second name!
    expect(result.extractedRows[1].name).toBe('RAJESH SHARMA');
    expect(result.extractedRows[1].policyNo).toBe('998877665');

    expect(result.extractedRows[2].name).toBe('SUNIL VERMA');
    expect(result.extractedRows[2].policyNo).toBe('554433221');

    // Uniform labels check
    expect(result.matchedColumns['Policy No']).toBe('Policy No');
    expect(result.matchedColumns['First Name']).toBe('First Name');
    expect(result.matchedColumns['Second / Last Name']).toBe('Second Name');
  });

  it('handles distinct "Life Assured Name" and "Proposer Name" without collision', async () => {
    const data = [
      ['S.No', 'Policy No', 'Life Assured Name', 'Proposer Name', 'Plan', 'Premium', 'Due Date'],
      ['1', '667788990', 'AARAV SHARMA', 'SUNIL SHARMA', '914/20/20', '18000', '15/12/2026'],
      ['2', '889900112', 'MANISH GUPTA', 'MANISH GUPTA', '814/15/15', '12500', '20/12/2026'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LAandProposer');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const result = await extractPoliciesFromExcel(buffer);

    expect(result.extractedRows.length).toBe(2);
    expect(result.extractedRows[0].name).toBe('AARAV SHARMA (Proposer: SUNIL SHARMA)');
    expect(result.extractedRows[0].policyNo).toBe('667788990');

    expect(result.extractedRows[1].name).toBe('MANISH GUPTA');
    expect(result.extractedRows[1].policyNo).toBe('889900112');
  });
});
