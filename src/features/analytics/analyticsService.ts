import { db } from '@/db/database';
import { getDaysDifference } from '@/utils/formatters';
import type { Policy, Customer, Reminder } from '@/types';

export interface DashboardStats {
  totalPolicies: number;
  totalCustomers: number;
  totalRecordedPremiumSum: number;
  totalSumAssured: number;
  policiesWithWarningsCount: number;
  zeroSumAssuredCount: number;
  fupRequiringAttentionCount: number; // Past due FUP or within 30 days
  upcomingMaturitiesCount: number; // In next 90 days
  remindersDueTodayCount: number;
  pendingRemindersCount: number;
  recentImportsCount: number;
  upcomingRemindersList: Reminder[];
  upcomingMaturitiesList: Policy[];
  attentionFupList: Policy[];
}

export interface AnalyticsData {
  totalPolicies: number;
  totalCustomers: number;
  byPlan: { plan: string; count: number; totalPremium: number }[];
  byMode: { mode: string; count: number; percentage: number }[];
  byCommencementYear: { year: string; count: number }[];
  byMaturityYear: { year: string; count: number }[];
  premiumBrackets: { bracket: string; count: number }[];
  dataQuality: {
    zeroSumAssured: number;
    missingDob: number;
    hasWarnings: number;
    total: number;
  };
}

