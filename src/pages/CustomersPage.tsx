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
  GitMerge,
  ChevronRight,
  ExternalLink,
  Download,
  CheckSquare,
  Square
} from 'lucide-react';
import { customerRepository, type CustomerWithSummary } from '@/db/repositories/customerRepository';
import { backupService } from '@/services/backup/backupService';
import { formatCurrency, formatDate } from '@/utils/formatters';
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

  // Merge Modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [sourceCustomerId, setSourceCustomerId] = useState('');
  const [targetCustomerId, setTargetCustomerId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setIsLoading(true);
    try {
      const data = await customerRepository.getAllWithSummary();
      setCustomers(data);
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
        const matchesName = c.displayName.toLowerCase().includes(q);
        const matchesPhone = c.mobileNumber?.includes(q) ?? false;
        const matchesPolicy = c.policies.some((p) => p.policyNumber.includes(q));
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
        normalizedName: newCustomerName.trim().toLowerCase(),
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

  const handleExecuteMerge = async () => {
    if (!sourceCustomerId || !targetCustomerId || sourceCustomerId === targetCustomerId) return;
    setIsMerging(true);
    try {
      await customerRepository.mergeCustomers(sourceCustomerId, targetCustomerId);
      setIsMergeModalOpen(false);
      setSourceCustomerId('');
      setTargetCustomerId('');
      await loadCustomers();
    } catch (err) {
      console.error('Merge failed', err);
      alert('Failed to merge customers: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsMerging(false);
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
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto w-full">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Customer Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {customers.length} total customer {customers.length === 1 ? 'profile' : 'profiles'} registered
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAllCsv}
            disabled={customers.length === 0 || isExporting}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export All (CSV)
          </Button>
          {customers.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMergeModalOpen(true)}
              leftIcon={<GitMerge className="w-4 h-4" />}
            >
              Merge Profiles
            </Button>
          )}
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

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name, phone, or policy #..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredCustomers.length} of {customers.length} customer profiles
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
            >
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="policies_desc">Most Policies</option>
              <option value="premium_desc">Highest Premium Sum</option>
            </select>
          </div>
        </div>
      </div>

      {/* Multi-Selection & Quick Action Bar */}
      {filteredCustomers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
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
              <span>Select all visible ({filteredCustomers.length})</span>
            </button>
            {selectedIds.size > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleExportSelectedCsv}
                disabled={isExporting}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export CSV ({selectedIds.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                } rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.99]`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(c.id, e)}
                        className="p-1 -ml-1 text-slate-400 hover:text-blue-600 transition"
                        aria-label={isSelected ? 'Deselect customer' : 'Select customer'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white break-words group-hover:text-blue-600 dark:group-hover:text-blue-400 transition leading-snug">
                          {c.displayName}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Customer ID: <span className="font-mono">{c.id.substring(0, 8)}</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant={c.policyCount > 1 ? 'purple' : 'info'} size="sm">
                      {c.policyCount} {c.policyCount === 1 ? 'Policy' : 'Policies'}
                    </Badge>
                  </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 block font-medium">Total Sum Assured</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block break-words">
                      {formatCurrency(c.totalSumAssured)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 block font-medium">Recorded Premium Sum</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block break-words">
                      {formatCurrency(c.totalRecordedPremium)}
                    </span>
                  </div>
                </div>

                {/* Next Date requiring attention */}
                {c.nextUpcomingDate && (
                  <div className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Next Due/Maturity:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(c.nextUpcomingDate)}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {c.mobileNumber ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:${c.mobileNumber}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium hover:bg-emerald-100 transition"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{c.mobileNumber}</span>
                    </a>
                    <a
                      href={`https://wa.me/91${c.mobileNumber.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition"
                      title="Open WhatsApp chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">No phone recorded</span>
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

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        description="Create a customer record. Phone number is optional."
        maxWidth="sm"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
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

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Merge Customers Modal */}
      <Modal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title="Merge Customer Profiles"
        description="Consolidate duplicate customer records. All policies and reminders will be safely reassigned."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300">
            <strong>Important rule:</strong> Never merge profiles unless you are sure they represent the exact same person. An audit log will record this merge.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Source Customer (will be merged and deleted)
            </label>
            <select
              value={sourceCustomerId}
              onChange={(e) => setSourceCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select source customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === targetCustomerId}>
                  {c.displayName} ({c.policyCount} policies{c.mobileNumber ? ` • ${c.mobileNumber}` : ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Customer (will receive all policies)
            </label>
            <select
              value={targetCustomerId}
              onChange={(e) => setTargetCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select target customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === sourceCustomerId}>
                  {c.displayName} ({c.policyCount} policies{c.mobileNumber ? ` • ${c.mobileNumber}` : ''})
                </option>
              ))}
            </select>
          </div>

          {sourceCustomerId && targetCustomerId && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p>
                <strong>Preview:</strong> Policies from source profile will be transferred to target. Target will have{' '}
                {(customers.find((c) => c.id === sourceCustomerId)?.policyCount || 0) +
                  (customers.find((c) => c.id === targetCustomerId)?.policyCount || 0)}{' '}
                total policies.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!sourceCustomerId || !targetCustomerId || sourceCustomerId === targetCustomerId || isMerging}
              isLoading={isMerging}
              onClick={handleExecuteMerge}
            >
              Confirm Merge
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
