import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  Search,
  Upload,
  Cloud,
  User,
  Users,
  FileText,
  Bell,
  Sparkles,
  Zap,
  Lock,
  MessageSquare,
  Award,
  ChevronRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { AppLogo } from '@/components/shared/AppLogo';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { AgencyCloudModal } from '@/components/auth/AgencyCloudModal';
import { GlobalSearchModal } from '@/components/shared/GlobalSearchModal';
import { analyticsService, type DashboardStats } from '@/features/analytics/analyticsService';
import { profileRepository, type AgentProfile, DEFAULT_PROFILE } from '@/db/repositories/profileRepository';
import { formatCurrency } from '@/utils/formatters';

export function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, profileData] = await Promise.all([
          analyticsService.getDashboardStats().catch(() => null),
          profileRepository.getProfile().catch(() => DEFAULT_PROFILE),
        ]);
        if (statsData) setStats(statsData);
        if (profileData) setProfile(profileData);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const hasData = stats && stats.totalPolicies > 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-[#071326] to-slate-900 text-white pt-8 pb-14 px-4 sm:px-6 lg:px-8 border-b border-blue-900/40">
        {/* Ambient Decorative Blurs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-6">
          {/* Logo & Vow */}
          <div className="flex flex-col items-center space-y-3">
            <AppLogo size={76} />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>योगक्षेमं वहाम्यहम् • Your Welfare Is Our Responsibility</span>
            </div>
          </div>

          {/* Main Title */}
          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              LIC Agent <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">Companion</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
              The high-performance, private mobile workspace built exclusively for Indian Life Insurance Advisors. Manage policies, customers, F.U.P. dates, and premium follow-ups with zero monthly server fees.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full max-w-md">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20 text-sm px-7 py-3 border-none"
              rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
            >
              Enter Policy Dashboard
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsSearchOpen(true)}
              className="w-full sm:w-auto border-white/25 text-white hover:bg-white/10 text-sm px-6 py-3"
              leftIcon={<Search className="w-4 h-4 text-amber-400" />}
            >
              Search Policies
            </Button>
          </div>

          {/* Secondary Quick Jump Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 pt-1">
            <button
              onClick={() => setIsRestoreModalOpen(true)}
              className="flex items-center gap-1.5 hover:text-white transition underline underline-offset-4 decoration-slate-600"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span>Restore by Agency Code</span>
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => navigate('/import')}
              className="flex items-center gap-1.5 hover:text-white transition underline underline-offset-4 decoration-slate-600"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Import Policy PDF</span>
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 hover:text-white transition underline underline-offset-4 decoration-slate-600"
            >
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>Agent Profile</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Hub */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {/* Agent Profile & Live Status Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xl flex items-center justify-center shrink-0 shadow-md">
              {profile.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'AG'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {profile.fullName}
                </h2>
                <Badge variant="purple" size="sm">
                  <Award className="w-3 h-3 mr-1 text-amber-500" />
                  {profile.clubMembership}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {profile.agencyCode ? `Agency Code: ${profile.agencyCode}` : 'Agency Code not configured'}
                {profile.branchName && ` • ${profile.branchName}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile')}
              leftIcon={<User className="w-3.5 h-3.5" />}
            >
              Edit Details
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/dashboard')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Launch App
            </Button>
          </div>
        </div>

        {/* Live Metrics Grid (if data imported) or Fast Onboarding Card */}
        {hasData ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Current Portfolio Snapshot
              </h3>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer" onClick={() => navigate('/dashboard')}>
                View Full Analytics →
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] text-slate-400 uppercase font-medium block">Total Policies</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white block mt-1">
                  {stats?.totalPolicies.toLocaleString() || 0}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">Active Records</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] text-slate-400 uppercase font-medium block">Unique Customers</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white block mt-1">
                  {stats?.totalCustomers.toLocaleString() || 0}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Linked Profiles</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] text-slate-400 uppercase font-medium block">Total Sum Assured</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white block mt-1 truncate">
                  {formatCurrency(stats?.totalSumAssured || 0)}
                </span>
                <span className="text-[11px] text-blue-600 font-medium block mt-0.5">Under Protection</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] text-slate-400 uppercase font-medium block">F.U.P. Attention</span>
                <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 block mt-1">
                  {stats?.fupRequiringAttentionCount || 0}
                </span>
                <span className="text-[11px] text-amber-600 font-medium block mt-0.5">Follow-ups Required</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Have an existing agency dataset or reinstalled?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Restore all policies from Cloudflare D1 with your Agency Code, or upload your PDF report.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="primary" size="sm" onClick={() => setIsRestoreModalOpen(true)} leftIcon={<Download className="w-4 h-4" />}>
                Restore Cloud Data
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/import')} leftIcon={<Upload className="w-4 h-4" />}>
                Import PDF
              </Button>
            </div>
          </div>
        )}

        {/* Feature Pillars Grid */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            Core Architecture Highlights
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Feature 1 */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                100% Offline & Instant
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Operates with full speed without an internet connection using on-device IndexedDB storage. Customer searches execute in under 10 milliseconds.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Free Cloudflare D1 Sync
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sync all policies tagged by your Agency Code. If you uninstall the app or get a new phone, entering your Agency Code and PIN restores everything.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                1-Tap WhatsApp Follow-ups
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Directly dispatch pre-formatted premium due and maturity reminders through WhatsApp with your custom agency signature.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launchpad Navigation */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            Quick Launchpad
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => navigate('/policies')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition text-left shadow-xs flex flex-col justify-between h-28 group"
            >
              <FileText className="w-5 h-5 text-blue-600 group-hover:scale-110 transition" />
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">All Policies</span>
                <span className="text-[11px] text-slate-400 block">Search & filter plans</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/customers')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 transition text-left shadow-xs flex flex-col justify-between h-28 group"
            >
              <Users className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition" />
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">Customer Hub</span>
                <span className="text-[11px] text-slate-400 block">Profiles & policy count</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/reminders')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition text-left shadow-xs flex flex-col justify-between h-28 group"
            >
              <Bell className="w-5 h-5 text-amber-500 group-hover:scale-110 transition" />
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">Reminders</span>
                <span className="text-[11px] text-slate-400 block">Follow-up schedule</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-400 transition text-left shadow-xs flex flex-col justify-between h-28 group"
            >
              <User className="w-5 h-5 text-purple-600 group-hover:scale-110 transition" />
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">Agent Profile</span>
                <span className="text-[11px] text-slate-400 block">Personal & branch info</span>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AppLogo size={20} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">LIC Agent Companion</span>
            <span>• Private Offline Architecture</span>
          </div>
          <p className="text-[11px] text-slate-400">
            For Life Insurance Advisors in India. Confidential & encrypted on-device.
          </p>
        </div>
      </footer>

      {/* Modals */}
      <AgencyCloudModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        mode="pull"
        onSuccess={() => navigate('/dashboard')}
      />

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