export const analyticsService = {
  async getDashboardStats(referenceDate?: string): Promise<DashboardStats> {
    const [policies, customers, reminders, imports] = await Promise.all([
      db.policies.toArray(),
      db.customers.toArray(),
      db.reminders.toArray(),
      db.importHistory.toArray(),
    ]);

    const activeCustomerIds = new Set(policies.map((p) => p.customerId).filter(Boolean));
    const totalPolicies = policies.length;
    const totalCustomers = activeCustomerIds.size;
    const totalRecordedPremiumSum = policies.reduce((acc, p) => acc + (p.premiumAmount || 0), 0);
    const totalSumAssured = policies.reduce((acc, p) => acc + (p.sumAssured || 0), 0);

    let policiesWithWarningsCount = 0;
    let zeroSumAssuredCount = 0;
    const attentionFupList: Policy[] = [];
    const upcomingMaturitiesList: Policy[] = [];

    for (const p of policies) {
      if (p.extractionWarnings && p.extractionWarnings.length > 0) {
        policiesWithWarningsCount++;
      }
      if (p.sumAssured === 0) {
        zeroSumAssuredCount++;
      }

      // Check FUP
      const checkFupDate = p.verifiedNextPremiumDate || p.firstUnpaidPremiumDate;
      if (checkFupDate && checkFupDate !== '2099-12-31') {
        const diffDays = getDaysDifference(checkFupDate, referenceDate);
        // If overdue or due within next 45 days
        if (diffDays <= 45) {
          attentionFupList.push(p);
        }
      }

      // Check Maturity
      if (p.maturityDate) {
        const matDays = getDaysDifference(p.maturityDate, referenceDate);
        if (matDays >= 0 && matDays <= 180) {
          upcomingMaturitiesList.push(p);
        }
      }
    }

    // Reminders
    let remindersDueTodayCount = 0;
    let pendingRemindersCount = 0;
    const upcomingRemindersList: Reminder[] = [];

    for (const r of reminders) {
      if (r.status === 'pending') {
        pendingRemindersCount++;
        const diff = getDaysDifference(r.dueDate, referenceDate);
        if (diff === 0) {
          remindersDueTodayCount++;
        }
        if (diff >= -7 && diff <= 14) {
          upcomingRemindersList.push(r);
        }
      }
    }

    // Sort lists
    attentionFupList.sort((a, b) => (a.firstUnpaidPremiumDate > b.firstUnpaidPremiumDate ? 1 : -1));
    upcomingMaturitiesList.sort((a, b) => (a.maturityDate > b.maturityDate ? 1 : -1));
    upcomingRemindersList.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

    return {
      totalPolicies,
      totalCustomers,
      totalRecordedPremiumSum,
      totalSumAssured,
      policiesWithWarningsCount,
      zeroSumAssuredCount,
      fupRequiringAttentionCount: attentionFupList.length,
      upcomingMaturitiesCount: upcomingMaturitiesList.length,
      remindersDueTodayCount,
      pendingRemindersCount,
      recentImportsCount: imports.length,
      upcomingRemindersList: upcomingRemindersList.slice(0, 10),
      upcomingMaturitiesList: upcomingMaturitiesList.slice(0, 10),
      attentionFupList: attentionFupList.slice(0, 10),
    };
  },

  async getAnalyticsData(): Promise<AnalyticsData> {
    const [policies, customers] = await Promise.all([
      db.policies.toArray(),
      db.customers.toArray(),
    ]);

    const activeCustomerIds = new Set(policies.map((p) => p.customerId).filter(Boolean));
    const totalPolicies = policies.length;
    const totalCustomers = activeCustomerIds.size;

    // By Plan
    const planMap = new Map<string, { count: number; totalPremium: number }>();
    for (const p of policies) {
      const code = p.planCode || 'Unknown';
      const existing = planMap.get(code) || { count: 0, totalPremium: 0 };
      existing.count++;
      existing.totalPremium += p.premiumAmount || 0;
      planMap.set(code, existing);
    }

    const byPlan = Array.from(planMap.entries())
      .map(([plan, data]) => ({ plan, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // By Mode
    const modeMap = new Map<string, number>();
    for (const p of policies) {
      const mode = p.premiumMode || 'Unknown';
      modeMap.set(mode, (modeMap.get(mode) || 0) + 1);
    }

    const byMode = Array.from(modeMap.entries()).map(([mode, count]) => ({
      mode,
      count,
      percentage: totalPolicies > 0 ? Math.round((count / totalPolicies) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // By Commencement Year
    const docYearMap = new Map<string, number>();
    for (const p of policies) {
      if (p.commencementDate) {
        const year = p.commencementDate.substring(0, 4);
        if (/^\d{4}$/.test(year)) {
          docYearMap.set(year, (docYearMap.get(year) || 0) + 1);
        }
      }
    }

    const byCommencementYear = Array.from(docYearMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // By Maturity Year
    const domYearMap = new Map<string, number>();
    for (const p of policies) {
      if (p.maturityDate) {
        const year = p.maturityDate.substring(0, 4);
        if (/^\d{4}$/.test(year)) {
          domYearMap.set(year, (domYearMap.get(year) || 0) + 1);
        }
      }
    }

    const byMaturityYear = Array.from(domYearMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year))
      .slice(0, 15);

    // Premium Brackets
    const brackets = {
      'Under ₹2,000': 0,
      '₹2,000 - ₹5,000': 0,
      '₹5,001 - ₹15,000': 0,
      '₹15,001 - ₹50,000': 0,
      'Above ₹50,000': 0,
    };

    let zeroSum = 0;
    let missingDob = 0;
    let hasWarn = 0;

    for (const p of policies) {
      const prem = p.premiumAmount || 0;
      if (prem < 2000) brackets['Under ₹2,000']++;
      else if (prem <= 5000) brackets['₹2,000 - ₹5,000']++;
      else if (prem <= 15000) brackets['₹5,001 - ₹15,000']++;
      else if (prem <= 50000) brackets['₹15,001 - ₹50,000']++;
      else brackets['Above ₹50,000']++;

      if (p.sumAssured === 0) zeroSum++;
      if (!p.dateOfBirth) missingDob++;
      if (p.extractionWarnings && p.extractionWarnings.length > 0) hasWarn++;
    }

    const premiumBrackets = Object.entries(brackets).map(([bracket, count]) => ({
      bracket,
      count,
    }));

    return {
      totalPolicies,
      totalCustomers,
      byPlan,
      byMode,
      byCommencementYear,
      byMaturityYear,
      premiumBrackets,
      dataQuality: {
        zeroSumAssured: zeroSum,
        missingDob,
        hasWarnings: hasWarn,
        total: totalPolicies,
      },
    };
  }
};
