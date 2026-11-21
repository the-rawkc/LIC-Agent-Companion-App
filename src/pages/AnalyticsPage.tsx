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
  Info,
  ChevronRight,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { analyticsService, type AnalyticsData } from '@/features/analytics/analyticsService';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { db } from '@/db/database';
import { formatCurrency, formatDate, parseCleanNumber } from '@/utils/formatters';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import type { Policy } from '@/types';

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data Quality Audit Modal State
  const [activeAuditModal, setActiveAuditModal] = useState<'zero_sum' | 'missing_dob' | null>(null);
  const [auditPolicies, setAuditPolicies] = useState<Policy[]>([]);
  const [isLoadingAuditList, setIsLoadingAuditList] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const handleOpenAuditModal = async (type: 'zero_sum' | 'missing_dob') => {
    setActiveAuditModal(type);
    setIsLoadingAuditList(true);
    setEditingPolicyId(null);
    setEditSuccessMsg(null);
    try {
      const allPolicies = await db.policies.toArray();
      if (type === 'zero_sum') {
        setAuditPolicies(allPolicies.filter((p) => (p.sumAssured || 0) === 0));
      } else {
        setAuditPolicies(
          allPolicies.filter(
            (p) => !p.dateOfBirth || p.dateOfBirth.trim() === '' || p.dateOfBirth.includes('00/00/0000')
          )
        );
      }
    } catch (err) {
      console.error('Failed to load audit records', err);
    } finally {
      setIsLoadingAuditList(false);
    }
  };

  const handleStartEdit = (policy: Policy) => {
    setEditingPolicyId(policy.id);
    if (activeAuditModal === 'zero_sum') {
      setEditValue(policy.sumAssured > 0 ? String(policy.sumAssured) : '');
    } else {
      setEditValue(policy.dateOfBirth || '');
    }
  };

  const handleSaveAuditEdit = async (policy: Policy) => {
    if (!editValue.trim()) return;
    setIsSavingEdit(true);
    try {
      if (activeAuditModal === 'zero_sum') {
        const val = parseCleanNumber(editValue);
        if (val <= 0) {
          alert('Please enter a valid Sum Assured greater than 0.');
          setIsSavingEdit(false);
          return;
        }
        const updatedWarnings = (policy.extractionWarnings || []).filter(
          (w) => !w.toLowerCase().includes('sum assured')
        );
        await policyRepository.update(policy.id, {
          sumAssured: val,
          extractionWarnings: updatedWarnings,
        });
        setAuditPolicies((prev) =>
          prev.map((p) =>
            p.id === policy.id ? { ...p, sumAssured: val, extractionWarnings: updatedWarnings } : p
          )
        );
        setEditSuccessMsg(`Updated Sum Assured for Policy ${policy.policyNumber} to ${formatCurrency(val)}. Warning removed!`);
      } else if (activeAuditModal === 'missing_dob') {
        const val = editValue.trim();
        const updatedWarnings = (policy.extractionWarnings || []).filter(
          (w) => !w.toLowerCase().includes('dob') && !w.toLowerCase().includes('date of birth')
        );
        await policyRepository.update(policy.id, {
          dateOfBirth: val,
          extractionWarnings: updatedWarnings,
        });
        if (policy.customerId) {
          const cust = await customerRepository.getById(policy.customerId);
          if (cust && !cust.dateOfBirth) {
            await customerRepository.update(cust.id, { dateOfBirth: val });
          }
        }
        setAuditPolicies((prev) =>
          prev.map((p) =>
            p.id === policy.id ? { ...p, dateOfBirth: val, extractionWarnings: updatedWarnings } : p
          )
        );
        setEditSuccessMsg(`Updated Date of Birth for Policy ${policy.policyNumber} to ${formatDate(val)}. Warning removed!`);
      }

      setEditingPolicyId(null);
      setEditValue('');
      const refreshed = await analyticsService.getAnalyticsData();
      setData(refreshed);
      setTimeout(() => setEditSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to save update: ' + (err.message || String(err)));
    } finally {
      setIsSavingEdit(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span>Portfolio Analytics & Insights</span>
          </h1>
        </div>
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

        {/* Data Review & Fixes */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Data Review & Fixes</span>
          </h2>

          <div className="space-y-2 pt-2 text-xs">
            <button
              type="button"
              onClick={() => handleOpenAuditModal('zero_sum')}
              className="w-full flex items-center justify-between p-2 rounded-xl text-left border border-slate-100 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition group cursor-pointer"
            >
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  Missing Cover Amount
                </span>
                <span className="text-[11px] text-slate-400">
                  Click to review and fill in cover amount
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={data.dataQuality.zeroSumAssured > 0 ? 'warning' : 'success'}>
                  {data.dataQuality.zeroSumAssured} records
                </Badge>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAuditModal('missing_dob')}
              className="w-full flex items-center justify-between p-2 rounded-xl text-left border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition group cursor-pointer"
            >
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Missing Birthday
                </span>
                <span className="text-[11px] text-slate-400">
                  Click to review and fill in birthday
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={data.dataQuality.missingDob > 0 ? 'warning' : 'success'}>
                  {data.dataQuality.missingDob} records
                </Badge>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition" />
              </div>
            </button>

            <div className="flex items-center justify-between p-2">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300 block">Review Alerts</span>
                <span className="text-[11px] text-slate-400">Records that may need your attention</span>
              </div>
              <Badge variant={data.dataQuality.hasWarnings > 0 ? 'warning' : 'success'}>
                {data.dataQuality.hasWarnings} records
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Audit Records Modal with Inline Edit */}
      {activeAuditModal && (
        <Modal
          isOpen={!!activeAuditModal}
          onClose={() => {
            setActiveAuditModal(null);
            setEditingPolicyId(null);
          }}
          title={
            activeAuditModal === 'zero_sum'
              ? 'Policies with Missing Cover Amount'
              : 'Policies with Missing Birthday'
          }
          description={
            activeAuditModal === 'zero_sum'
              ? 'These policies have Cover Amount recorded as ₹0. Enter the correct cover amount to update the policy.'
              : 'These policies have a blank birthday. Enter the correct birthday to update the policy.'
          }
          maxWidth="2xl"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveAuditModal(null);
                setEditingPolicyId(null);
              }}
            >
              Close
            </Button>
          }
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {editSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            {isLoadingAuditList ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading matching records...
              </div>
            ) : auditPolicies.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No records found matching this audit filter. All records are valid!
              </div>
            ) : (
              <div className="space-y-2">
                {auditPolicies.map((p) => {
                  const isEditing = editingPolicyId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                              {p.policyNumber}
                            </span>
                            <Badge variant="info" size="sm" className="text-[10px]">
                              Plan {p.planCode}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                            {p.customerName}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block uppercase">
                            {activeAuditModal === 'zero_sum' ? 'Cover Amount' : 'Birthday'}
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {activeAuditModal === 'zero_sum'
                              ? formatCurrency(p.sumAssured)
                              : p.dateOfBirth
                              ? formatDate(p.dateOfBirth)
                              : 'Not recorded / blank'}
                          </span>
                        </div>
                      </div>

                      {/* Warnings if present */}
                      {p.extractionWarnings && p.extractionWarnings.length > 0 && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{p.extractionWarnings.join(' • ')}</span>
                        </div>
                      )}

                      {/* Edit controls */}
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex-1 min-w-[180px]">
                            {activeAuditModal === 'zero_sum' ? (
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder="Enter cover amount (₹)"
                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder="Enter birthday (DD/MM/YYYY)"
                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                            )}
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isSavingEdit || !editValue.trim()}
                            onClick={() => handleSaveAuditEdit(p)}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                          >
                            {isSavingEdit ? 'Saving...' : 'Save & Remove Warning'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPolicyId(null);
                              setEditValue('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-1 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEdit(p)}
                            leftIcon={<Edit2 className="w-3 h-3 text-blue-600" />}
                            className="text-xs"
                          >
                            Edit Value
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
