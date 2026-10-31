import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Award,
  Calendar,
  MessageSquare,
  Save,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
  LogOut,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { profileRepository, type AgentProfile, DEFAULT_PROFILE } from '@/db/repositories/profileRepository';
import { authService, type AgentAccount } from '@/services/auth/authService';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { AppLogo } from '@/components/shared/AppLogo';

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [currentAccount, setCurrentAccount] = useState<AgentAccount | null>(null);
  const [registeredAgents, setRegisteredAgents] = useState<AgentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    loadProfile();
    setCurrentAccount(authService.getCurrentAgent());
    setRegisteredAgents(authService.getRegisteredAgents());
  }, []);

  async function loadProfile() {
    setIsLoading(true);
    try {
      const current = authService.getCurrentAgent();
      if (current?.agencyCode) {
        await authService.restoreOrMigrateProfile(current.agencyCode);
      }
      const data = await profileRepository.getProfile();
      setProfile(data);
    } finally {
      setIsLoading(false);
    }
  }

  const handleInputChange = (field: keyof AgentProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await profileRepository.saveProfile(profile);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      console.error('Failed to save profile', err);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const copyVisitingCard = () => {
    const text = `🌟 Life Insurance Corporation of India (LIC)\n👤 ${profile.fullName}\n🎖️ ${profile.clubMembership}\n🆔 Agency Code: ${profile.agencyCode || 'N/A'}\n🏢 Branch: ${profile.branchName} (${profile.branchCode || 'N/A'})\n📱 Mobile: ${profile.mobileNumber || 'N/A'}\n✉️ Email: ${profile.email || 'N/A'}\n📍 Address: ${profile.officeAddress || 'N/A'}\n\n"Yogakshemam Vahamyaham" (Your Welfare Is My Responsibility)`;
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <User className="w-6 h-6 text-blue-600" />
            <span>Agent Profile & Identity</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your personal credentials, branch details, and custom customer signatures
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyVisitingCard}
            leftIcon={<Copy className="w-4 h-4" />}
          >
            {copiedNotice ? 'Card Copied!' : 'Share Visiting Card'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Profile updated successfully! Details will reflect across your workspace and backups.</span>
        </div>
      )}

      {/* Active Account & Multi-Agent Switcher Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Active Personal Account: {currentAccount?.agencyCode || profile.agencyCode}
              </h3>
              <Badge variant="success" size="sm">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Isolated Storage
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Logged in as {currentAccount?.agentName || profile.fullName}. All client policies, notes, and reminders are private to this account.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            authService.logout();
            navigate('/');
          }}
          className="border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
        >
          Switch Account / Log Out
        </Button>
      </div>

      {/* Hero Agent Identity Card (Digital Visiting Card Preview) */}
      <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-900/60">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-2xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white/20">
              {profile.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'AG'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge variant="purple" size="sm">
                  <Award className="w-3.5 h-3.5 mr-1 text-amber-300" />
                  {profile.clubMembership}
                </Badge>
                {profile.agencyCode && (
                  <Badge variant="info" size="sm">
                    Code: {profile.agencyCode}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {profile.fullName || 'Your Name Here'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-2">
                <span>{profile.branchName}</span>
                {profile.branchCode && <span>• Branch ({profile.branchCode})</span>}
                {profile.division && <span>• {profile.division}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end text-xs text-slate-300 space-y-1.5 border-t md:border-t-0 pt-4 md:pt-0 border-white/10">
            {profile.mobileNumber && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono">{profile.mobileNumber}</span>
              </span>
            )}
            {profile.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>{profile.email}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-amber-300/90 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Life Insurance Corporation of India</span>
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Personal Contact Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Personal & Contact Information
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Primary contact credentials for your insurance practice
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Agent Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="e.g. Ramesh Chandra Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Mobile Number
              </label>
              <input
                type="tel"
                value={profile.mobileNumber}
                onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp Business Number
              </label>
              <input
                type="tel"
                value={profile.whatsappNumber}
                onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                placeholder="e.g. 9876543210 (leave blank if same as mobile)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="e.g. advisor.lic@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office / Residential Address
              </label>
              <input
                type="text"
                value={profile.officeAddress}
                onChange={(e) => handleInputChange('officeAddress', e.target.value)}
                placeholder="e.g. Cabin #4, LIC Branch Office 12K, New Delhi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: LIC Professional Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                LIC Professional Credentials
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Agency code, branch mapping, and performance club recognition
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Agency Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.agencyCode}
                onChange={(e) => handleInputChange('agencyCode', e.target.value)}
                placeholder="e.g. 08345678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Used to sync & recover all policies from Cloudflare D1.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Club Membership / Designation
              </label>
              <select
                value={profile.clubMembership}
                onChange={(e) => handleInputChange('clubMembership', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MDRT Member (Million Dollar Round Table)">MDRT Member</option>
                <option value="COT Member (Court of the Table)">COT Member</option>
                <option value="TOT Member (Top of the Table)">TOT Member</option>
                <option value="Chairman's Club Member">Chairman's Club Member</option>
                <option value="Zonal Manager's Club Member">Zonal Manager's Club Member</option>
                <option value="Divisional Manager's Club Member">Divisional Manager's Club Member</option>
                <option value="Branch Manager's Club Member">Branch Manager's Club Member</option>
                <option value="Distinguished LIC Agent">Distinguished LIC Agent</option>
                <option value="Financial Advisor">Financial Advisor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                value={profile.branchName}
                onChange={(e) => handleInputChange('branchName', e.target.value)}
                placeholder="e.g. Connaught Place Branch"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Branch Code
              </label>
              <input
                type="text"
                value={profile.branchCode}
                onChange={(e) => handleInputChange('branchCode', e.target.value)}
                placeholder="e.g. 12K"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Division
              </label>
              <input
                type="text"
                value={profile.division}
                onChange={(e) => handleInputChange('division', e.target.value)}
                placeholder="e.g. Delhi DO-1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Agency Start Date
              </label>
              <input
                type="date"
                value={profile.agencyStartDate}
                onChange={(e) => handleInputChange('agencyStartDate', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Development Officer Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Development Officer (DO) Information
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Contact details for your supervisory Development Officer
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Development Officer Name
              </label>
              <input
                type="text"
                value={profile.developmentOfficerName}
                onChange={(e) => handleInputChange('developmentOfficerName', e.target.value)}
                placeholder="e.g. S. K. Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Development Officer Mobile
              </label>
              <input
                type="tel"
                value={profile.developmentOfficerMobile}
                onChange={(e) => handleInputChange('developmentOfficerMobile', e.target.value)}
                placeholder="e.g. 9811122334"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: WhatsApp Message Signature */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Greeting & Customer Signature
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically appended to customer premium reminders and follow-up messages
              </p>
            </div>
          </div>

          <div className="pt-2">
            <textarea
              rows={3}
              value={profile.whatsappSignature}
              onChange={(e) => handleInputChange('whatsappSignature', e.target.value)}
              placeholder="e.g. With warm regards,&#10;LIC Financial Advisor&#10;Life Insurance Corporation of India (LIC)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSaving}
            leftIcon={<Save className="w-5 h-5" />}
          >
            {isSaving ? 'Saving Changes...' : 'Save Agent Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
