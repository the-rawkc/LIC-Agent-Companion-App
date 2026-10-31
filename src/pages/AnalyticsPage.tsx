import { useState, useEffect } from 'react';
import {
  BarChart3,
  PieChart,
  Calendar,
  AlertTriangle,
  FileText,
  Users,
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  Info
} from 'lucide-react';
import { analyticsService, type AnalyticsData } from '@/features/analytics/analyticsService';
import { formatCurrency } from '@/utils/formatters';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setIsLoading(true);
    try {
      const res = await analyticsService.getAnalyticsData();
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Calculating portfolio distributions...</p>
        </div>
      </div>
    );
  }

  const maxPlanCount = Math.max(...data.byPlan.map((p) => p.count), 1);
  const maxYearCount = Math.max(...data.byCommencementYear.map((y) => y.count), 1);
  const maxMaturityCount = Math.max(...data.byMaturityYear.map((y) => y.count), 1);

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <span>Portfolio Analytics & Insights</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Breakdowns derived exclusively from actual policy records in your local database
        </p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Total Policies"
          value={data.totalPolicies}
          subtitle="Registered in system"
          icon={<FileText className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="Unique Customers"
          value={data.totalCustomers}
          subtitle={`Avg ${(data.totalPolicies / Math.max(data.totalCustomers, 1)).toFixed(1)} policies/person`}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Plans Represented"
          value={data.byPlan.length}
          subtitle="Distinct insurance plans"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Data Quality Alerts"
          value={data.dataQuality.zeroSumAssured + data.dataQuality.hasWarnings}
          subtitle={`${data.dataQuality.zeroSumAssured} zero sum • ${data.dataQuality.missingDob} no DOB`}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        />
      </div>

      {/* Disclaimers & Metric Explanation */}
      <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Important clarification:</strong> Financial metrics indicate the recorded installment premiums
          and sum assured as extracted from the agent's report. They do not represent annual recurring income,
          official commissions, or guaranteed surrender payouts.
        </p>
      </div>

      {/* Grid: Plan Breakdown & Mode Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Policies by Plan */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Top Plans by Volume</span>
            </h2>
            <span className="text-xs text-slate-400">Policies & Premium Sum</span>
          </div>

          <div className="space-y-3">
            {data.byPlan.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No policy records available.</p>
            ) : (
              data.byPlan.map((p) => {
                const percentage = Math.round((p.count / maxPlanCount) * 100);
                return (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        Plan {p.plan}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        <strong>{p.count}</strong> policies • {formatCurrency(p.totalPremium)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Premium Mode Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>Payment Mode Distribution</span>
            </h2>
            <span className="text-xs text-slate-400">% of Total Portfolio</span>
          </div>

          <div className="space-y-3">
            {data.byMode.map((m) => (
              <div key={m.mode} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {m.mode}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    <strong>{m.count}</strong> policies ({m.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${m.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Commencement Years & Upcoming Maturity Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commencement Timeline */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Commencement Timeline (D.O.C.)</span>
            </h2>
            <span className="text-xs text-slate-400">Yearly Issuance</span>
          </div>

          <div className="space-y-2">
            {data.byCommencementYear.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No commencement dates recorded.</p>
            ) : (
              data.byCommencementYear.map((y) => {
                const pct = Math.round((y.count / maxYearCount) * 100);
                return (
                  <div key={y.year} className="flex items-center gap-3 text-xs">
                    <span className="w-12 font-mono text-slate-500 font-semibold">{y.year}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-bold text-slate-800 dark:text-slate-200">
                      {y.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Maturity Forecast */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span>Upcoming Maturity Schedule (D.O.M.)</span>
            </h2>
            <span className="text-xs text-slate-400">Claim Workload</span>
          </div>

          <div className="space-y-2">
            {data.byMaturityYear.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No maturity dates recorded.</p>
            ) : (
              data.byMaturityYear.map((m) => {
                const pct = Math.round((m.count / maxMaturityCount) * 100);
                return (
                  <div key={m.year} className="flex items-center gap-3 text-xs">
                    <span className="w-12 font-mono text-slate-500 font-semibold">{m.year}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-bold text-slate-800 dark:text-slate-200">
                      {m.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Premium Brackets & Data Quality Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Premium Amount Brackets */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-blue-600" />
            <span>Installment Premium Distribution</span>
          </h2>

          <div className="space-y-2 pt-2">
            {data.premiumBrackets.map((b) => (
              <div key={b.bracket} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300 font-medium">{b.bracket}</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{b.count} policies</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Quality & Integrity Audit */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Data Quality & Integrity Audit</span>
          </h2>

          <div className="space-y-2 pt-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">Sum Assured = 0</span>
                <span className="text-[11px] text-slate-400">Reported as 0 in source PDF</span>
              </div>
              <Badge variant={data.dataQuality.zeroSumAssured > 0 ? 'warning' : 'success'}>
                {data.dataQuality.zeroSumAssured} records
              </Badge>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">Missing DOB</span>
                <span className="text-[11px] text-slate-400">Recorded as 00/00/0000 or blank</span>
              </div>
              <Badge variant="default">{data.dataQuality.missingDob} records</Badge>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">Extraction Warnings</span>
                <span className="text-[11px] text-slate-400">Flagged for manual agent review</span>
              </div>
              <Badge variant={data.dataQuality.hasWarnings > 0 ? 'warning' : 'success'}>
                {data.dataQuality.hasWarnings} records
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
