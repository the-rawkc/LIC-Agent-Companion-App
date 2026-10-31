import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  Bell,
  Menu,
  Search,
  Lock,
  WifiOff,
  BarChart3,
  Upload,
  HardDrive,
  Settings,
  Sun,
  Moon,
  Shield,
  HelpCircle,
  User,
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { AppLogo } from '../shared/AppLogo';
import { GlobalSearchModal } from '../shared/GlobalSearchModal';
import { PinLockModal } from '../security/PinLockModal';
import { useAppSecurity } from '@/hooks/useAppSecurity';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { profileRepository, type AgentProfile } from '@/db/repositories/profileRepository';
import { authService } from '@/services/auth/authService';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agentName, setAgentName] = useState('Advisor');
  const [agentInitials, setAgentInitials] = useState('AG');
  const [agencyCode, setAgencyCode] = useState('');

  const { isPinConfigured, isLocked, unlock, lock, refreshSecurity } = useAppSecurity();
  const isOnline = useNetworkStatus();

  // Load profile initials for header
  useEffect(() => {
    profileRepository.getProfile().then((p) => {
      if (p.agencyCode) setAgencyCode(p.agencyCode);
      if (p.fullName) {
        setAgentName(p.fullName);
        const inits = p.fullName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        setAgentInitials(inits || 'AG');
      }
    });
  }, [location.pathname]);

  // Initialize theme from settings
  useEffect(() => {
    settingsRepository.get<string>('theme', 'light').then((theme) => {
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
      }
    });
  }, []);

  const toggleTheme = async () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      await settingsRepository.set('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      await settingsRepository.set('theme', 'light');
    }
  };

  // Keyboard shortcut for Global Search (/ or Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close more drawer on route change
  useEffect(() => {
    setIsMoreMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: '/', label: 'Home', icon: Home, exact: true },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/policies', label: 'Policies', icon: FileText },
    { to: '/reminders', label: 'Reminders', icon: Bell },
  ];

  const moreItems = [
    { to: '/reminders', label: 'Follow-ups & Reminders', icon: Bell, desc: 'F.U.P. & customer contact schedules' },
    { to: '/profile', label: 'Agent Profile', icon: User, desc: 'Personal credentials, branch & signatures' },
    { to: '/analytics', label: 'Analytics', icon: BarChart3, desc: 'Portfolio distribution & trends' },
    { to: '/import', label: 'Import PDF', icon: Upload, desc: 'Import policy records from PDF' },
    { to: '/settings', label: 'Export & Backup', icon: HardDrive, desc: 'Encrypted backup & CSV export' },
    { to: '/settings', label: 'Settings & Cloud Sync', icon: Settings, desc: 'D1 sync, PIN lock & preferences' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col antialiased overflow-x-hidden w-full max-w-full">
      {/* PIN Lock Barrier */}
      <PinLockModal isOpen={isLocked} onSuccess={unlock} />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 pt-safe w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Profile Avatar & App Logo */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Clickable Profile Avatar on the Left */}
            <button
              onClick={() => navigate('/profile')}
              title={`View Agent Profile (${agentName})`}
              className="flex items-center gap-1.5 p-1 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition group focus:outline-none"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-amber-400/40 group-hover:scale-105 transition">
                {agentInitials}
              </div>
            </button>

            {/* Logo & Title */}
            <div
              className="flex items-center gap-1.5 cursor-pointer group"
              onClick={() => navigate('/')}
              title="Go to Home"
            >
              <AppLogo size={32} />
              <div className="hidden min-[420px]:block">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  LIC Companion
                </span>
                <span className="text-[10px] text-slate-400 block -mt-0.5 font-medium">
                  Workspace
                </span>
              </div>
            </div>
          </div>

          {/* Quick Search Pill Bar */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex-1 max-w-md mx-1 sm:mx-4 flex items-center justify-between px-2.5 sm:px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60 transition text-xs sm:text-sm select-none"
            aria-label="Search policies and customers"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
              <span className="truncate text-xs sm:text-sm">Search policies, name...</span>
            </div>
            <kbd className="hidden md:inline-block font-mono text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300">
              Ctrl+K
            </kbd>
          </button>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Offline indicator */}
            {!isOnline && (
              <div
                title="Working offline"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Offline</span>
              </div>
            )}

            {/* Lock button if PIN is set */}
            {isPinConfigured && (
              <button
                onClick={lock}
                title="Lock session"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Switch Agent / Logout */}
            <button
              onClick={() => {
                authService.logout();
                navigate('/');
              }}
              title="Switch Agent Account / Log Out"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            <div className="pt-4 pb-2">
              <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tools & More
              </span>
            </div>

            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            {/* Active Agent Session Card in Sidebar */}
            <div className="pt-4 mt-auto">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {agentInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {agentName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {agencyCode ? `Agency: ${agencyCode}` : 'Personal Portal'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    authService.logout();
                    navigate('/');
                  }}
                  className="w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-1.5 transition border border-rose-200/50 dark:border-rose-900/30"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Agent</span>
                </button>
              </div>
            </div>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 tabs) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center h-full transition-all select-none ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </NavLink>
            );
          })}

          {/* 5th Tab: More */}
          <button
            onClick={() => setIsMoreMenuOpen(true)}
            className={`flex flex-col items-center justify-center h-full transition-all select-none ${
              isMoreMenuOpen || location.pathname.startsWith('/reminders') || location.pathname.startsWith('/profile') || location.pathname.startsWith('/analytics') || location.pathname.startsWith('/import') || location.pathname.startsWith('/settings')
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer Modal */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="relative z-10 w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 pb-safe animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white px-2 mb-3">
              Tools & Management
            </h3>
            <div className="space-y-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition border border-slate-100 dark:border-slate-800"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                  </NavLink>
                );
              })}

              {/* Mobile Switch Agent Option */}
              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  authService.logout();
                  navigate('/');
                }}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition border border-rose-200 dark:border-rose-900/60 mt-3"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Switch Agent Account / Log Out</p>
                  <p className="text-xs text-rose-500/80">
                    {agencyCode ? `Active Agency: ${agencyCode}` : 'Exit personal workspace'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
