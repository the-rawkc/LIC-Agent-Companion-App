import { z } from 'zod';
import { parseDateToISO, parseCleanNumber } from '@/utils/formatters';
import type { StagedPolicyRow, RawExtractedRow } from '@/types';

export const RawRowSchema = z.object({
  sNo: z.string().optional(),
  policyNo: z.string().min(6, 'Policy number must have at least 6 digits'),
  name: z.string().min(1, 'Customer name cannot be empty'),
  planTermPpt: z.string().min(1, 'Plan code cannot be empty'),
  sumAssured: z.string().optional(),
  doc: z.string().min(6, 'Date of commencement is required'),
  mode: z.string().min(1, 'Premium mode is required'),
  fup: z.string().min(6, 'First unpaid premium date is required'),
  premium: z.string().optional(),
  dom: z.string().min(6, 'Date of maturity is required'),
  dob: z.string().optional(),
});

export interface NormalizationResult {
  row: StagedPolicyRow;
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function normalizeAndValidateExtractedRow(
  raw: RawExtractedRow,
  index: number,
  existingPolicyIds: Set<string>
): NormalizationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawPolicyNo = (raw.policyNo || '').trim();
  const rawName = (raw.name || '').trim();
  const rawPlan = (raw.planTermPpt || '').trim();
  const rawDoc = (raw.doc || '').trim();
  const rawMode = (raw.mode || 'N/F').trim();
  const rawFup = (raw.fup || '').trim();
  const rawDom = (raw.dom || '').trim();
  const rawDob = (raw.dob || '').trim();

  // Validate policy number
  if (!rawPolicyNo) {
    errors.push('Missing policy number');
  } else if (!/^\d{6,12}$/.test(rawPolicyNo)) {
    warnings.push(`Policy number "${rawPolicyNo}" contains non-standard characters`);
  }

  // Validate name
  if (!rawName) {
    errors.push('Missing customer name');
  }

  // Validate and parse dates
  const parsedDoc = parseDateToISO(rawDoc);
  if (!parsedDoc) {
    errors.push(`Invalid Date of Commencement: "${rawDoc}"`);
  }

  const parsedFup = parseDateToISO(rawFup);
  if (!parsedFup && rawFup !== '99/99/9999') {
    errors.push(`Invalid First Unpaid Premium date: "${rawFup}"`);
  }

  const parsedDom = parseDateToISO(rawDom);
  if (!parsedDom) {
    errors.push(`Invalid Date of Maturity: "${rawDom}"`);
  }

  const parsedDob = parseDateToISO(rawDob);
  if (rawDob && rawDob !== '00/00/0000' && !parsedDob) {
    warnings.push(`Could not parse DOB: "${rawDob}"`);
  }

  // Financial amounts
  const sumAssured = parseCleanNumber(raw.sumAssured);
  if (sumAssured === 0) {
    warnings.push('Sum Assured is recorded as 0 in report');
  }

  const premium = parseCleanNumber(raw.premium);
  if (premium === 0) {
    warnings.push('Premium amount is recorded as 0 or empty');
  }

  // Plan code and Term/PPT separation
  let planCode = rawPlan;
  let term: number | null = null;
  let ppt: number | null = null;

  const planParts = rawPlan.split('/');
  if (planParts.length >= 1) {
    planCode = planParts[0].trim();
  }
  if (planParts.length >= 2) {
    const parsedTerm = parseInt(planParts[1].trim(), 10);
    if (!isNaN(parsedTerm)) term = parsedTerm;
  }
  if (planParts.length >= 3) {
    const parsedPpt = parseInt(planParts[2].trim(), 10);
    if (!isNaN(parsedPpt)) ppt = parsedPpt;
  }

  const sNo = raw.sNo ? parseInt(raw.sNo.replace(/\D/g, ''), 10) : index + 1;
  const isDuplicate = existingPolicyIds.has(rawPolicyNo);

  const stagedRow: StagedPolicyRow = {
    rowId: `staged-${index}-${rawPolicyNo || Math.random().toString(36).substring(2, 7)}`,
    isValid: errors.length === 0,
    isDuplicate,
    validationErrors: errors,
    warnings,
    pageNumber: raw.pageNumber || 1,
    originalText: raw.rawText || '',
    serialNumber: isNaN(sNo) ? index + 1 : sNo,
    policyNumber: rawPolicyNo,
    customerName: rawName,
    planCode,
    term,
    ppt,
    originalPlan: rawPlan,
    sumAssured,
    doc: parsedDoc || rawDoc,
    mode: rawMode,
    fup: parsedFup || rawFup,
    premium,
    dom: parsedDom || rawDom,
    dob: parsedDob,
  };

  return {
    row: stagedRow,
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
