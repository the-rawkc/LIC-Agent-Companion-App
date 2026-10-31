import React, { useState, useEffect } from 'react';
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
  Download,
  KeyRound,
  UserPlus,
  Phone,
  AlertCircle,
  CheckCircle2,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { AppLogo } from '@/components/shared/AppLogo';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { AgencyCloudModal } from '@/components/auth/AgencyCloudModal';
import { GlobalSearchModal } from '@/components/shared/GlobalSearchModal';
import { analyticsService, type DashboardStats } from '@/features/analytics/analyticsService';
import { profileRepository, type AgentProfile, DEFAULT_PROFILE } from '@/db/repositories/profileRepository';
import { authService, type AgentAccount } from '@/services/auth/authService';
import { switchAgentDatabase } from '@/db/database';
import { formatCurrency } from '@/utils/formatters';

export function LandingPage() {
  const navigate = useNavigate();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [currentAgent, setCurrentAgent] = useState<AgentAccount | null>(authService.getCurrentAgent());
  const [registeredAgents, setRegisteredAgents] = useState<AgentAccount[]>([]);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // Form States
  const [loginAgencyCode, setLoginAgencyCode] = useState('');
  const [loginPin, setLoginPin] = useState('');
  
  const [regAgencyCode, setRegAgencyCode] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regName, setRegName] = useState('');
  const [regPin, setRegPin] = useState('');

  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dashboard / Profile State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);
    const agent = authService.getCurrentAgent();
    setCurrentAgent(agent);
    const saved = authService.getRegisteredAgents();
    setRegisteredAgents(saved);

    // If there are registered agents and none logged in, prefill the first one in login form
    if (!isAuth && saved.length > 0 && !loginAgencyCode) {
      setLoginAgencyCode(saved[0].agencyCode);
    }

    if (isAuth) {
      loadAgentData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  async function loadAgentData() {
    setIsLoading(true);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await authService.login(loginAgencyCode, loginPin);
      const notice = res.restoredFromLegacy || res.restoredFromCloud
        ? `Welcome back, ${res.agent.agentName}! Restored ${res.restoredCount} policies into your workspace.`
        : `Welcome back, ${res.agent.agentName}! Loading your workspace...`;
      setAuthSuccess(notice);
      setIsAuthenticated(true);
      setCurrentAgent(res.agent);
      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check your Agency Code and 4-digit PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!/^\d{4}$/.test(regPin)) {
      setAuthError('Security PIN must be exactly 4 numeric digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authService.register({
        agencyCode: regAgencyCode,
        mobileNumber: regMobile,
        agentName: regName,
        pin: regPin,
      });

      setAuthSuccess(`Account created! Welcome to your personal portal, Agent ${res.agent.agencyCode}.`);
      setIsAuthenticated(true);
      setCurrentAgent(res.agent);
      setTimeout(() => {
        navigate('/dashboard');
      }, 900);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed. Please verify your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentAgent(null);
    setLoginPin('');
    setAuthSuccess(null);
    setAuthError(null);
  };

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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-semibold tracking-wide shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>योगक्षेमं वहाम्यहम् • Your Welfare Is Our Responsibility</span>
            </div>
          </div>

          {/* Main Title */}
          <div className="space-y-2.5 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              LIC Agent <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">Companion</span>
            </h1>
            <p className="text-xs sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
              Private, mobile-first insurance workspace for Indian Life Insurance Advisors. Manage policies, customers, F.U.P. tracking, and reminders with 100% individual agent data privacy.
            </p>
          </div>

          {/* ========================================================================= */}
          {/* AUTHENTICATION PORTAL (Shown if NOT Logged In) */}
          {/* ========================================================================= */}
          {!isAuthenticated ? (
            <div className="w-full max-w-md mx-auto text-left bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white mt-2 animate-in fade-in zoom-in-95 duration-200">
              {/* Tab Selector */}
              <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                    authTab === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Agent Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                    authTab === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                  <span>Register First Time</span>
                </button>
              </div>

              {/* Status Alerts */}
              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 mb-4 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300 mb-4 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* Quick Select for Existing Registered Agents on this device */}
              {authTab === 'login' && registeredAgents.length > 0 && (
                <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
                    Select Agent Account:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {registeredAgents.map((ag) => (
                      <button
                        key={ag.agencyCode}
                        type="button"
                        onClick={() => {
                          setLoginAgencyCode(ag.agencyCode);
                          setAuthError(null);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          loginAgencyCode === ag.agencyCode
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <User className="w-3 h-3 text-amber-500" />
                        <span>{ag.agencyCode}</span>
                        <span className="text-[10px] text-slate-400">({ag.agentName})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* LOGIN FORM */}
              {authTab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Agency Code *
                    </label>
                    <input
                      type="text"
                      value={loginAgencyCode}
                      onChange={(e) => setLoginAgencyCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 03847291"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        4-Digit Security PIN *
                      </label>
                      <span className="text-[10px] text-slate-400">4 numbers</span>
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-base tracking-widest text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black shadow-md border-none mt-2"
                  >
                    {isSubmitting ? 'Authenticating...' : 'Log In to My Workspace'}
                  </Button>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => setAuthTab('register')}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                    >
                      New Agent? Register here →
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRestoreModalOpen(true)}
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Cloud className="w-3 h-3" />
                      <span>Cloud Restore</span>
                    </button>
                  </div>
                </form>
              )}

              {/* REGISTER FORM */}
              {authTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Agency Code *
                      </label>
                      <input
                        type="text"
                        value={regAgencyCode}
                        onChange={(e) => setRegAgencyCode(e.target.value.toUpperCase())}
                        placeholder="e.g. 03847291"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                        placeholder="10-digit number"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Advisor Full Name
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Create 4-Digit Security PIN *
                      </label>
                      <span className="text-[10px] text-slate-400">4 numbers (used to log in)</span>
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-base tracking-widest text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md border-none mt-2"
                  >
                    {isSubmitting ? 'Creating Account...' : 'Create Personal Agent Account'}
                  </Button>

                  <div className="pt-2 text-center text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() => setAuthTab('login')}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      Already registered? Log in here →
                    </button>
                  </div>
                </form>
              )}

              {/* Data Isolation Guarantee */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>100% Isolated Data per Agent</span>
                </span>
                <span>Encrypted on-device</span>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* LOGGED IN AGENT WELCOME BANNER */
            /* ========================================================================= */
            <div className="w-full max-w-lg mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 sm:p-6 shadow-xl text-center space-y-4 animate-in fade-in">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-2xl flex items-center justify-center shadow-md">
                  {currentAgent?.agentName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'AG'}
                </div>
                <h3 className="text-xl font-extrabold text-white mt-2">
                  {currentAgent?.agentName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-mono font-bold">
                    Agency: {currentAgent?.agencyCode}
                  </span>
                  <span className="text-xs text-slate-300">• Account Active</span>
                </div>
              </div>

              {/* Logged in Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm px-7 py-3 border-none"
                  rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
                >
                  Enter Policy Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsSearchOpen(true)}
                  className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 text-sm px-5 py-3"
                  leftIcon={<Search className="w-4 h-4 text-amber-400" />}
                >
                  Search
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full sm:w-auto text-slate-300 hover:text-white hover:bg-white/10 text-xs"
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Switch Agent
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Hub (Shown only when Authenticated) */}
      {isAuthenticated && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 animate-in fade-in">
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
                Profile & Visiting Card
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

          {/* Live Metrics Grid or Fast Onboarding Card */}
          {hasData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Current Portfolio Snapshot
                </h3>
                <span
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"
                  onClick={() => navigate('/dashboard')}
                >
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
                    Ready to load your agency dataset?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Upload your policy PDF / Excel spreadsheet or restore existing policies from Cloudflare D1.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRestoreModalOpen(true)}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Restore Cloud Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/import')}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Import File
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
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Multi-Agent Privacy
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Each advisor's data is isolated into their dedicated local storage. Multiple advisors can share this device without cross-viewing client information.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Cloud className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cloudflare D1 Sync
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sync policies tagged by your Agency Code. If you uninstall the app or get a new device, entering your Agency Code and PIN restores everything.
                </p>
              </div>

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
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AppLogo size={20} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">LIC Agent Companion</span>
            <span>• Multi-Agent Architecture</span>
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
        onSuccess={() => {
          setIsAuthenticated(authService.isAuthenticated());
          navigate('/dashboard');
        }}
      />

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
