import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  Bell,
  Menu,
  Search,
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
  LogOut,
  Sparkles
} from 'lucide-react';
import { AppLogo } from '../shared/AppLogo';
import { GlobalSearchModal } from '../shared/GlobalSearchModal';
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
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agentName, setAgentName] = useState('Advisor');
  const [agentInitials, setAgentInitials] = useState('AG');
  const [agencyCode, setAgencyCode] = useState('');

  const isOnline = useNetworkStatus();

  // Load auth state & profile details on route change
  useEffect(() => {
    const authed = authService.isAuthenticated();
    setIsAuthenticated(authed);

    profileRepository.getProfile().then((p) => {
      if (p.agencyCode) setAgencyCode(p.agencyCode);
      if (p.fullName) {
        setAgentName(p.fullName);
        const inits = p.fullName
          .split(' ')
          .filter(Boolean)
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
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/policies', label: 'Policies', icon: FileText },
    { to: '/reminders', label: 'Reminders', icon: Bell },
  ];

  const moreItems = [
    { to: '/greetings', label: 'Festival Greeting Cards', icon: Sparkles, desc: 'Create festive cards with your photo to send clients' },
    { to: '/reminders', label: 'Follow-ups & Reminders', icon: Bell, desc: 'Payment due dates & customer calls' },
    { to: '/profile', label: 'Agent Profile', icon: User, desc: 'Your name, agency code, branch & visiting card' },
    { to: '/analytics', label: 'Business Summary', icon: BarChart3, desc: 'Total business, plans & earnings chart' },
    { to: '/import', label: 'Import Policies', icon: Upload, desc: 'Add policies from LIC Excel or PDF file' },
    { to: '/settings', label: 'Backup & Export', icon: HardDrive, desc: 'Save backup file or export to Excel' },
    { to: '/settings', label: 'Settings & Phone Sync', icon: Settings, desc: 'Online sync across phones, PIN lock & theme' },
  ];

  const isLandingPage = location.pathname === '/';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col antialiased overflow-x-hidden w-full max-w-full">
      {/* Top Header - Rendered strictly in authenticated workspace to avoid ghost flashes on landing */}
      {!isLandingPage && (
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 pt-safe w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
            {/* Left: Profile Avatar & Brand Title */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/profile')}
                title={`View Agent Profile (${agentName})`}
                className="flex items-center gap-1.5 p-0.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition tap-effect focus:outline-none"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-amber-400/40 hover:scale-105 transition">
                  {agentInitials}
                </div>
              </button>

              <div
                className="flex items-center gap-1.5 cursor-pointer group tap-effect"
                onClick={() => navigate('/dashboard')}
                title="Go to Dashboard"
              >
                <AppLogo size={28} />
                <div className="flex flex-col leading-tight">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    LIC Companion
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                    {agencyCode ? `Agent ${agencyCode}` : 'Workspace'}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Quick Search Pill */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden md:flex flex-1 max-w-md mx-3 flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60 transition text-xs sm:text-sm select-none tap-effect"
              aria-label="Search policies and customers"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Search policies, name, number...</span>
              </div>
              <kbd className="font-mono text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300">
                Ctrl+K
              </kbd>
            </button>

            {/* Right Action Icons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Mobile Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                title="Global Search (Policies & Customers)"
                className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition tap-effect"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Offline indicator */}
              {!isOnline && (
                <div
                  title="Working offline"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Offline</span>
                </div>
              )}

              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition tap-effect"
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
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition tap-effect"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Sidebar (Only in Authenticated Workspace) */}
        {!isLandingPage && (
          <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all tap-effect ${
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
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all tap-effect ${
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
                      <p className="text-xs font-bold text-slate-900 dark:text-white break-words">
                        {agentName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono break-words">
                        {agencyCode ? `Agency: ${agencyCode}` : 'Personal Portal'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      authService.logout();
                      navigate('/');
                    }}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-1.5 transition border border-rose-200/50 dark:border-rose-900/30 tap-effect"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Switch Agent</span>
                  </button>
                </div>
              </div>
            </nav>
          </aside>
        )}

        {/* Content Area with Silky Smooth Native Route Transition */}
        <main
          key={location.pathname}
          className={`page-enter flex-1 flex flex-col min-w-0 ${!isLandingPage ? 'pb-20 lg:pb-8' : 'pb-0'}`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Active in Workspace) */}
      {!isLandingPage && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-safe shadow-lg">
          <div className="grid grid-cols-5 h-16 items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center h-full transition-all select-none tap-effect ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                </NavLink>
              );
            })}

            {/* 5th Tab: More Drawer */}
            <button
              onClick={() => setIsMoreMenuOpen(true)}
              className={`flex flex-col items-center justify-center h-full transition-all select-none tap-effect ${
                isMoreMenuOpen ||
                location.pathname.startsWith('/profile') ||
                location.pathname.startsWith('/analytics') ||
                location.pathname.startsWith('/import') ||
                location.pathname.startsWith('/settings')
                  ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile "More" Drawer Modal - Top Layer Portal */}
      {isMoreMenuOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center animate-in fade-in duration-200 pointer-events-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100dvh' }}
        >
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMoreMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, touchAction: 'none' }}
          />
          <div className="relative z-10 w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 pb-safe animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white px-2 mb-3">
              More Features
            </h3>
            <div className="space-y-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition border border-slate-100 dark:border-slate-800 tap-effect"
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
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition border border-rose-200 dark:border-rose-900/60 mt-3 tap-effect"
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
        </div>,
        document.body
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
