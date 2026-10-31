import type { RawExtractedRow } from '@/types';

const HEADER_KEYWORDS = [
  'datafilterbyname',
  'data filter string',
  's.no.',
  'policy no.',
  'plan/term/ppt',
  'to be continued',
  'this report is based',
  'gst is included',
  'dated :',
];

const DATE_REGEX = /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/;
const SPECIAL_DATE_REGEX = /^(?:\d{2}[\/\-]\d{2}[\/\-]\d{4}|99\/99\/9999)$/;
const AMOUNT_REGEX = /^[\d,]+(?:\.\d{1,2})?$/;
const PLAN_REGEX = /^\d+(?:\/\d+)*(?:\/\d+)*$/;
const KNOWN_MODES = new Set(['single', 'nf', 'n/f', 'half-yearly', 'quarterly', 'yearly', 'monthly', 'mly', 'qly', 'hly', 'yly']);

export function isHeaderOrFooterLine(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  if (/^-\s*:\s*\d+\s*:?\s*-?$/.test(lower)) return true; // Page footer like -:1 :-
  return HEADER_KEYWORDS.some((kw) => lower.includes(kw));
}

export function extractReportDate(text: string): string | null {
  const match = text.match(/Dated\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  return match ? match[1] : null;
}

/**
 * Robust anchor-based row parser from tokens
 */
export function parseTokensToRow(tokens: string[], pageNumber: number = 1, rawLine: string = ''): RawExtractedRow | null {
  if (tokens.length < 9) {
    return null;
  }

  // Check if first token is S.No and second is policy number
  let sNo = '';
  let policyNo = '';
  let startIndex = 0;

  if (/^\d{1,5}$/.test(tokens[0]) && /^\d{6,12}$/.test(tokens[1])) {
    sNo = tokens[0];
    policyNo = tokens[1];
    startIndex = 2;
  } else if (/^\d{6,12}$/.test(tokens[0])) {
    // S.No might have been omitted or merged
    policyNo = tokens[0];
    startIndex = 1;
  } else {
    return null;
  }

  // Work backwards from the right end of the line
  let rightIdx = tokens.length - 1;

  // 1. Check DOB
  let dob: string | undefined = undefined;
  if (rightIdx >= startIndex && (DATE_REGEX.test(tokens[rightIdx]) || tokens[rightIdx] === '00/00/0000')) {
    // If the token before this is ALSO a date, then this token is DOB and the previous is DOM
    if (rightIdx - 1 >= startIndex && DATE_REGEX.test(tokens[rightIdx - 1])) {
      dob = tokens[rightIdx];
      rightIdx--;
    }
  }

  // 2. DOM (Date of Maturity)
  if (rightIdx < startIndex || !DATE_REGEX.test(tokens[rightIdx])) {
    return null;
  }
  const dom = tokens[rightIdx];
  rightIdx--;

  // 3. Premium Amount
  if (rightIdx < startIndex || !AMOUNT_REGEX.test(tokens[rightIdx])) {
    return null;
  }
  const premium = tokens[rightIdx];
  rightIdx--;

  // 4. F.U.P. Date
  if (rightIdx < startIndex || !SPECIAL_DATE_REGEX.test(tokens[rightIdx])) {
    return null;
  }
  const fup = tokens[rightIdx];
  rightIdx--;

  // 5. Mode (Could be "Half-Yearly", "NF", "N/F", "Single", etc. If tokenized into "Half", "Yearly" handle it)
  let mode = '';
  if (rightIdx >= startIndex) {
    const candidateMode = tokens[rightIdx].toLowerCase();
    if (candidateMode === 'yearly' && rightIdx - 1 >= startIndex && tokens[rightIdx - 1].toLowerCase() === 'half') {
      mode = 'Half-Yearly';
      rightIdx -= 2;
    } else {
      mode = tokens[rightIdx];
      rightIdx--;
    }
  }

  // 6. D.O.C. Date
  if (rightIdx < startIndex || !DATE_REGEX.test(tokens[rightIdx])) {
    return null;
  }
  const doc = tokens[rightIdx];
  rightIdx--;

  // 7. Sum Assured
  if (rightIdx < startIndex || !AMOUNT_REGEX.test(tokens[rightIdx])) {
    return null;
  }
  const sumAssured = tokens[rightIdx];
  rightIdx--;

  // 8. Plan/Term/PPT
  if (rightIdx < startIndex || !PLAN_REGEX.test(tokens[rightIdx])) {
    return null;
  }
  const planTermPpt = tokens[rightIdx];
  rightIdx--;

  // Everything remaining between startIndex and rightIdx is the Customer Name!
  if (rightIdx < startIndex) {
    return null;
  }
  const name = tokens.slice(startIndex, rightIdx + 1).join(' ').trim();

  return {
    sNo,
    policyNo,
    name,
    planTermPpt,
    sumAssured,
    doc,
    mode,
    fup,
    premium,
    dom,
    dob,
    pageNumber,
    rawText: rawLine || tokens.join(' '),
  };
}

/**
 * Parse an extracted line of text into a policy row
 */
export function parseRawLine(line: string, pageNumber: number = 1): RawExtractedRow | null {
  if (isHeaderOrFooterLine(line)) return null;

  // Split on whitespace
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return parseTokensToRow(tokens, pageNumber, line);
}
