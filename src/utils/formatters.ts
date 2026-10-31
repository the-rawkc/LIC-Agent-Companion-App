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
 * Robust date parser handling DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 * Returns normalized 'YYYY-MM-DD' or null if invalid / 00/00/0000
 */
export function parseDateToISO(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  
  // LIC report often uses 00/00/0000 or 99/99/9999 for missing or lifetime dates
  if (trimmed === '00/00/0000' || trimmed === '0/0/0000' || trimmed.startsWith('00/')) {
    return null;
  }
  if (trimmed === '99/99/9999') {
    return '2099-12-31'; // Or preserve as special end of century
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const paddedDay = day.toString().padStart(2, '0');
      const paddedMonth = month.toString().padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
  }

  // Check YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
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
