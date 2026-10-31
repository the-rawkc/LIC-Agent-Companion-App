import * as XLSX from 'xlsx';
import type { RawExtractedRow } from '@/types';

export interface ExcelExtractionResult {
  extractedRows: RawExtractedRow[];
  totalRows: number;
  sheetName: string;
  matchedColumns: Record<string, string>;
  warnings: string[];
}

// Flexible column aliases for LIC agent reports
const COLUMN_ALIASES: Record<keyof Omit<RawExtractedRow, 'pageNumber' | 'rawText'>, string[]> = {
  policyNo: ['policy no', 'policy number', 'policyno', 'policy_no', 'policy', 'pol no', 'policynumber', 'policy#'],
  name: ['name', 'customer name', 'client name', 'holder name', 'party name', 'insured name', 'proposer name', 'customer', 'insured'],
  planTermPpt: ['plan/term/ppt', 'plan term ppt', 'plan', 'plan no', 'plan code', 'table/term', 'table term', 'plan_term_ppt', 'plan/term'],
  sumAssured: ['sum assured', 'sum_assured', 'sumassured', 's.a.', 'sa', 'sum insured', 'sum_insured', 'sum', 'sumassured(rs)'],
  doc: ['d.o.c.', 'doc', 'commencement date', 'date of commencement', 'start date', 'commencement', 'd.o.c', 'doc date'],
  mode: ['mode', 'pay mode', 'payment mode', 'premium mode', 'mly/qly/hly/yly'],
  fup: ['f.u.p.', 'fup', 'first unpaid premium', 'fup date', 'next due date', 'due date', 'f.u.p', 'fup_date'],
  premium: ['premium', 'prem', 'inst premium', 'installment premium', 'prem amount', 'premium amount', 'premium (rs)', 'premium(rs)'],
  dom: ['d.o.m.', 'dom', 'maturity date', 'date of maturity', 'dom date', 'd.o.m', 'maturity'],
  dob: ['dob', 'd.o.b.', 'date of birth', 'birth date', 'd.o.b'],
  sNo: ['s.no.', 'sno', 'sl no', 'sr no', 'serial no', 'no', 's.no', 'sr.no', 'sl.no', '#'],
};

/**
 * Format any Excel value to clean string
 */
function formatCell(val: any): string {
  if (val === null || val === undefined) return '';

  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  if (typeof val === 'number') {
    // Check if it's an Excel date serial (between 20000 and 60000)
    // Only format as date if not a huge sum assured / policy number
    return String(val).trim();
  }

  return String(val).trim();
}

/**
 * Parses Excel (.xlsx, .xls, .csv) file and extracts RawExtractedRow records
 */
export async function extractPoliciesFromExcel(
  fileOrBuffer: File | ArrayBuffer
): Promise<ExcelExtractionResult> {
  const warnings: string[] = [];

  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel spreadsheet contains no worksheets.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert worksheet to 2D array of rows
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rawMatrix || rawMatrix.length === 0) {
    throw new Error(`Worksheet "${sheetName}" is empty.`);
  }

  // Find header row (scan first 15 rows)
  let headerRowIndex = -1;
  const columnMap: Partial<Record<keyof Omit<RawExtractedRow, 'pageNumber' | 'rawText'>, number>> = {};
  const matchedColumns: Record<string, string> = {};

  for (let r = 0; r < Math.min(rawMatrix.length, 15); r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row)) continue;

    let hits = 0;
    const tempMap: Partial<Record<keyof Omit<RawExtractedRow, 'pageNumber' | 'rawText'>, number>> = {};
    const tempMatched: Record<string, string> = {};

    for (let c = 0; c < row.length; c++) {
      const cellText = String(row[c] || '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (!cellText) continue;

      for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [keyof typeof COLUMN_ALIASES, string[]][]) {
        if (tempMap[key] === undefined && aliases.some((a) => cellText === a || cellText.includes(a))) {
          tempMap[key] = c;
          tempMatched[key] = String(row[c]);
          hits++;
          break;
        }
      }
    }

    // If row matches at least 3 essential columns (e.g. policyNo, name, premium or doc), it is the header!
    if (tempMap.policyNo !== undefined || hits >= 3) {
      headerRowIndex = r;
      Object.assign(columnMap, tempMap);
      Object.assign(matchedColumns, tempMatched);
      break;
    }
  }

  if (headerRowIndex === -1 || columnMap.policyNo === undefined) {
    // Fallback: If no headers found, check if first row itself looks like data or headers
    warnings.push('Header row could not be definitively identified by keyword. Assuming first row contains headers.');
    headerRowIndex = 0;
    const firstRow = rawMatrix[0] || [];
    for (let c = 0; c < firstRow.length; c++) {
      const cellText = String(firstRow[c] || '').toLowerCase().trim();
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [keyof typeof COLUMN_ALIASES, string[]][]) {
        if (columnMap[key] === undefined && aliases.some((a) => cellText.includes(a))) {
          columnMap[key] = c;
          matchedColumns[key] = String(firstRow[c]);
          break;
        }
      }
    }
  }

  // Extract data rows starting right after headerRowIndex
  const extractedRows: RawExtractedRow[] = [];

  for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if empty row
    const hasValues = row.some((cell) => cell !== '' && cell !== null && cell !== undefined);
    if (!hasValues) continue;

    // Extract policy number
    const rawPolicyVal = columnMap.policyNo !== undefined ? formatCell(row[columnMap.policyNo]) : '';
    // Skip subtotal or footer rows like "Total:", "Grand Total", etc.
    const rowString = row.join(' ').toLowerCase();
    if (rowString.includes('grand total') || rowString.includes('total count') || (rawPolicyVal && !/\d/.test(rawPolicyVal))) {
      continue;
    }

    const rowObj: RawExtractedRow = {
      pageNumber: 1,
      rawText: row.map(formatCell).filter(Boolean).join(' | '),
    };

    if (columnMap.sNo !== undefined) rowObj.sNo = formatCell(row[columnMap.sNo]);
    if (columnMap.policyNo !== undefined) rowObj.policyNo = rawPolicyVal.replace(/\D/g, '') || rawPolicyVal;
    if (columnMap.name !== undefined) rowObj.name = formatCell(row[columnMap.name]);
    if (columnMap.planTermPpt !== undefined) rowObj.planTermPpt = formatCell(row[columnMap.planTermPpt]);
    if (columnMap.sumAssured !== undefined) rowObj.sumAssured = formatCell(row[columnMap.sumAssured]);
    if (columnMap.doc !== undefined) rowObj.doc = formatCell(row[columnMap.doc]);
    if (columnMap.mode !== undefined) rowObj.mode = formatCell(row[columnMap.mode]);
    if (columnMap.fup !== undefined) rowObj.fup = formatCell(row[columnMap.fup]);
    if (columnMap.premium !== undefined) rowObj.premium = formatCell(row[columnMap.premium]);
    if (columnMap.dom !== undefined) rowObj.dom = formatCell(row[columnMap.dom]);
    if (columnMap.dob !== undefined) rowObj.dob = formatCell(row[columnMap.dob]);

    // Only include row if at least policy number or customer name is present
    if (rowObj.policyNo || rowObj.name) {
      extractedRows.push(rowObj);
    }
  }

  if (extractedRows.length === 0) {
    throw new Error('No valid policy data rows could be extracted from this Excel file.');
  }

  return {
    extractedRows,
    totalRows: extractedRows.length,
    sheetName,
    matchedColumns,
    warnings,
  };
}
