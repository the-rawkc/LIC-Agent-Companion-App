import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Users,
  AlertCircle,
  Calendar,
  IndianRupee,
  Upload,
  Plus,
  Bell,
  HardDrive,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Phone,
  Cloud,
  ArrowDownCircle
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { AgencyCloudModal } from '@/components/auth/AgencyCloudModal';
import { analyticsService, type DashboardStats } from '@/features/analytics/analyticsService';
import { importService } from '@/services/import/importService';
import { SAMPLE_RAW_POLICY_ROWS } from '@/services/sampleData/licSampleRecords';
import { reminderRepository } from '@/db/repositories/reminderRepository';
import { authService } from '@/services/auth/authService';
import { getActiveAgencyCode } from '@/db/database';
import { formatCurrency, formatDate } from '@/utils/formatters';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'fup' | 'maturities' | 'reminders'>('fup');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [recoveredBanner, setRecoveredBanner] = useState<string | null>(null);
  const [hasOutdatedData, setHasOutdatedData] = useState(false);
  const [isReloadingExcel, setIsReloadingExcel] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const code = getActiveAgencyCode();
      if (code) {
        // Ensure personal credentials and profile are migrated / restored
        await authService.restoreOrMigrateProfile(code);
      }

      let data = await analyticsService.getDashboardStats();
      if (data.totalPolicies === 0) {
        if (code) {
          const pin = sessionStorage.getItem('lic_session_pin') || undefined;
          const res = await authService.autoRestoreOrMigrateData(code, pin);
          if (res.restored) {
            data = await analyticsService.getDashboardStats();
            setRecoveredBanner(`Successfully restored ${res.count} policies into your workspace!`);
            setTimeout(() => setRecoveredBanner(null), 6000);
          }
        }
      }

      // Check if browser has mismatched/outdated data from previous imports
      const needsRepair = await importService.checkNeedsDataRepair();
      setHasOutdatedData(needsRepair);

      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCleanAndReloadExcel = async () => {
    setIsReloadingExcel(true);
    try {
      const res = await importService.resetAndReloadUserExcelData();
      setHasOutdatedData(false);
      setRecoveredBanner(`Successfully deleted old records and cleanly imported ${res.totalLoaded} policies from Excel!`);
      setTimeout(() => setRecoveredBanner(null), 6000);
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to reload Excel policies', err);
      alert('Failed to reload Excel policies: ' + String(err));
    } finally {
      setIsReloadingExcel(false);
    }
  };

  const handleLoadDemoData = async () => {
    await handleCleanAndReloadExcel();
  };

  const handleToggleReminder = async (id: string) => {
    await reminderRepository.toggleStatus(id);
    await loadDashboardData();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading your companion...</p>
        </div>
      </div>
    );
  }

  const hasData = stats && stats.totalPolicies > 0;

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Recovery Notice Banner */}
      {recoveredBanner && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{recoveredBanner}</span>
        </div>
      )}

      {/* Outdated / Corrupt Data Repair Alert */}
      {hasOutdatedData && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Outdated Policy Records in Browser</h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Your browser contains previous records where customer names do not match policy numbers. Click below to delete all old records and cleanly reload your 1,516 policies from your Excel file.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCleanAndReloadExcel}
            isLoading={isReloadingExcel}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-none shrink-0"
            leftIcon={<Sparkles className="w-4 h-4 text-slate-950" />}
          >
            Delete All & Reload 1,516 Policies
          </Button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium mb-2.5 border border-blue-400/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Your Personal Insurance Companion</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              LIC Agent Companion
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-xl">
              All policy records and client details stay private and safe on your device.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/import')}
              className="border-white/20 text-white hover:bg-white/10 dark:border-white/20"
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import Policies
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/policies?action=new')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-none"
              leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
            >
              Add Policy
            </Button>
          </div>
        </div>
      </div>

      {/* Zero State Onboarding */}
      {!hasData ? (
        <div className="space-y-4">
          {/* Reinstalled / Switching device banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Reinstalled or switching phone?
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Restore all your previously saved policies and customers with your <strong>Agency Code</strong>.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRestoreModalOpen(true)}
              leftIcon={<ArrowDownCircle className="w-4 h-4" />}
            >
              Download Saved Backup
            </Button>
          </div>

          <EmptyState
            icon={<FileText className="w-8 h-8 text-blue-600" />}
            title="No policy records yet"
            description="Your app is ready. Upload your LIC policy list (Excel or PDF) or load your 1,516 policies directly."
            actionLabel="Import Policies"
            onAction={() => navigate('/import')}
            actionIcon={<Upload className="w-4 h-4" />}
            secondaryActionLabel={isReloadingExcel ? 'Loading 1,516 Policies...' : 'Load 1,516 Policies from Excel'}
            onSecondaryAction={handleCleanAndReloadExcel}
          />
        </div>
      ) : (
        <>
          {/* Quick Stat Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <StatCard
              title="Total Policies"
              value={stats.totalPolicies}
              subtitle="Recorded in local database"
              icon={<FileText className="w-5 h-5 text-blue-600" />}
              onClick={() => navigate('/policies')}
            />
            <StatCard
              title="Unique Customers"
              value={stats.totalCustomers}
              subtitle="Insured individuals"
              icon={<Users className="w-5 h-5 text-indigo-600" />}
              onClick={() => navigate('/customers')}
            />
            <StatCard
              title="Recorded Premium Sum"
              value={formatCurrency(stats.totalRecordedPremiumSum)}
              subtitle="Sum of policy installment values"
              icon={<IndianRupee className="w-5 h-5 text-emerald-600" />}
              onClick={() => navigate('/analytics')}
            />
            <StatCard
              title="Attention Needed"
              value={stats.fupRequiringAttentionCount + stats.policiesWithWarningsCount}
              subtitle={`${stats.fupRequiringAttentionCount} FUP past/due • ${stats.policiesWithWarningsCount} warnings`}
              icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
              trendType={stats.fupRequiringAttentionCount > 0 ? 'warning' : 'neutral'}
              onClick={() => {
                setActiveTab('fup');
                document.getElementById('action-feed')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>

          {/* Action Feed Tabs (Attention FUP, Upcoming Maturities, Today's Follow-ups) */}
          <div id="action-feed" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Follow-up & Due Dates
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Targeted tracking based on recorded F.U.P. and maturity schedules
                </p>
              </div>

              {/* Feed Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                <button
                  onClick={() => setActiveTab('fup')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'fup'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  F.U.P. Attention ({stats.fupRequiringAttentionCount})
                </button>
                <button
                  onClick={() => setActiveTab('maturities')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'maturities'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Upcoming Maturities ({stats.upcomingMaturitiesCount})
                </button>
                <button
                  onClick={() => setActiveTab('reminders')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'reminders'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Reminders ({stats.pendingRemindersCount})
                </button>
              </div>
            </div>

            {/* Tab 1: F.U.P. Attention */}
            {activeTab === 'fup' && (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {stats.attentionFupList.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No overdue or urgent F.U.P. dates requiring immediate attention.
                  </p>
                ) : (
                  stats.attentionFupList.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/policies/${p.id}`)}
                      className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                            {p.policyNumber}
                          </span>
                          <Badge variant="warning" size="sm">
                            F.U.P. {formatDate(p.firstUnpaidPremiumDate)}
                          </Badge>
                          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                            Plan {p.originalPlanString}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words">
                          {p.customerName} • Premium: {formatCurrency(p.premiumAmount)} ({p.premiumMode})
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Upcoming Maturities */}
            {activeTab === 'maturities' && (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {stats.upcomingMaturitiesList.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No maturities due in the next 180 days.
                  </p>
                ) : (
                  stats.upcomingMaturitiesList.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/policies/${p.id}`)}
                      className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                            {p.policyNumber}
                          </span>
                          <Badge variant="info" size="sm">
                            Matures {formatDate(p.maturityDate)}
                          </Badge>
                          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                            Plan {p.originalPlanString}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words">
                          {p.customerName} • Sum Assured: {formatCurrency(p.sumAssured)}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Reminders */}
            {activeTab === 'reminders' && (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {stats.upcomingRemindersList.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No active pending reminders.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/reminders?action=new')}
                      className="mt-3"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Create First Reminder
                    </Button>
                  </div>
                ) : (
                  stats.upcomingRemindersList.map((r) => (
                    <div
                      key={r.id}
                      className="py-3 flex items-start justify-between gap-3 px-2 rounded-xl"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleReminder(r.id)}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition ${
                            r.status === 'completed'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                          }`}
                        >
                          {r.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                            {r.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Due {formatDate(r.dueDate)} • {r.description}
                          </p>
                        </div>
                      </div>
                      <Badge variant={r.priority === 'high' ? 'danger' : 'default'} size="sm">
                        {r.priority}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Quick Actions Footer Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => navigate('/customers')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition flex items-center gap-3 text-left shadow-xs"
            >
              <Users className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Directory</p>
                <p className="text-[11px] text-slate-400">View customer list</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition flex items-center gap-3 text-left shadow-xs"
            >
              <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Analytics</p>
                <p className="text-[11px] text-slate-400">Portfolios & trends</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition flex items-center gap-3 text-left shadow-xs"
            >
              <HardDrive className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Backup</p>
                <p className="text-[11px] text-slate-400">Save encrypted copy</p>
              </div>
            </button>
            <button
              onClick={handleLoadDemoData}
              disabled={isDemoLoading}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 transition flex items-center gap-3 text-left shadow-xs"
            >
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isDemoLoading ? 'Loading...' : 'Sample Data'}
                </p>
                <p className="text-[11px] text-slate-400">Add test policies</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Cloud Restore Modal */}
      <AgencyCloudModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        mode="pull"
        onSuccess={() => loadDashboardData()}
      />
    </div>
  );
}
