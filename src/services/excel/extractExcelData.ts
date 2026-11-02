import * as XLSX from 'xlsx';
import type { RawExtractedRow } from '@/types';

export interface ExcelExtractionResult {
  extractedRows: RawExtractedRow[];
  totalRows: number;
  sheetName: string;
  matchedColumns: Record<string, string>;
  warnings: string[];
}

/**
 * Format any Excel value into a clean, normalized string
 */
function formatCell(val: any): string {
  if (val === null || val === undefined) return '';

  // JavaScript Date object (UTC normalized to prevent local timezone day-slipping)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const dd = String(val.getUTCDate()).padStart(2, '0');
    const mm = String(val.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = val.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Number handling
  if (typeof val === 'number') {
    // Check if it's an Excel date serial (between 20000 and 60000 -> ~1954 to 2064)
    if (val >= 20000 && val <= 60000 && Number.isInteger(val)) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = date.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    // Return standard number representation without scientific notation
    return val.toLocaleString('fullwide', { useGrouping: false });
  }

  return String(val).trim();
}

/**
 * Clean string for comparison
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\r\n\t_]+/g, ' ')
    .replace(/[^\w\s/&#.-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

type ColumnKey =
  | 'policyNo'
  | 'name'
  | 'planTermPpt'
  | 'term'
  | 'ppt'
  | 'sumAssured'
  | 'doc'
  | 'mode'
  | 'fup'
  | 'premium'
  | 'dom'
  | 'dob'
  | 'sNo';

interface ColumnDef {
  key: ColumnKey;
  exact: string[];
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  priority: number;
}

const COLUMN_DEFS: ColumnDef[] = [
  // 1. Policy Number (Strict: must not match customer names, holder names, etc.)
  {
    key: 'policyNo',
    priority: 100,
    exact: [
      'policy no',
      'policy no.',
      'policy number',
      'policy_no',
      'policyno',
      'policy#',
      'pol no',
      'pol. no.',
      'pol no.',
      'policy num',
      'policy',
    ],
    patterns: [
      /\bpolicy\s*(no|number|num|#)?\b/i,
      /\bpol\s*(no|num|#)\b/i,
    ],
    negativePatterns: [
      /name/i,
      /holder/i,
      /proposer/i,
      /insured/i,
      /client/i,
      /agent/i,
      /party/i,
      /status/i,
      /type/i,
    ],
  },

  // 2. Customer Name (Strict: must not match Agent Name, Branch Name, Plan Name)
  {
    key: 'name',
    priority: 95,
    exact: [
      'customer name',
      'client name',
      'policyholder name',
      'policy holder name',
      'name of life assured',
      'name of policyholder',
      'life assured name',
      'insured name',
      'proposer name',
      'name of proposer',
      'party name',
      'holder name',
      'insured',
      'proposer',
      'customer',
      'name',
    ],
    patterns: [
      /\b(customer|client|policyholder|insured|proposer|holder|party)\s*name\b/i,
      /\blife\s*assured\b/i,
      /\bname\b/i,
    ],
    negativePatterns: [
      /agent/i,
      /branch/i,
      /plan/i,
      /nominee/i,
      /user/i,
      /father/i,
      /officer/i,
      /doctor/i,
      /appointee/i,
    ],
  },

  // 3. Plan / Term / PPT
  {
    key: 'planTermPpt',
    priority: 90,
    exact: [
      'plan/term/ppt',
      'plan-term-ppt',
      'plan term ppt',
      'table/term',
      'table & term',
      'table term',
      'plan_term_ppt',
      'plan/term',
      'plan code',
      'plan no',
      'plan no.',
      'plan',
      'table',
    ],
    patterns: [
      /\bplan[\s/_-]*(term)?[\s/_-]*(ppt)?\b/i,
      /\btable[\s/&_-]*term\b/i,
      /\bplan\s*(code|no)?\b/i,
    ],
    negativePatterns: [
      /name/i, // Don't match "Plan Name"
      /agent/i,
    ],
  },

  // Term (if separate column)
  {
    key: 'term',
    priority: 75,
    exact: ['term', 'policy term', 'trm'],
    patterns: [/\b(policy\s*)?term\b/i],
    negativePatterns: [/plan/i, /ppt/i, /pay/i],
  },

  // PPT (if separate column)
  {
    key: 'ppt',
    priority: 75,
    exact: ['ppt', 'prem paying term', 'premium paying term', 'paying term'],
    patterns: [/\bppt\b/i, /\bpremium\s*paying\s*term\b/i],
    negativePatterns: [/plan/i],
  },

  // 4. Premium Mode (Strict: MUST NOT match Premium Amount!)
  {
    key: 'mode',
    priority: 85,
    exact: [
      'mode',
      'premium mode',
      'pay mode',
      'payment mode',
      'mode of payment',
      'prem mode',
      'pay. mode',
      'mly/qly/hly/yly',
    ],
    patterns: [
      /\b(pay|payment|premium|prem)?\s*mode\b/i,
      /\bmode\s*(of\s*payment)?\b/i,
    ],
    negativePatterns: [
      /amount/i,
      /rs/i,
      /inr/i,
      /installment/i,
    ],
  },

  // 5. Premium Amount (Strict: MUST NOT match Premium Mode!)
  {
    key: 'premium',
    priority: 85,
    exact: [
      'installment premium',
      'inst premium',
      'inst. premium',
      'inst. prem.',
      'inst prem',
      'premium amount',
      'prem amount',
      'total premium',
      'premium (rs)',
      'premium(rs)',
      'premium rs',
      'premium',
      'prem.',
      'prem',
    ],
    patterns: [
      /\b(inst(allment)?\.?\s*)?prem(ium)?\s*(amt|amount)?\b/i,
      /\bprem(ium)?\b/i,
    ],
    negativePatterns: [
      /\bmode\b/i, // Never match "Premium Mode"
    ],
  },

  // 6. First Unpaid Premium (F.U.P. / Due Date)
  {
    key: 'fup',
    priority: 80,
    exact: [
      'f.u.p.',
      'f.u.p',
      'fup',
      'first unpaid premium',
      'fup date',
      'fup dt',
      'next due date',
      'due date',
      'next due dt',
      'fup_date',
    ],
    patterns: [
      /\bf\.?u\.?p\.?\s*(date|dt)?\b/i,
      /\bfirst\s*unpaid\s*premium\b/i,
      /\b(next\s*)?due\s*date\b/i,
    ],
    negativePatterns: [
      /commencement/i,
      /maturity/i,
      /birth/i,
    ],
  },

  // 7. Sum Assured
  {
    key: 'sumAssured',
    priority: 80,
    exact: [
      'sum assured',
      'sum_assured',
      'sumassured',
      'sum assured (rs)',
      'sum assured(rs)',
      's.a.',
      'sa',
      'sum insured',
      'sum_insured',
      'basic sum assured',
      'b.s.a.',
      'bsa',
    ],
    patterns: [
      /\bsum\s*(assured|insured)\b/i,
      /\bbasic\s*sum\s*assured\b/i,
      /\bs\.?a\.?\b/i,
    ],
    negativePatterns: [
      /sales/i,
      /salary/i,
      /summary/i,
    ],
  },

  // 8. Date of Commencement (D.O.C.)
  {
    key: 'doc',
    priority: 75,
    exact: [
      'd.o.c.',
      'd.o.c',
      'doc',
      'commencement date',
      'date of commencement',
      'doc date',
      'doc dt',
      'commencement',
      'risk date',
      'date of risk',
      'start date',
    ],
    patterns: [
      /\bd\.?o\.?c\.?\s*(date|dt)?\b/i,
      /\bdate\s*of\s*commencement\b/i,
      /\bcommencement\s*date\b/i,
      /\brisk\s*date\b/i,
    ],
    negativePatterns: [
      /maturity/i,
      /birth/i,
      /due/i,
      /fup/i,
      /doctor/i,
    ],
  },

  // 9. Date of Maturity (D.O.M.)
  {
    key: 'dom',
    priority: 75,
    exact: [
      'd.o.m.',
      'd.o.m',
      'dom',
      'maturity date',
      'date of maturity',
      'dom date',
      'dom dt',
      'maturity',
      'mat date',
      'mat. date',
    ],
    patterns: [
      /\bd\.?o\.?m\.?\s*(date|dt)?\b/i,
      /\bdate\s*of\s*maturity\b/i,
      /\bmaturity\s*date\b/i,
      /\bmaturity\b/i,
    ],
    negativePatterns: [
      /commencement/i,
      /birth/i,
      /due/i,
      /fup/i,
    ],
  },

  // 10. Date of Birth (D.O.B.)
  {
    key: 'dob',
    priority: 70,
    exact: [
      'd.o.b.',
      'd.o.b',
      'dob',
      'date of birth',
      'birth date',
      'dob date',
      'dob dt',
    ],
    patterns: [
      /\bd\.?o\.?b\.?\s*(date|dt)?\b/i,
      /\bdate\s*of\s*birth\b/i,
      /\bbirth\s*date\b/i,
    ],
    negativePatterns: [
      /commencement/i,
      /maturity/i,
      /due/i,
    ],
  },

  // 11. Serial Number
  {
    key: 'sNo',
    priority: 60,
    exact: [
      's.no.',
      's.no',
      'sno',
      'sl no',
      'sl. no.',
      'sl.no.',
      'sl.no',
      'sr no',
      'sr. no.',
      'sr.no.',
      'sr.no',
      'serial no',
      'serial no.',
      'serial number',
      'sr.',
      'sl.',
      '#',
    ],
    patterns: [
      /\bs\.?r\.?\s*no\.?\b/i,
      /\bs\.?l\.?\s*no\.?\b/i,
      /\bs\.?no\.?\b/i,
      /\bserial\s*(no|number)?\b/i,
    ],
    negativePatterns: [
      /policy/i,
      /mobile/i,
      /phone/i,
      /contact/i,
      /table/i,
      /plan/i,
    ],
  },
];

/**
 * Score a header string against a column definition (0 to 100)
 */
function matchScore(cellText: string, def: ColumnDef): number {
  const norm = normalizeHeader(cellText);
  if (!norm) return 0;

  // Negative patterns immediately disqualify
  if (def.negativePatterns && def.negativePatterns.some((np) => np.test(norm))) {
    return 0;
  }

  // Exact match gets highest score
  if (def.exact.some((ex) => norm === ex)) {
    return 100;
  }

  // Pattern match
  if (def.patterns.some((p) => p.test(norm))) {
    return 80;
  }

  return 0;
}

/**
 * Parses Excel (.xlsx, .xls, .csv) file and extracts RawExtractedRow records in exact sequential order
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

  // Find the true header row by testing the first 25 rows
  let bestHeaderRowIndex = -1;
  let bestScore = 0;
  let bestColumnMap: Partial<Record<ColumnKey, number>> = {};
  let bestMatchedNames: Record<string, string> = {};

  for (let r = 0; r < Math.min(rawMatrix.length, 25); r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rowMap: Partial<Record<ColumnKey, number>> = {};
    const rowMatchedNames: Record<string, string> = {};
    const usedColumns = new Set<number>();
    let matchedCount = 0;

    // Sort column definitions by priority so critical columns match first
    const sortedDefs = [...COLUMN_DEFS].sort((a, b) => b.priority - a.priority);

    for (const def of sortedDefs) {
      let highestColScore = 0;
      let chosenCol = -1;

      for (let c = 0; c < row.length; c++) {
        if (usedColumns.has(c)) continue;
        const text = String(row[c] || '');
        const score = matchScore(text, def);

        if (score > highestColScore) {
          highestColScore = score;
          chosenCol = c;
        }
      }

      if (highestColScore >= 70 && chosenCol !== -1) {
        rowMap[def.key] = chosenCol;
        rowMatchedNames[def.key] = String(row[chosenCol]);
        usedColumns.add(chosenCol);
        matchedCount++;
      }
    }

    // Require at least policyNo and (name or doc or premium) or at least 3 distinct matches
    const hasCore = rowMap.policyNo !== undefined && (rowMap.name !== undefined || rowMap.premium !== undefined);
    if ((hasCore && matchedCount >= 2) || matchedCount >= 3) {
      if (matchedCount > bestScore) {
        bestScore = matchedCount;
        bestHeaderRowIndex = r;
        bestColumnMap = rowMap;
        bestMatchedNames = rowMatchedNames;
      }
    }
  }

  // Fallback if no header row met the threshold
  if (bestHeaderRowIndex === -1) {
    warnings.push('Header row could not be definitively recognized. Defaulting to first row.');
    bestHeaderRowIndex = 0;
    const firstRow = rawMatrix[0] || [];
    for (const def of COLUMN_DEFS) {
      for (let c = 0; c < firstRow.length; c++) {
        if (bestColumnMap[def.key] === undefined && matchScore(String(firstRow[c] || ''), def) >= 70) {
          bestColumnMap[def.key] = c;
          bestMatchedNames[def.key] = String(firstRow[c]);
          break;
        }
      }
    }
  }

  // Content-based heuristic verification: Inspect first 10 data rows to prevent any column mismatch
  const sampleDataRows = rawMatrix.slice(bestHeaderRowIndex + 1, bestHeaderRowIndex + 11);
  if (sampleDataRows.length > 0) {
    // 1. Verify policyNo column: should contain numeric digits (6-12 digits)
    if (bestColumnMap.policyNo !== undefined) {
      const polCol = bestColumnMap.policyNo;
      let nonNumericCount = 0;
      let sampleCount = 0;

      for (const row of sampleDataRows) {
        if (!Array.isArray(row)) continue;
        const val = formatCell(row[polCol]).replace(/\s+/g, '');
        if (!val) continue;
        sampleCount++;
        // If it contains alphabetic characters, it's not a policy number!
        if (/[a-zA-Z]{3,}/.test(val)) {
          nonNumericCount++;
        }
      }

      // If more than 50% of policy numbers have text words, columns were swapped!
      if (sampleCount > 0 && nonNumericCount / sampleCount > 0.5) {
        warnings.push('Column detection detected swapped headers. Auto-correcting column assignments based on cell content.');
        // Search across other columns for the true numeric policy number
        for (let c = 0; c < (rawMatrix[bestHeaderRowIndex] || []).length; c++) {
          let looksLikePolicy = 0;
          for (const row of sampleDataRows) {
            const val = formatCell(row[c]).replace(/\D/g, '');
            if (val.length >= 7 && val.length <= 11) looksLikePolicy++;
          }
          if (looksLikePolicy / sampleDataRows.length >= 0.5) {
            // Found true policy column!
            // If the old polCol looks like name, assign name to polCol
            if (bestColumnMap.name === undefined || bestColumnMap.name === c) {
              bestColumnMap.name = polCol;
              bestMatchedNames.name = String(rawMatrix[bestHeaderRowIndex][polCol] || 'Name');
            }
            bestColumnMap.policyNo = c;
            bestMatchedNames.policyNo = String(rawMatrix[bestHeaderRowIndex][c] || 'Policy No');
            break;
          }
        }
      }
    }

    // 2. Verify name column: should contain letters
    if (bestColumnMap.name === undefined) {
      // Find a column containing names (letters, not purely digits or dates)
      for (let c = 0; c < (rawMatrix[bestHeaderRowIndex] || []).length; c++) {
        if (c === bestColumnMap.policyNo || c === bestColumnMap.doc || c === bestColumnMap.fup || c === bestColumnMap.dom) continue;
        let isTextName = 0;
        for (const row of sampleDataRows) {
          const val = formatCell(row[c]);
          if (/^[a-zA-Z\s.]{3,40}$/.test(val) && !/^(yly|hly|qly|mly|single|active|paid|pending)$/i.test(val)) {
            isTextName++;
          }
        }
        if (isTextName / sampleDataRows.length >= 0.5) {
          bestColumnMap.name = c;
          bestMatchedNames.name = String(rawMatrix[bestHeaderRowIndex][c] || 'Customer Name');
          break;
        }
      }
    }
  }

  // Extract data rows sequentially starting right after the detected header row
  const extractedRows: RawExtractedRow[] = [];

  for (let r = bestHeaderRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if empty row
    const hasValues = row.some((cell) => cell !== '' && cell !== null && cell !== undefined);
    if (!hasValues) continue;

    // Skip summary / grand total rows
    const rowString = row.join(' ').toLowerCase();
    if (
      rowString.includes('grand total') ||
      rowString.includes('total count') ||
      rowString.includes('total premium') ||
      rowString.includes('sub total') ||
      rowString.includes('subtotal')
    ) {
      continue;
    }

    const rawPolicyVal = bestColumnMap.policyNo !== undefined ? formatCell(row[bestColumnMap.policyNo]) : '';
    const cleanPolicyNo = rawPolicyVal.replace(/\D/g, '') || rawPolicyVal;

    // Skip footer rows where policy number contains words like "Total"
    if (rawPolicyVal && !/\d/.test(rawPolicyVal)) {
      continue;
    }

    const customerName = bestColumnMap.name !== undefined ? formatCell(row[bestColumnMap.name]) : '';

    // Handle Plan / Term / PPT: check composite planTermPpt or separate term/ppt columns
    let planTermPpt = bestColumnMap.planTermPpt !== undefined ? formatCell(row[bestColumnMap.planTermPpt]) : '';
    const termVal = bestColumnMap.term !== undefined ? formatCell(row[bestColumnMap.term]) : '';
    const pptVal = bestColumnMap.ppt !== undefined ? formatCell(row[bestColumnMap.ppt]) : '';

    if (planTermPpt && !planTermPpt.includes('/') && termVal) {
      planTermPpt = `${planTermPpt}/${termVal}/${pptVal || termVal}`;
    }

    // Determine row sequence number: use parsed S.No or sequential index from Excel
    const rawSNo = bestColumnMap.sNo !== undefined ? formatCell(row[bestColumnMap.sNo]) : '';
    const sequentialSNo = String(r - bestHeaderRowIndex);
    const finalSNo = (rawSNo && /^\d+$/.test(rawSNo)) ? rawSNo : sequentialSNo;

    const rowObj: RawExtractedRow = {
      pageNumber: 1,
      rawText: row.map(formatCell).filter(Boolean).join(' | '),
      sNo: finalSNo,
      policyNo: cleanPolicyNo,
      name: customerName,
      planTermPpt,
      sumAssured: bestColumnMap.sumAssured !== undefined ? formatCell(row[bestColumnMap.sumAssured]) : '',
      doc: bestColumnMap.doc !== undefined ? formatCell(row[bestColumnMap.doc]) : '',
      mode: bestColumnMap.mode !== undefined ? formatCell(row[bestColumnMap.mode]) : '',
      fup: bestColumnMap.fup !== undefined ? formatCell(row[bestColumnMap.fup]) : '',
      premium: bestColumnMap.premium !== undefined ? formatCell(row[bestColumnMap.premium]) : '',
      dom: bestColumnMap.dom !== undefined ? formatCell(row[bestColumnMap.dom]) : '',
      dob: bestColumnMap.dob !== undefined ? formatCell(row[bestColumnMap.dob]) : '',
    };

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
    matchedColumns: bestMatchedNames,
    warnings,
  };
}
