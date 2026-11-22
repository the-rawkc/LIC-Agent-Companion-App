import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageSquare,
  FileText,
  Filter,
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  Download,
  CheckSquare,
  Square,
  Sun,
  Moon,
  X,
  Sparkles
} from 'lucide-react';
import { customerRepository, type CustomerWithSummary } from '@/db/repositories/customerRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { backupService } from '@/services/backup/backupService';
import { formatCurrency, formatDate, normalizeSearchString } from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerWithSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'has_phone' | 'multi_policy'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'policies_desc' | 'premium_desc'>('name_asc');
  const [isLoading, setIsLoading] = useState(true);

  // Multi-selection state for export
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cleanNotice, setCleanNotice] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();

    settingsRepository.get<string>('theme', 'light').then((theme) => {
      setIsDarkMode(theme === 'dark' || document.documentElement.classList.contains('dark'));
    });

    const handleSync = () => {
      loadCustomers();
    };
    window.addEventListener('lic_cloud_synced', handleSync);
    return () => window.removeEventListener('lic_cloud_synced', handleSync);
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

  async function loadCustomers() {
    setIsLoading(true);
    try {
      await customerRepository.deduplicateAndPurgeOrphans();
      const data = await customerRepository.getAllWithSummary();
      setCustomers(data.filter((c) => c.policyCount > 0));
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setIsLoading(false);
    }
  }


  // Filter and sort
  const filteredCustomers = customers
    .filter((c) => {
      if (filterType === 'has_phone' && !c.mobileNumber) return false;
      if (filterType === 'multi_policy' && c.policyCount <= 1) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const qNoSpace = q.replace(/\s+/g, '');
        const nameNoSpace = (c.displayName || '').toLowerCase().replace(/\s+/g, '');
        const matchesName = (c.displayName || '').toLowerCase().includes(q) || nameNoSpace.includes(qNoSpace);
        const matchesPhone = c.mobileNumber ? c.mobileNumber.replace(/\D/g, '').includes(q.replace(/\D/g, '')) : false;
        const matchesPolicy = c.policies.some((p) => p.policyNumber.toLowerCase().includes(q));
        return matchesName || matchesPhone || matchesPolicy;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return a.displayName.localeCompare(b.displayName);
      if (sortBy === 'name_desc') return b.displayName.localeCompare(a.displayName);
      if (sortBy === 'policies_desc') return b.policyCount - a.policyCount;
      if (sortBy === 'premium_desc') return b.totalRecordedPremium - a.totalRecordedPremium;
      return 0;
    });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    try {
      const created = await customerRepository.create({
        displayName: newCustomerName.trim(),
        normalizedName: normalizeSearchString(newCustomerName.trim()),
        mobileNumber: newCustomerMobile.trim() || undefined,
        notes: newCustomerNotes.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setNewCustomerName('');
      setNewCustomerMobile('');
      setNewCustomerNotes('');
      await loadCustomers();
      navigate(`/customers/${created.id}`);
    } catch (err) {
      console.error('Failed to create customer', err);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedIds);
    const visibleIds = filteredCustomers.map((c) => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));

    if (allSelected) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAllCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await backupService.exportCustomersToCsv();
      downloadFile(csv, `LIC_Customers_All_${customers.length}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSelectedCsv = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const csv = await backupService.exportCustomersToCsv(Array.from(selectedIds));
      downloadFile(csv, `LIC_Customers_Selected_${selectedIds.size}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col w-full">
      {/* Permanent Top Search Header (Sits at the very top of the screen permanently) */}
      <div className="sticky top-0 z-30 pt-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs w-full">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center gap-2">
          {/* Full-Width Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer name, phone, or policy #..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 shrink-0"
            title="Toggle Dark/Light Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Page Content (Slides smoothly underneath frozen top search bar) */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto w-full">
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-blue-600" />
              <span>Customer Directory</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {customers.length} {customers.length === 1 ? 'profile' : 'profiles'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAllCsv}
              disabled={customers.length === 0 || isExporting}
              leftIcon={<Download className="w-4 h-4" />}
              title="Export All"
              aria-label="Export All"
            />
            <Button
              variant={isFilterOpen || filterType !== 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              leftIcon={<Filter className="w-4 h-4" />}
              title="Filter"
              aria-label="Filter"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Customer
            </Button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {isFilterOpen && (
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold text-[11px]">Filter:</span>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('has_phone')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterType === 'has_phone'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Has Phone Number
            </button>
            <button
              type="button"
              onClick={() => setFilterType('multi_policy')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterType === 'multi_policy'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Multiple Policies (&gt;1)
            </button>
            {filterType !== 'all' && (
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className="text-slate-400 hover:text-rose-500 text-[11px] font-semibold ml-auto"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}

        {/* Profiles count & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="text-[11px] text-slate-500 font-medium">
            Showing {filteredCustomers.length} of {customers.length} profiles
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-[11px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="policies_desc">Most Policies</option>
              <option value="premium_desc">Highest Premium</option>
            </select>
          </div>
        </div>

      {/* Multi-Selection & Quick Action Bar (Visible only when at least one box is selected) */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {filteredCustomers.length > 0 && filteredCustomers.every((c) => selectedIds.has(c.id)) ? (
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select all ({filteredCustomers.length})</span>
            </button>
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold text-[11px]">
              {selectedIds.size} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportSelectedCsv}
              disabled={isExporting}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export ({selectedIds.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Customers List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading customers...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No customers found' : 'No customers yet'}
          description={
            searchQuery
              ? `No customer profiles match "${searchQuery}".`
              : 'Add your first customer manually or import policies from the agent PDF report.'
          }
          actionLabel={searchQuery ? 'Clear Search' : 'Add Customer'}
          onAction={searchQuery ? () => setSearchQuery('') : () => setIsAddModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCustomers.map((c) => {
            const isSelected = selectedIds.has(c.id);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className={`bg-white dark:bg-slate-900 border ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600'
                } rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.99]`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(c.id, e)}
                        className="p-0.5 text-slate-400 hover:text-blue-600 transition"
                        aria-label={isSelected ? 'Deselect customer' : 'Select customer'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white break-words group-hover:text-blue-600 dark:group-hover:text-blue-400 transition leading-snug">
                          {c.displayName}
                        </h3>
                      </div>
                    </div>
                    <Badge variant={c.policyCount > 1 ? 'purple' : 'info'} size="sm" className="text-[10px] py-0 px-1.5 shrink-0">
                      {c.policyCount} {c.policyCount === 1 ? 'Policy' : 'Policies'}
                    </Badge>
                  </div>

                  {/* Financial Summary */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[10px]">
                    <div>
                      <span className="text-slate-400">Sum Assured: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(c.totalSumAssured)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Premium: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(c.totalRecordedPremium)}</strong>
                    </div>
                  </div>

                  {/* Next Date requiring attention */}
                  {c.nextUpcomingDate && (
                    <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-400">Due/Maturity:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(c.nextUpcomingDate)}
                      </span>
                    </div>
                  )}
                </div>

              {/* Bottom Card Actions */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {c.mobileNumber ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:${c.mobileNumber}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium hover:bg-emerald-100 transition"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{c.mobileNumber}</span>
                    </a>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No phone recorded</span>
                )}

                <div className="flex items-center text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:translate-x-0.5 transition gap-0.5">
                  <span>View Details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        description="Create a customer record. Phone number is optional."
        maxWidth="sm"
        onSubmit={handleCreateCustomer}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Customer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Customer Full Name *
            </label>
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ramesh Chandra Sharma"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mobile Number (Optional)
            </label>
            <input
              type="tel"
              value={newCustomerMobile}
              onChange={(e) => setNewCustomerMobile(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 9876543210"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={newCustomerNotes}
              onChange={(e) => setNewCustomerNotes(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Address, family references, preferred contact time..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
