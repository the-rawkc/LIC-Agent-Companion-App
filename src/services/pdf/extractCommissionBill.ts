import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import type { RawCommissionRow, CommissionBillParseResult } from '@/types';
import { parseCleanNumber, parseDateToISO } from '@/utils/formatters';

// Set up worker for browser environment
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const DATE_REGEX = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/;
const AMOUNT_REGEX = /^[\d,]+(?:\.\d{1,2})?$/;

export function isCommissionHeaderOrFooter(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  if (lower.includes('agency commission') || lower.includes('annexure-a')) return true;
  if (lower.includes('ph name') && lower.includes('policyno')) return true;
  if (lower.includes('page total') || lower.includes('batch :') || lower.includes('page no :')) return true;
  return false;
}

/**
 * Regex matching standard LIC Annexure-A Commission line:
 * S.No (opt) | PH Name | PolicyNo | Pln/Tm | DueDt | Risk Date | CBO | Adj.Date | Premium | Commn.
 */
export const COMMISSION_LINE_REGEX =
  /^\s*(?:(\d{1,5})\s+)?([A-Za-z\s.'/-]+?)\s+(\d{8,10})\s+(\d+[-/]\d+|\d+)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(\S+)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)\s*$/;

export function parseCommissionLine(rawLine: string, pageNumber: number = 1): RawCommissionRow | null {
  const match = rawLine.match(COMMISSION_LINE_REGEX);
  if (!match) return null;

  return {
    sNo: match[1]?.trim() || '',
    phName: match[2]?.trim().replace(/\s+/g, ' ') || '',
    policyNo: match[3]?.trim() || '',
    planTerm: match[4]?.trim() || '',
    dueDt: match[5]?.trim() || '',
    riskDate: match[6]?.trim() || '',
    cbo: match[7]?.trim() || '',
    adjDate: match[8]?.trim() || '',
    premium: parseCleanNumber(match[9]),
    commission: parseCleanNumber(match[10]),
    pageNumber,
    rawText: rawLine,
  };
}

/**
 * Flexible token-based parser for commission rows
 */
export function parseCommissionTokens(tokens: string[], pageNumber: number = 1, rawLine: string = ''): RawCommissionRow | null {
  if (tokens.length < 7) return null;

  // Find policy number token (8 to 10 consecutive digits)
  const polIdx = tokens.findIndex((t) => /^\d{8,10}$/.test(t.replace(/[^0-9]/g, '')));
  if (polIdx === -1) return null;

  const policyNo = tokens[polIdx].replace(/[^0-9]/g, '');

  // Extract S.No and Name from tokens before polIdx
  let sNo = '';
  let nameTokens: string[] = [];

  if (polIdx > 0 && /^\d{1,5}$/.test(tokens[0])) {
    sNo = tokens[0];
    nameTokens = tokens.slice(1, polIdx);
  } else {
    nameTokens = tokens.slice(0, polIdx);
  }
  const phName = nameTokens.join(' ').trim();

  // Tokens after policyNo
  const afterTokens = tokens.slice(polIdx + 1);
  if (afterTokens.length < 5) return null;

  // Plan/Term is usually right after policyNo
  let planTerm = '';
  let remainingTokens = afterTokens;
  if (/^(\d+[-/]\d+|\d+)$/.test(afterTokens[0])) {
    planTerm = afterTokens[0];
    remainingTokens = afterTokens.slice(1);
  }

  // Find all date tokens
  const dateIndices: number[] = [];
  remainingTokens.forEach((tok, idx) => {
    if (DATE_REGEX.test(tok)) {
      dateIndices.push(idx);
    }
  });

  if (dateIndices.length < 1) return null;

  // DueDt is the 1st date
  const dueDt = remainingTokens[dateIndices[0]];
  // Risk Date is the 2nd date (if present)
  const riskDate = dateIndices.length >= 2 ? remainingTokens[dateIndices[1]] : undefined;
  // Adj Date is the 3rd date (if present)
  const adjDate = dateIndices.length >= 3 ? remainingTokens[dateIndices[2]] : undefined;

  // CBO is located between Risk Date and Adj Date if both exist
  let cbo = '';
  if (dateIndices.length >= 3 && dateIndices[2] - dateIndices[1] > 1) {
    cbo = remainingTokens.slice(dateIndices[1] + 1, dateIndices[2]).join(' ');
  }

  // Amounts at the end
  const amountTokens: number[] = [];
  for (let i = remainingTokens.length - 1; i >= 0 && amountTokens.length < 2; i--) {
    const val = remainingTokens[i].replace(/,/g, '');
    if (AMOUNT_REGEX.test(val) && !DATE_REGEX.test(remainingTokens[i])) {
      amountTokens.unshift(parseCleanNumber(val));
    }
  }

  const commission = amountTokens.length >= 1 ? amountTokens[amountTokens.length - 1] : 0;
  const premium = amountTokens.length >= 2 ? amountTokens[0] : 0;

  return {
    sNo,
    phName: phName || `Customer of ${policyNo}`,
    policyNo,
    planTerm,
    dueDt,
    riskDate,
    cbo,
    adjDate,
    premium,
    commission,
    pageNumber,
    rawText: rawLine || tokens.join(' '),
  };
}

/**
 * Extract commission bill rows and metadata from PDF
 */
export async function extractCommissionBillFromPdf(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (progress: { page: number; total: number; percentage: number }) => void
): Promise<CommissionBillParseResult> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const items: RawCommissionRow[] = [];
  const warnings: string[] = [];

  let batchInfo: string | undefined;
  let agencyCode: string | undefined;
  let totalPremiumInBill: number | undefined;
  let totalCommissionInBill: number | undefined;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const textItems = textContent.items
        .filter((item): item is any => 'str' in item && item.str.trim().length > 0)
        .map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          height: item.height || 0,
        }));

      // Group text items into lines (Y_TOLERANCE 4.0px)
      const Y_TOLERANCE = 4.0;
      const lines: { y: number; items: typeof textItems }[] = [];

      textItems.sort((a, b) => b.y - a.y);

      for (const item of textItems) {
        const existingLine = lines.find((l) => Math.abs(l.y - item.y) <= Y_TOLERANCE);
        if (existingLine) {
          existingLine.items.push(item);
        } else {
          lines.push({ y: item.y, items: [item] });
        }
      }

      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        const tokens = line.items.map((i) => i.str.trim()).filter(Boolean);
        const fullLine = tokens.join(' ');

        // Check for batch or footer info
        const batchMatch = fullLine.match(/Batch\s*:\s*([^)]+)/i);
        if (batchMatch && !batchInfo) {
          batchInfo = batchMatch[1].trim();
        }

        const agencyMatch = fullLine.match(/LIC\d{7,10}/i);
        if (agencyMatch && !agencyCode) {
          agencyCode = agencyMatch[0].trim();
        }

        const totalsMatch = fullLine.match(/Premium\s*:\s*([\d,.]+)\s+Commission\s*:\s*([\d,.]+)/i);
        if (totalsMatch) {
          totalPremiumInBill = parseCleanNumber(totalsMatch[1]);
          totalCommissionInBill = parseCleanNumber(totalsMatch[2]);
        }

        if (isCommissionHeaderOrFooter(fullLine)) {
          continue;
        }

        // Try direct line regex match first
        const parsedLine = parseCommissionLine(fullLine, pageNum);
        if (parsedLine) {
          items.push(parsedLine);
          continue;
        }

        // Fallback to token-based parser
        const parsedTokens = parseCommissionTokens(tokens, pageNum, fullLine);
        if (parsedTokens) {
          items.push(parsedTokens);
        }
      }
    } catch (err) {
      warnings.push(`Error on page ${pageNum}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (onProgress) {
      onProgress({
        page: pageNum,
        total: totalPages,
        percentage: Math.round((pageNum / totalPages) * 100),
      });
    }
  }

  return {
    items,
    batchInfo,
    agencyCode,
    totalPremium: totalPremiumInBill,
    totalCommission: totalCommissionInBill,
    totalPages,
    warnings,
  };
}

/**
 * Extract commission rows from an Excel or CSV file
 */
export async function extractCommissionBillFromExcel(file: File): Promise<CommissionBillParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const items: RawCommissionRow[] = [];
  const warnings: string[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const keys = Object.keys(row);

    const getVal = (...names: string[]) => {
      for (const name of names) {
        const foundKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const policyNo = getVal('policyno', 'policy', 'policynumber', 'policy_no');
    const dueDt = getVal('duedt', 'duedate', 'due_date', 'lastpaiddate', 'fup');
    const phName = getVal('phname', 'name', 'customername', 'holdername');
    const planTerm = getVal('plntm', 'plan', 'planterm', 'plantermppt');
    const riskDate = getVal('riskdate', 'doc', 'commencementdate');
    const cbo = getVal('cbo', 'branch', 'office');
    const adjDate = getVal('adjdate', 'adjustmentdate', 'receiptdate');
    const premium = parseCleanNumber(getVal('premium', 'prem', 'amount'));
    const commission = parseCleanNumber(getVal('commn', 'commission', 'comm'));

    if (policyNo && /^\d{6,12}$/.test(policyNo.replace(/[^0-9]/g, '')) && dueDt) {
      items.push({
        sNo: String(idx + 1),
        phName: phName || `Policy ${policyNo}`,
        policyNo: policyNo.replace(/[^0-9]/g, ''),
        planTerm,
        dueDt,
        riskDate,
        cbo,
        adjDate,
        premium,
        commission,
        pageNumber: 1,
      });
    }
  }

  return {
    items,
    totalPages: 1,
    warnings,
  };
}
