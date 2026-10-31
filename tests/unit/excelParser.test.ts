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
});
