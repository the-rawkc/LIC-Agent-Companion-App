import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  Filter,
  X,
  ChevronRight,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { policyRepository, type PolicyFilterOptions } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Policy, PremiumMode, PolicyRecordStatus } from '@/types';

export function PoliciesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination / Batch Rendering
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Add Policy Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addPolicyNo, setAddPolicyNo] = useState('');
  const [addCustomerName, setAddCustomerName] = useState('');
  const [addCustomerId, setAddCustomerId] = useState(searchParams.get('customerId') || '');
  const [addPlan, setAddPlan] = useState('');
  const [addSumAssured, setAddSumAssured] = useState('');
  const [addDoc, setAddDoc] = useState('');
  const [addMode, setAddMode] = useState<PremiumMode>('Half-Yearly');
  const [addFup, setAddFup] = useState('');
  const [addPremium, setAddPremium] = useState('');
  const [addDom, setAddDom] = useState('');
  const [addDob, setAddDob] = useState('');
  const [addError, setAddError] = useState('');

  // Auto-open modal if URL param action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    loadPolicies();
  }, [selectedPlan, selectedMode, selectedStatus, onlyWarnings]);

  async function loadPolicies() {
    setIsLoading(true);
    try {
      const filters: PolicyFilterOptions = {};
      if (selectedPlan) filters.planCode = selectedPlan;
      if (selectedMode) filters.premiumMode = selectedMode;
      if (selectedStatus) filters.recordStatus = selectedStatus as PolicyRecordStatus;
      if (onlyWarnings) filters.hasWarnings = true;

      const data = await policyRepository.search(searchQuery, filters);
      setPolicies(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load policies', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle client-side search typing
  const filteredPolicies = policies.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.policyNumber.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      p.planCode.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredPolicies.length / PAGE_SIZE);
  const paginatedPolicies = filteredPolicies.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Extract distinct plan codes & modes for filter dropdowns
  const uniquePlans = Array.from(new Set(policies.map((p) => p.planCode))).filter(Boolean).sort();
  const uniqueModes = Array.from(new Set(policies.map((p) => p.premiumMode))).filter(Boolean).sort();

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!addPolicyNo.trim() || !addCustomerName.trim() || !addDoc || !addDom || !addFup) {
      setAddError('Please fill in all required fields.');
      return;
    }

    try {
      // Find or create customer
      let customerId = addCustomerId;
      if (!customerId) {
        const cust = await customerRepository.create({
          displayName: addCustomerName.trim(),
          normalizedName: addCustomerName.trim().toLowerCase(),
        });
        customerId = cust.id;
      }

      const planParts = addPlan.trim().split('/');
      const planCode = planParts[0] || addPlan.trim();
      const term = planParts.length >= 2 ? parseInt(planParts[1], 10) : null;
      const ppt = planParts.length >= 3 ? parseInt(planParts[2], 10) : null;

      const newPolicy: Policy = {
        id: crypto.randomUUID(),
        policyNumber: addPolicyNo.trim(),
        customerId,
        customerName: addCustomerName.trim(),
        planCode,
        term: isNaN(term as any) ? null : term,
        premiumPayingTerm: isNaN(ppt as any) ? null : ppt,
        originalPlanString: addPlan.trim(),
        sumAssured: parseFloat(addSumAssured) || 0,
        commencementDate: addDoc,
        premiumMode: addMode,
        firstUnpaidPremiumDate: addFup,
        premiumAmount: parseFloat(addPremium) || 0,
        maturityDate: addDom,
        dateOfBirth: addDob || null,
        sourceSerialNumber: null,
        sourceReportDate: 'Manual Entry',
        sourceImportId: null,
        rawExtractedValues: {},
        extractionWarnings: [],
        recordStatus: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await policyRepository.create(newPolicy);

      setIsAddModalOpen(false);
      resetForm();
      await loadPolicies();
      navigate(`/policies/${newPolicy.id}`);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to save policy');
    }
  };

  const resetForm = () => {
    setAddPolicyNo('');
    setAddCustomerName('');
    setAddPlan('');
    setAddSumAssured('');
    setAddDoc('');
    setAddFup('');
    setAddPremium('');
    setAddDom('');
    setAddDob('');
  };

  const clearAllFilters = () => {
    setSelectedPlan('');
    setSelectedMode('');
    setSelectedStatus('');
    setOnlyWarnings(false);
    setSearchQuery('');
  };

  const activeFilterCount =
    (selectedPlan ? 1 : 0) +
    (selectedMode ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (onlyWarnings ? 1 : 0);

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>Policy Portfolio</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {filteredPolicies.length} {filteredPolicies.length === 1 ? 'policy' : 'policies'} matching criteria
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            leftIcon={<Filter className="w-4 h-4" />}
            className={activeFilterCount > 0 ? 'border-blue-500 text-blue-600' : ''}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Policy
          </Button>
        </div>
      </div>

      {/* Filter Panel (collapsible) */}
      {isFilterOpen && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Filter Options
            </h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Plan Code
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none"
              >
                <option value="">All Plans</option>
                {uniquePlans.map((plan) => (
                  <option key={plan} value={plan}>
                    Plan {plan}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Premium Mode
              </label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none"
              >
                <option value="">All Modes</option>
                {uniqueModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Record Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="needs_verification">Needs Verification</option>
                <option value="manual">Manual Entry</option>
              </select>
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyWarnings}
                  onChange={(e) => setOnlyWarnings(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Extraction Warnings Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter policies by number, customer name, plan code..."
          className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="p-1.5 text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Policies List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading policies...
        </div>
      ) : filteredPolicies.length === 0 ? (
        <EmptyState
          title="No policies found"
          description={
            searchQuery || activeFilterCount > 0
              ? 'No policies match your search or filter criteria.'
              : 'Start by importing your policy report or adding a policy manually.'
          }
          actionLabel={searchQuery || activeFilterCount > 0 ? 'Clear Filters' : 'Add Policy'}
          onAction={searchQuery || activeFilterCount > 0 ? clearAllFilters : () => setIsAddModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {paginatedPolicies.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/policies/${p.id}`)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {p.sourceSerialNumber || '#'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {p.policyNumber}
                      </span>
                      <Badge variant="info" size="sm">
                        Plan {p.originalPlanString}
                      </Badge>
                      {p.extractionWarnings.length > 0 && (
                        <span title={p.extractionWarnings.join(', ')}>
                          <Badge variant="warning" size="sm">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Warning
                          </Badge>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                      {p.customerName}
                    </p>
                  </div>
                </div>

                {/* Right side stats */}
                <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block font-mono">
                      {formatCurrency(p.premiumAmount)}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {p.premiumMode}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition" />
                </div>
              </div>

              {/* Bottom detail pill grid */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Sum Assured</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {p.sumAssured === 0 ? '0 (Reported)' : formatCurrency(p.sumAssured)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">D.O.C.</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatDate(p.commencementDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">F.U.P.</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatDate(p.firstUnpaidPremiumDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">D.O.M.</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatDate(p.maturityDate)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 px-2">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} ({filteredPolicies.length} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Policy Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Policy Record"
        description="Manually record a policy into the local database"
        maxWidth="md"
      >
        <form onSubmit={handleCreatePolicy} className="space-y-3.5">
          {addError && (
            <div className="p-2.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded-xl border border-rose-200">
              {addError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Policy Number *
              </label>
              <input
                type="text"
                value={addPolicyNo}
                onChange={(e) => setAddPolicyNo(e.target.value)}
                placeholder="e.g. 242647587"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                value={addCustomerName}
                onChange={(e) => setAddCustomerName(e.target.value)}
                placeholder="e.g. Ravi Mohan Rohela"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Plan/Term/PPT *
              </label>
              <input
                type="text"
                value={addPlan}
                onChange={(e) => setAddPlan(e.target.value)}
                placeholder="e.g. 749/15/01"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sum Assured (₹) *
              </label>
              <input
                type="number"
                value={addSumAssured}
                onChange={(e) => setAddSumAssured(e.target.value)}
                placeholder="e.g. 200000"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Premium Mode *
              </label>
              <select
                value={addMode}
                onChange={(e) => setAddMode(e.target.value as PremiumMode)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Yearly">Yearly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
                <option value="Single">Single</option>
                <option value="N/F">N/F</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Premium Amount (₹) *
              </label>
              <input
                type="number"
                value={addPremium}
                onChange={(e) => setAddPremium(e.target.value)}
                placeholder="e.g. 6412"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Unpaid Premium Date (F.U.P.) *
              </label>
              <input
                type="date"
                value={addFup}
                onChange={(e) => setAddFup(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                D.O.C. (Commencement) *
              </label>
              <input
                type="date"
                value={addDoc}
                onChange={(e) => setAddDoc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                D.O.M. (Maturity) *
              </label>
              <input
                type="date"
                value={addDom}
                onChange={(e) => setAddDom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                DOB (Optional)
              </label>
              <input
                type="date"
                value={addDob}
                onChange={(e) => setAddDob(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Policy
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
