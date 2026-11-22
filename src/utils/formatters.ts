/**
 * Comprehensive Indian currency and number formatting
 */
export function formatCurrency(amount: number | null | undefined, showSymbol: boolean = true): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '₹0' : '0';
  }

  // Format using Indian Numbering System (Lakhs, Crores)
  const parts = Math.round(amount).toString().split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherNumbers = parts[0].substring(0, parts[0].length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Robust date parser handling Date objects, Excel serials (45230, 45230.5),
 * DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, YYYY-MM-DD, and text dates.
 * Returns normalized 'YYYY-MM-DD' or null if invalid / missing.
 */
export function parseDateToISO(raw: any): string | null {
  if (raw === null || raw === undefined) return null;

  // Handle native Date objects
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const yyyy = raw.getUTCFullYear();
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '00/00/0000' || trimmed === '0/0/0000' || trimmed.startsWith('00/')) {
    return null;
  }
  if (trimmed === '99/99/9999') {
    return '2099-12-31';
  }

  // Handle Excel serial numbers (integers or floats e.g. 45230, 45230.0, 45230.5: years ~1954 to 2075)
  const numVal = Number(trimmed);
  if (!isNaN(numVal) && numVal >= 20000 && numVal <= 65000) {
    const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // Check DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (supports 2-digit and 4-digit years)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const paddedDay = day.toString().padStart(2, '0');
      const paddedMonth = month.toString().padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
  }

  // Check YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const paddedDay = day.toString().padStart(2, '0');
      const paddedMonth = month.toString().padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
  }

  // Check text dates e.g. "15-May-2026", "15 May 2026", "May 15, 2026"
  const parsedTimestamp = Date.parse(trimmed);
  if (!isNaN(parsedTimestamp)) {
    const date = new Date(parsedTimestamp);
    if (date.getFullYear() >= 1940 && date.getFullYear() <= 2100) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return null;
}

/**
 * Format ISO date 'YYYY-MM-DD' to Indian display 'DD/MM/YYYY' or friendly readable
 */
export function formatDate(isoStr: string | null | undefined, format: 'short' | 'medium' | 'long' = 'short'): string {
  if (!isoStr) return '—';
  
  const iso = parseDateToISO(isoStr);
  if (!iso) return isoStr; // Fallback to raw if unable to parse

  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return isoStr;

  if (format === 'short') {
    return `${day}/${month}/${year}`;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mIndex = parseInt(month, 10) - 1;

  if (format === 'medium') {
    return `${parseInt(day, 10)} ${months[mIndex]} ${year}`;
  }

  return `${parseInt(day, 10)} ${fullMonths[mIndex]} ${year}`;
}

/**
 * Calculate difference in days between target date and base date (default today)
 */
export function getDaysDifference(targetDate: string, baseDateStr?: string): number {
  const targetIso = parseDateToISO(targetDate);
  if (!targetIso) return NaN;

  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  base.setHours(0, 0, 0, 0);

  const target = new Date(targetIso);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Normalize strings for fuzzy & fast case-insensitive search
 */
export function normalizeSearchString(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate unique random ID for local entities
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through if randomUUID fails (e.g. insecure context)
    }
  }

  // RFC4122 version 4 compliant UUID using crypto.getRandomValues if available
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fall through
    }
  }

  // Fallback RFC4122 v4 generator using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parse numeric premium or sum assured from strings with commas like "1,81,250"
 */
export function parseCleanNumber(val: string | number | null | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Automatically advance F.U.P. date when a premium payment is recorded
 * Based on the policy premium mode (Monthly +1m, Quarterly +3m, Half-Yearly +6m, Yearly +12m)
 */
export function advanceFupDate(currentFupIso: string, mode: string): string {
  const parsed = parseDateToISO(currentFupIso);
  const baseDate = parsed ? new Date(parsed) : new Date();

  // Normalize mode
  const m = (mode || '').toLowerCase().trim();
  let addMonths = 12; // default yearly
  if (m.includes('month') || m === 'mly' || m === 'm') {
    addMonths = 1;
  } else if (m.includes('quarter') || m === 'qly' || m === 'q') {
    addMonths = 3;
  } else if (m.includes('half') || m === 'hly' || m === 'h') {
    addMonths = 6;
  } else if (m.includes('year') || m === 'yly' || m === 'y') {
    addMonths = 12;
  } else if (m.includes('single') || m === 'sgl') {
    return currentFupIso; // Single premium has no recurring FUP
  }

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0-indexed
  const currentDay = baseDate.getDate();

  // Calculate target month and year
  const targetMonthIndex = currentMonth + addMonths;
  const targetYear = currentYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;

  // Determine days in target month to avoid overflow (e.g. 31 Jan -> 28 Feb)
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(currentDay, daysInTargetMonth);

  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Robust parser for Plan / Term / PPT strings (e.g., '833-22', '815-21', '736/16/10', '149/20/20')
 */
export function parsePlanTermPpt(rawPlan: string | undefined | null): {
  planCode: string;
  term: number | null;
  ppt: number | null;
} {
  if (!rawPlan) return { planCode: '', term: null, ppt: null };
  const trimmed = rawPlan.trim();
  const parts = trimmed.split(/[-/]/).map((p) => p.trim()).filter(Boolean);
  const planCode = parts[0] || trimmed;
  let term: number | null = null;
  let ppt: number | null = null;

  if (parts.length >= 2) {
    const t = parseInt(parts[1], 10);
    if (!isNaN(t) && t > 0) term = t;
  }
  if (parts.length >= 3) {
    const p = parseInt(parts[2], 10);
    if (!isNaN(p) && p > 0) ppt = p;
  } else if (term !== null) {
    ppt = term;
  }

  return { planCode, term, ppt };
}

/**
 * Calculates Date of Maturity (DOM) accurately from Commencement Date (DOC) and policy Term years.
 * Preserves day and month, handling leap years safely (e.g. Feb 29 on non-leap year resolves to Feb 28).
 */
export function calculateMaturityDate(
  commencementDateIso: string | null | undefined,
  termYears: number | null | undefined
): string | null {
  if (!commencementDateIso || termYears === null || termYears === undefined || isNaN(termYears) || termYears <= 0) {
    return null;
  }
  const iso = parseDateToISO(commencementDateIso);
  if (!iso) return null;

  const [yStr, mStr, dStr] = iso.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);

  const targetYear = year + Math.round(termYears);
  const daysInTargetMonth = new Date(targetYear, month, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  const mm = String(month).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Returns the true Date of Maturity for a policy, recalculating from Term + DOC
 * if the stored maturity date is missing or inconsistent.
 */
export function getPolicyMaturityDate(policy: {
  maturityDate?: string | null;
  commencementDate?: string | null;
  term?: number | null;
  originalPlanString?: string | null;
  planCode?: string | null;
}): string {
  const parsed = parsePlanTermPpt(policy.originalPlanString || policy.planCode);
  const term = policy.term && !isNaN(policy.term) && policy.term > 0 ? policy.term : parsed.term;

  if (policy.commencementDate && term && term > 0) {
    const calculated = calculateMaturityDate(policy.commencementDate, term);
    if (calculated) {
      // If no stored date or stored date was artificially set to ~1 year ahead (buggy FUP advancement), use calculated
      if (!policy.maturityDate) return calculated;
      const storedIso = parseDateToISO(policy.maturityDate);
      const docIso = parseDateToISO(policy.commencementDate);
      if (!storedIso) return calculated;

      // If term is >= 3 years and stored DOM is within 2 years of DOC, it's corrupt/wrong -> fix with calculated
      if (docIso && term >= 3) {
        const docYear = parseInt(docIso.split('-')[0], 10);
        const domYear = parseInt(storedIso.split('-')[0], 10);
        if (domYear - docYear <= 2) {
          return calculated;
        }
      }
      return storedIso;
    }
  }

  if (policy.maturityDate) {
    const iso = parseDateToISO(policy.maturityDate);
    if (iso) return iso;
  }

  return policy.maturityDate || '';
}

export type PolicyLifecycleStatus = 'matured' | 'claimed' | 'due' | 'surrendered' | 'active' | 'lapsed';

/**
 * Categorizes a policy into its exact lifecycle status:
 * 'matured' | 'claimed' | 'due' | 'surrendered' | 'active' | 'lapsed'
 */
export function getPolicyLifecycleStatus(policy: {
  recordStatus?: string;
  maturityDate?: string | null;
  firstUnpaidPremiumDate?: string | null;
  commencementDate?: string | null;
  term?: number | null;
  originalPlanString?: string | null;
  planCode?: string | null;
}): PolicyLifecycleStatus {
  const rs = (policy.recordStatus || '').toLowerCase();
  if (rs === 'claimed') return 'claimed';
  if (rs === 'surrendered' || rs === 'surendered') return 'surrendered';
  if (rs === 'matured') return 'matured';

  const todayIso = new Date().toISOString().split('T')[0];

  // Check if maturity date has arrived/passed
  const trueDom = getPolicyMaturityDate(policy);
  const domIso = parseDateToISO(trueDom);
  if (domIso && domIso <= todayIso) {
    return 'matured';
  }

  if (rs === 'due') return 'due';

  // Check if premium payment is due (FUP <= today)
  if (policy.firstUnpaidPremiumDate) {
    const fupIso = parseDateToISO(policy.firstUnpaidPremiumDate);
    if (fupIso && fupIso <= todayIso) {
      return 'due';
    }
  }

  if (rs === 'lapsed') return 'lapsed';
  return 'active';
}

export interface ReminderShareSettings {
  includePolicyNumber: boolean;
  includeCustomerName: boolean;
  includePlan: boolean;
  includeSumAssured: boolean;
  includePremium: boolean;
  includeDueDate: boolean;
  includeMaturityDate: boolean;
  includeStatus: boolean;
  includeAgentDetails: boolean;
}

export const DEFAULT_SHARE_SETTINGS: ReminderShareSettings = {
  includePolicyNumber: true,
  includeCustomerName: true,
  includePlan: true,
  includeSumAssured: true,
  includePremium: true,
  includeDueDate: true,
  includeMaturityDate: true,
  includeStatus: true,
  includeAgentDetails: true,
};

/**
 * Generate a clean text representation of available policy details
 * Filters details based on user's customizable reminder share settings
 */
export function generatePolicyWhatsAppMessage(
  policy: {
    policyNumber: string;
    customerName?: string;
    planCode?: string;
    policyTerm?: number | null;
    premiumPayingTerm?: number | null;
    sumAssured?: number;
    premiumAmount?: number;
    premiumMode?: string;
    commencementDate?: string;
    maturityDate?: string;
    firstUnpaidPremiumDate?: string;
    recordStatus?: string;
    originalPlanString?: string;
  },
  settings?: Partial<ReminderShareSettings>,
  agentInfo?: { name?: string; mobile?: string }
): string {
  const cfg = { ...DEFAULT_SHARE_SETTINGS, ...settings };
  const status = getPolicyLifecycleStatus(policy);
  const isDue = status === 'due';

  const lines: string[] = [];
  lines.push(`*LIC Policy Details*`);
  lines.push(`────────────────────────────`);

  if (cfg.includePolicyNumber) {
    lines.push(`📋 *Policy No:* ${policy.policyNumber}`);
  }
  if (cfg.includeCustomerName && policy.customerName) {
    lines.push(`👤 *Policyholder:* ${policy.customerName}`);
  }

  if (cfg.includePlan) {
    const planParts: string[] = [];
    if (policy.planCode) planParts.push(`Plan: ${policy.planCode}`);
    if (policy.policyTerm) planParts.push(`Term: ${policy.policyTerm} yrs`);
    if (policy.premiumPayingTerm) planParts.push(`PPT: ${policy.premiumPayingTerm} yrs`);
    if (planParts.length > 0) {
      lines.push(`📄 *Plan / Term:* ${planParts.join(' | ')}`);
    }
  }

  if (cfg.includeSumAssured && policy.sumAssured && policy.sumAssured > 0) {
    lines.push(`💰 *Sum Assured:* ${formatCurrency(policy.sumAssured)}`);
  }

  if (cfg.includePremium && policy.premiumAmount && policy.premiumAmount > 0) {
    lines.push(`💳 *Premium:* ${formatCurrency(policy.premiumAmount)} (${policy.premiumMode || 'Yearly'})`);
  }

  if (cfg.includeDueDate && policy.firstUnpaidPremiumDate) {
    lines.push(`⏳ *Next Due Date:* ${formatDate(policy.firstUnpaidPremiumDate)}`);
  }

  if (cfg.includeMaturityDate) {
    const dom = getPolicyMaturityDate(policy);
    if (dom) {
      lines.push(`🎯 *Maturity Date:* ${formatDate(dom)}`);
    }
  }

  if (cfg.includeStatus) {
    lines.push(`────────────────────────────`);
    if (isDue) {
      lines.push(`⚠️ *STATUS: PREMIUM DUE*`);
      lines.push(`_Kindly pay the premium at the earliest to ensure uninterrupted life cover and benefits._`);
    } else if (status === 'matured') {
      lines.push(`🎓 *STATUS: MATURED*`);
    } else if (status === 'claimed') {
      lines.push(`🛡️ *STATUS: CLAIMED*`);
    } else if (status === 'surrendered') {
      lines.push(`📋 *STATUS: SURRENDERED*`);
    } else {
      lines.push(`✅ *STATUS: ACTIVE*`);
    }
  }

  if (cfg.includeAgentDetails && agentInfo && (agentInfo.name || agentInfo.mobile)) {
    lines.push(`────────────────────────────`);
    if (agentInfo.name) lines.push(`*Advisor:* ${agentInfo.name}`);
    if (agentInfo.mobile) lines.push(`*Contact:* ${agentInfo.mobile}`);
  }

  return lines.join('\n');
}

/**
 * Share text using native App Chooser (navigator.share) so user decides which app to send with.
 * Falls back to generic WhatsApp share without pre-filled number so user chooses contact manually.
 */
export async function sharePolicyMessage(
  text: string,
  title: string = 'LIC Policy Details'
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User dismissed share sheet
    }
  }

  // Fallback: Opens WhatsApp without pre-filling the number so user searches and selects contact manually
  const encodedText = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open Share dialog with pre-filled policy details formatted with custom settings
 */
export function openPolicyWhatsAppShare(
  policy: Parameters<typeof generatePolicyWhatsAppMessage>[0],
  _mobileNumber?: string | null,
  settings?: Partial<ReminderShareSettings>,
  agentInfo?: { name?: string; mobile?: string }
): void {
  const text = generatePolicyWhatsAppMessage(policy, settings, agentInfo);
  sharePolicyMessage(text, `LIC Policy ${policy.policyNumber}`);
}
