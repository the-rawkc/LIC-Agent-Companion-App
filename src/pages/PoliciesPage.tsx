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
  Clock,
  Download,
  CheckSquare,
  Square,
  Trash2,
  Sun,
  Moon,
  Receipt,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { policyRepository, type PolicyFilterOptions } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { db, ensureDataSynchronized, getActiveAgencyCode } from '@/db/database';
import { d1SyncService } from '@/services/cloud/d1SyncService';
import { isBasePolicy } from '@/services/commission/commissionBillService';
import { backupService } from '@/services/backup/backupService';
import { importService } from '@/services/import/importService';
import { formatCurrency, formatDate, advanceFupDate, generateUUID, normalizeSearchString, parseDateToISO } from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
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
  const [selectedFupMonth, setSelectedFupMonth] = useState('');
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [sortBy, setSortBy] = useState<'doc_desc' | 'doc_asc' | 'fup_asc' | 'fup_desc' | 'premium_desc' | 'serial_asc' | 'policy_asc' | 'name_asc'>('doc_desc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Recently Added Batch State
  const isRecentlyAddedParam = searchParams.get('filter') === 'recently_added';
  const [onlyRecentlyAdded, setOnlyRecentlyAdded] = useState(isRecentlyAddedParam);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [lastAddedBatch, setLastAddedBatch] = useState<{
    timestamp: string;
    count: number;
    policyNumbers: string[];
    policies?: Array<{ policyNumber: string; customerName: string; premiumMode: string; firstUnpaidPremiumDate: string }>;
  } | null>(null);

  // Manual Payment Recording State
  const [paymentPolicy, setPaymentPolicy] = useState<Policy | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<string | null>(null);

  // Calculated month strings for quick filters
  const now = new Date();
  const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthIso = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Multi-selection state for export and bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Policy Deletion State
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Pagination / Batch Rendering
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

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

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    settingsRepository.get<string>('theme', 'light').then((theme) => {
      setIsDarkMode(theme === 'dark' || document.documentElement.classList.contains('dark'));
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

  // Auto-open modal if URL param action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isRecentlyAddedParam) {
      setOnlyRecentlyAdded(true);
    }
  }, [isRecentlyAddedParam]);

  // Load last added batch from appSettings or identify newly added policies beyond base portfolio
  const loadLastAddedBatch = async (policyList?: Policy[]) => {
    try {
      const item = await db.appSettings.get('last_added_batch');
      if (item && item.value && Array.isArray((item.value as any).policyNumbers)) {
        const nonBaseNumbers = (item.value as any).policyNumbers.filter((num: string) => !isBasePolicy(num));
        if (nonBaseNumbers.length > 0) {
          const sanitizedBatch = {
            ...(item.value as any),
            count: nonBaseNumbers.length,
            policyNumbers: nonBaseNumbers,
            policies: Array.isArray((item.value as any).policies)
              ? (item.value as any).policies.filter((p: any) => !isBasePolicy(p.policyNumber))
              : [],
          };
          setLastAddedBatch(sanitizedBatch);
          return;
        }
      }

      // If not stored yet or had base policies, check policies in database for records added beyond the 1,516 base
      const targetList = policyList || policies;
      const newlyAdded = targetList.filter((p) => !isBasePolicy(p.policyNumber));
      if (newlyAdded.length > 0) {
        const batch = {
          timestamp: newlyAdded[0].createdAt || new Date().toISOString(),
          count: newlyAdded.length,
          policyNumbers: newlyAdded.map((p) => p.policyNumber),
          policies: newlyAdded.map((p) => ({
            id: p.id,
            policyNumber: p.policyNumber,
            customerName: p.customerName,
            planCode: p.planCode,
            originalPlanString: p.originalPlanString,
            premiumMode: p.premiumMode,
            firstUnpaidPremiumDate: p.firstUnpaidPremiumDate,
            commencementDate: p.commencementDate,
            premiumAmount: p.premiumAmount,
            createdAt: p.createdAt,
          })),
        };
        setLastAddedBatch(batch);
        await db.appSettings.put({
          key: 'last_added_batch',
          value: batch,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadLastAddedBatch(policies);
  }, [policies]);

  // Listen for cloud sync notifications across devices
  useEffect(() => {
    const handleSync = () => {
      loadPolicies();
      loadLastAddedBatch();
    };
    window.addEventListener('lic_cloud_synced', handleSync);
    return () => window.removeEventListener('lic_cloud_synced', handleSync);
  }, []);

  // Trigger background cloud pull on mount to keep data fresh across devices
  useEffect(() => {
    const { agencyCode, pin, pinHash } = d1SyncService.getCredentials();
    if (agencyCode && (pin || pinHash)) {
      d1SyncService.pullFromCloud(agencyCode, pin || '')
        .then((res) => {
          if (res.policiesCount > 0) {
            loadPolicies();
            loadLastAddedBatch();
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [selectedPlan, selectedMode, selectedStatus, selectedFupMonth, onlyWarnings, sortBy]);

  async function loadPolicies() {
    setIsLoading(true);
    try {
      await ensureDataSynchronized();
      const filters: PolicyFilterOptions = { sortBy };
      if (selectedPlan) filters.planCode = selectedPlan;
      if (selectedMode) filters.premiumMode = selectedMode;
      if (selectedStatus) filters.recordStatus = selectedStatus as PolicyRecordStatus;
      if (selectedFupMonth) filters.fupMonth = selectedFupMonth;
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

  const handleRecordPayment = async () => {
    if (!paymentPolicy) return;
    setIsRecordingPayment(true);
    try {
      const res = await policyRepository.recordPayment(paymentPolicy.id);
      setPaymentSuccessToast(
        `Payment recorded for ${paymentPolicy.policyNumber}! New F.U.P.: ${formatDate(res.newFup)} (${res.policy.premiumMode}).`
      );
      setPaymentPolicy(null);
      await loadPolicies();
      setTimeout(() => setPaymentSuccessToast(null), 5000);
    } catch (err: any) {
      alert('Failed to record payment: ' + (err.message || String(err)));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Isolate the exact newly added policies (outside the 1,516 base portfolio)
  const recentlyAddedList = policies.filter((p) => {
    if (isBasePolicy(p.policyNumber)) return false;
    if (lastAddedBatch && lastAddedBatch.policyNumbers && lastAddedBatch.policyNumbers.length > 0) {
      const cleanPNum = p.policyNumber.replace(/[^0-9]/g, '').trim();
      return lastAddedBatch.policyNumbers.some(
        (bn) => bn.replace(/[^0-9]/g, '').trim() === cleanPNum
      );
    }
    return true;
  });

  // Handle client-side search typing & recently added filter
  const filteredPolicies = policies.filter((p) => {
    if (onlyRecentlyAdded) {
      // Strictly exclude any base 1,516 policies
      if (isBasePolicy(p.policyNumber)) return false;

      if (lastAddedBatch && lastAddedBatch.policyNumbers && lastAddedBatch.policyNumbers.length > 0) {
        const cleanPNum = String(p.policyNumber || '').replace(/[^0-9]/g, '').trim();
        const inBatch = lastAddedBatch.policyNumbers.some(
          (bn) => String(bn || '').replace(/[^0-9]/g, '').trim() === cleanPNum
        );
        if (!inBatch) return false;
      }
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      String(p.policyNumber || '').toLowerCase().includes(q) ||
      String(p.customerName || '').toLowerCase().includes(q) ||
      String(p.planCode || '').toLowerCase().includes(q)
    );
  });

  // Sort policies (default: in desc order last comes first as per DOC)
  const sortedPolicies = [...filteredPolicies].sort((a, b) => {
    if (sortBy === 'doc_desc') {
      const dateA = parseDateToISO(a.commencementDate) || a.commencementDate || '';
      const dateB = parseDateToISO(b.commencementDate) || b.commencementDate || '';
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }
    if (sortBy === 'doc_asc') {
      const dateA = parseDateToISO(a.commencementDate) || a.commencementDate || '';
      const dateB = parseDateToISO(b.commencementDate) || b.commencementDate || '';
      return dateA.localeCompare(dateB);
    }
    if (sortBy === 'fup_asc') {
      const fupA = parseDateToISO(a.firstUnpaidPremiumDate) || a.firstUnpaidPremiumDate || '';
      const fupB = parseDateToISO(b.firstUnpaidPremiumDate) || b.firstUnpaidPremiumDate || '';
      return fupA.localeCompare(fupB);
    }
    if (sortBy === 'fup_desc') {
      const fupA = parseDateToISO(a.firstUnpaidPremiumDate) || a.firstUnpaidPremiumDate || '';
      const fupB = parseDateToISO(b.firstUnpaidPremiumDate) || b.firstUnpaidPremiumDate || '';
      return fupB.localeCompare(fupA);
    }
    if (sortBy === 'premium_desc') {
      return (b.premiumAmount || 0) - (a.premiumAmount || 0);
    }
    if (sortBy === 'policy_asc') {
      return String(a.policyNumber || '').localeCompare(String(b.policyNumber || ''));
    }
    if (sortBy === 'name_asc') {
      return String(a.customerName || '').localeCompare(String(b.customerName || ''));
    }
    const sA = a.sourceSerialNumber ?? 9999999;
    const sB = b.sourceSerialNumber ?? 9999999;
    return sA - sB;
  });

  const isShowAll = pageSize === 'all';
  const effectivePageSize = isShowAll ? sortedPolicies.length || 1 : pageSize;
  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(sortedPolicies.length / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPolicies = isShowAll
    ? sortedPolicies
    : sortedPolicies.slice(
        (safeCurrentPage - 1) * effectivePageSize,
        safeCurrentPage * effectivePageSize
      );

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    if (safeCurrentPage > 3) pages.push('...');
    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (safeCurrentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

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
          normalizedName: normalizeSearchString(addCustomerName.trim()),
        });
        customerId = cust.id;
      }

      const planParts = addPlan.trim().split('/');
      const planCode = planParts[0] || addPlan.trim();
      const term = planParts.length >= 2 ? parseInt(planParts[1], 10) : null;
      const ppt = planParts.length >= 3 ? parseInt(planParts[2], 10) : null;

      const newPolicy: Policy = {
        id: generateUUID(),
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

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;
    setIsDeleting(true);
    try {
      await policyRepository.delete(policyToDelete.id);
      setDeleteNotice(`Policy ${policyToDelete.policyNumber} (${policyToDelete.customerName}) deleted successfully.`);
      setPolicyToDelete(null);
      await loadPolicies();
      setTimeout(() => setDeleteNotice(null), 4000);
    } catch (err: any) {
      alert('Failed to delete policy: ' + (err.message || String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeletePolicies = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const count = await policyRepository.bulkDelete(Array.from(selectedIds));
      setDeleteNotice(`Successfully deleted ${count} selected policies.`);
      setSelectedIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
      await loadPolicies();
      setTimeout(() => setDeleteNotice(null), 4000);
    } catch (err: any) {
      alert('Failed to delete selected policies: ' + (err.message || String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  const clearAllFilters = () => {
    setSelectedPlan('');
    setSelectedMode('');
    setSelectedStatus('');
    setSelectedFupMonth('');
    setOnlyWarnings(false);
    setSearchQuery('');
  };

  const activeFilterCount =
    (selectedPlan ? 1 : 0) +
    (selectedMode ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedFupMonth ? 1 : 0) +
    (onlyWarnings ? 1 : 0);

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
    const visibleIds = paginatedPolicies.map((p) => p.id);
    const allSelected = visibleIds.every((id) => next.has(id));

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

  const handleExportSelectedCsv = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const csv = await backupService.exportPoliciesToCsv(Array.from(selectedIds));
      downloadFile(csv, `LIC_Policies_Selected_${selectedIds.size}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await backupService.exportPoliciesToCsv();
      downloadFile(csv, `LIC_Policies_All_${policies.length}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSelectedJson = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const json = await backupService.exportPoliciesToJson(Array.from(selectedIds));
      downloadFile(json, `LIC_Policies_Selected_${selectedIds.size}_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col w-full">
      {/* Permanent Top Search & Filter Header (Sits at the very top of the screen permanently) */}
      <div className="sticky top-0 z-30 pt-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs w-full">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 space-y-2">
          {/* Top Row: Search Input + Theme Toggle */}
          <div className="flex items-center gap-2">
            {/* Main Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by policy number, customer name, plan code, or premium..."
                className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  title="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
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

          {/* Quick FUP & Mode Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <button
              onClick={() => {
                setOnlyRecentlyAdded(false);
                setSelectedFupMonth('');
                setSelectedMode('');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 text-xs ${
                !onlyRecentlyAdded && !selectedFupMonth && !selectedMode
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              All Policies
            </button>
            <button
              onClick={() => setOnlyRecentlyAdded(!onlyRecentlyAdded)}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 text-xs flex items-center gap-1 ${
                onlyRecentlyAdded
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>
                Recently Added ({recentlyAddedList.length || lastAddedBatch?.count || 10})
              </span>
            </button>
            <button
              onClick={() => {
                setOnlyRecentlyAdded(false);
                setSelectedFupMonth(selectedFupMonth === currentMonthIso ? '' : currentMonthIso);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 text-xs flex items-center gap-1 ${
                !onlyRecentlyAdded && selectedFupMonth === currentMonthIso
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Due This Month</span>
            </button>
            <button
              onClick={() => setSelectedFupMonth(selectedFupMonth === nextMonthIso ? '' : nextMonthIso)}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 text-xs flex items-center gap-1 ${
                selectedFupMonth === nextMonthIso
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Due Next Month</span>
            </button>
            <button
              onClick={() => setSelectedMode(selectedMode === 'Monthly' ? '' : 'Monthly')}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 text-xs ${
                selectedMode === 'Monthly'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30'
              }`}
            >
              Monthly Mode
            </button>

            {/* Custom F.U.P. Month Picker */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 shrink-0">
              <span className="text-[10px] font-semibold text-slate-500">Month:</span>
              <input
                type="month"
                value={selectedFupMonth}
                onChange={(e) => setSelectedFupMonth(e.target.value)}
                className="text-[11px] bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              {selectedFupMonth && (
                <button
                  onClick={() => setSelectedFupMonth('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-0.5"
                  title="Clear month filter"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Selector: default D.O.C. Descending (newest first) */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 shrink-0 sm:ml-auto">
              <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="text-[10px] font-semibold text-slate-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="text-[11px] font-semibold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="doc_desc">D.O.C. (Newest First / Desc)</option>
                <option value="doc_asc">D.O.C. (Oldest First / Asc)</option>
                <option value="fup_asc">F.U.P. (Due Earliest)</option>
                <option value="fup_desc">F.U.P. (Due Latest)</option>
                <option value="premium_desc">Premium (High to Low)</option>
                <option value="serial_asc">Original Serial #</option>
                <option value="policy_asc">Policy Number</option>
                <option value="name_asc">Customer Name</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Page Content (Slides smoothly underneath frozen top search bar) */}
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/fup-update')}
              leftIcon={<Receipt className="w-3.5 h-3.5 text-emerald-600" />}
              className="text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
            >
              FUP Update
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAllCsv}
              disabled={policies.length === 0 || isExporting}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export All (CSV)
            </Button>
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

        {/* Recently Added Active Banner */}
        {onlyRecentlyAdded && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Showing <strong>{filteredPolicies.length}</strong> recently added {filteredPolicies.length === 1 ? 'policy' : 'policies'}
                {lastAddedBatch?.timestamp && ` from bill upload on ${formatDate(lastAddedBatch.timestamp)}`}.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsInspectModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition text-xs shadow-xs flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Inspect Added ({filteredPolicies.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyRecentlyAdded(false)}
                className="text-amber-700 dark:text-amber-400 font-bold hover:underline shrink-0"
              >
                Show All Policies
              </button>
            </div>
          </div>
        )}

        {/* Payment Success Toast */}
        {paymentSuccessToast && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{paymentSuccessToast}</span>
          </div>
        )}

        {/* Policy Deletion Notice Toast */}
        {deleteNotice && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-800 dark:text-rose-200 text-xs font-semibold animate-in fade-in">
            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{deleteNotice}</span>
          </div>
        )}

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

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                F.U.P. Month
              </label>
              <input
                type="month"
                value={selectedFupMonth}
                onChange={(e) => setSelectedFupMonth(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none"
              />
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

            <div className="flex items-end pb-1 col-span-2 sm:col-span-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyWarnings}
                  onChange={(e) => setOnlyWarnings(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Warnings Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Selection & Quick Action Bar */}
      {filteredPolicies.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {paginatedPolicies.length > 0 && paginatedPolicies.every((p) => selectedIds.has(p.id)) ? (
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select all on page ({paginatedPolicies.length})</span>
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
                variant="danger"
                size="sm"
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                disabled={isDeleting}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete ({selectedIds.size})
              </Button>
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
                variant="outline"
                size="sm"
                onClick={handleExportSelectedJson}
                disabled={isExporting}
              >
                JSON
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
        <div className="space-y-2.5">
          {paginatedPolicies.map((p, idx) => {
            const isSelected = selectedIds.has(p.id);
            const isNewlyAdded = !isBasePolicy(p.policyNumber) || (lastAddedBatch?.policyNumbers?.includes(p.policyNumber) ?? false);
            const itemIndex = isShowAll
              ? idx + 1
              : (safeCurrentPage - 1) * effectivePageSize + idx + 1;
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/policies/${p.id}`)}
                className={`bg-white dark:bg-slate-900 border ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20'
                    : isNewlyAdded
                    ? 'border-amber-400/80 dark:border-amber-600/80 hover:border-amber-500 ring-1 ring-amber-400/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600'
                } rounded-xl p-3 sm:p-3.5 shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.99]`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(p.id, e)}
                      className="p-1 -ml-1 text-slate-400 hover:text-blue-600 transition"
                      aria-label={isSelected ? 'Deselect policy' : 'Select policy'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                    </button>
                    <div
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-[11px] font-bold shrink-0"
                      title={`Item #${itemIndex}${p.sourceSerialNumber ? ` (Original S.No: ${p.sourceSerialNumber})` : ''}`}
                    >
                      {itemIndex}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold font-mono text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {p.policyNumber}
                        </span>
                        {isNewlyAdded && (
                          <Badge variant="warning" size="sm" className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 font-bold">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5 inline" />
                            New
                          </Badge>
                        )}
                        <Badge variant="info" size="sm" className="text-[10px] py-0 px-1.5">
                          Plan {p.originalPlanString}
                        </Badge>
                        {p.extractionWarnings && p.extractionWarnings.length > 0 && (
                          <span title={p.extractionWarnings.join(', ')}>
                            <Badge variant="warning" size="sm" className="text-[10px] py-0 px-1.5">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                              Warning
                            </Badge>
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-0.5 font-semibold break-words leading-snug">
                        {p.customerName}
                      </p>
                    </div>
                  </div>

                  {/* Right side stats & Quick Mark Paid & Delete */}
                  <div className="flex items-center gap-2 self-end sm:self-auto text-right shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaymentPolicy(p);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition shadow-xs"
                      title="Mark premium paid and advance next F.U.P."
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Paid</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPolicyToDelete(p);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition shadow-xs"
                      title="Delete policy record"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>

                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block font-mono whitespace-nowrap">
                        {formatCurrency(p.premiumAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                        {p.premiumMode}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition shrink-0" />
                  </div>
                </div>

                {/* Bottom detail pill grid */}
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium">Sum Assured</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 break-words block">
                      {p.sumAssured === 0 ? '0' : formatCurrency(p.sumAssured)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium">D.O.C.</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap block">
                      {formatDate(p.commencementDate)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium">F.U.P.</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap block">
                      {formatDate(p.firstUnpaidPremiumDate)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium">D.O.M.</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap block">
                      {formatDate(p.maturityDate)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Bar with Prev, Pages, Next, and All */}
          {sortedPolicies.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-2 px-2 border-t border-slate-200 dark:border-slate-800">
              {/* Item count text */}
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium text-center sm:text-left">
                {isShowAll ? (
                  <span>
                    Showing <strong className="text-slate-900 dark:text-white">all {sortedPolicies.length}</strong> policies
                  </span>
                ) : (
                  <span>
                    Showing{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(safeCurrentPage - 1) * effectivePageSize + 1}
                    </strong>{' '}
                    to{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {Math.min(safeCurrentPage * effectivePageSize, sortedPolicies.length)}
                    </strong>{' '}
                    of{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {sortedPolicies.length}
                    </strong>{' '}
                    policies
                  </span>
                )}
              </div>

              {/* Navigation Controls: Prev, Numbered Pages, Next, and All Button */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  disabled={isShowAll || safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
                >
                  Prev
                </button>

                {!isShowAll && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pNum, idx) =>
                      typeof pNum === 'string' ? (
                        <span key={`dots-${idx}`} className="px-1 text-slate-400 text-xs select-none">
                          …
                        </span>
                      ) : (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setCurrentPage(pNum)}
                          className={`min-w-8 h-8 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                            safeCurrentPage === pNum
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {pNum}
                        </button>
                      )
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isShowAll || safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
                >
                  Next
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isShowAll) {
                      setPageSize(25);
                      setCurrentPage(1);
                    } else {
                      setPageSize('all');
                      setCurrentPage(1);
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shadow-xs ${
                    isShowAll
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  title={isShowAll ? 'Switch back to pages (25 per page)' : 'Show all items on a single page'}
                >
                  All {isShowAll ? `(${filteredPolicies.length})` : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Policy Modal - True popup with docked submit bar */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Policy Record"
        description="Manually record a policy into the local database"
        maxWidth="md"
        onSubmit={handleCreatePolicy}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Policy
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {addError && (
            <div className="p-2.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded-xl border border-rose-200">
              {addError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Policy No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={addPolicyNo}
                onChange={(e) => setAddPolicyNo(e.target.value)}
                placeholder="e.g. 242647587"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={addCustomerName}
                onChange={(e) => setAddCustomerName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Plan / Term / PPT <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={addPlan}
                onChange={(e) => setAddPlan(e.target.value)}
                placeholder="e.g. 749/15/01"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sum Assured (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={addSumAssured}
                onChange={(e) => setAddSumAssured(e.target.value)}
                placeholder="e.g. 200000"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Premium Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={addMode}
                onChange={(e) => setAddMode(e.target.value as PremiumMode)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Installment Premium (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={addPremium}
                onChange={(e) => setAddPremium(e.target.value)}
                placeholder="e.g. 6412"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                F.U.P. (Next Due Date) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={addFup}
                onChange={(e) => setAddFup(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                D.O.C. (Commencement) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={addDoc}
                onChange={(e) => setAddDoc(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                D.O.M. (Maturity) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={addDom}
                onChange={(e) => setAddDom(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                D.O.B. (Date of Birth)
              </label>
              <input
                type="date"
                value={addDob}
                onChange={(e) => setAddDob(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Payment Confirmation Dialog */}
      {paymentPolicy && (
        <ConfirmDialog
          isOpen={!!paymentPolicy}
          onClose={() => setPaymentPolicy(null)}
          onConfirm={handleRecordPayment}
          title="Confirm Premium Payment"
          message={`Mark premium as paid for Policy ${paymentPolicy.policyNumber} (${formatCurrency(paymentPolicy.premiumAmount)})?\n\nCustomer: ${paymentPolicy.customerName}\nCurrent F.U.P.: ${formatDate(paymentPolicy.firstUnpaidPremiumDate)}\nNew Next F.U.P.: ${formatDate(advanceFupDate(paymentPolicy.firstUnpaidPremiumDate, paymentPolicy.premiumMode))} (Mode: ${paymentPolicy.premiumMode})\n\nThis will auto-advance the due date and record an audit log.`}
          confirmLabel={isRecordingPayment ? "Updating..." : "Confirm & Advance F.U.P."}
        />
      )}

      {/* Single Policy Delete Confirmation Dialog */}
      {policyToDelete && (
        <ConfirmDialog
          isOpen={!!policyToDelete}
          onClose={() => setPolicyToDelete(null)}
          onConfirm={handleDeletePolicy}
          title="Delete Policy Record"
          message={`Are you sure you want to permanently delete Policy ${policyToDelete.policyNumber} for ${policyToDelete.customerName}? All associated reminders will also be deleted.`}
          confirmLabel={isDeleting ? "Deleting..." : "Delete Policy"}
          variant="danger"
          isLoading={isDeleting}
        />
      )}

      {/* Bulk Delete Selected Policies Confirmation Dialog */}
      {isBulkDeleteConfirmOpen && (
        <ConfirmDialog
          isOpen={isBulkDeleteConfirmOpen}
          onClose={() => setIsBulkDeleteConfirmOpen(false)}
          onConfirm={handleBulkDeletePolicies}
          title="Delete Selected Policies"
          message={`Are you sure you want to permanently delete ${selectedIds.size} selected policies? All associated reminders for these policies will also be deleted.`}
          confirmLabel={isDeleting ? "Deleting..." : `Delete ${selectedIds.size} Policies`}
          variant="danger"
          isLoading={isDeleting}
        />
      )}

      {/* Recently Added Policies Inspection Modal */}
      {isInspectModalOpen && (
        <Modal
          isOpen={isInspectModalOpen}
          onClose={() => setIsInspectModalOpen(false)}
          title={`Recently Added Policies (${recentlyAddedList.length})`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                These <strong>{recentlyAddedList.length}</strong> policies were newly added to your database during the latest bill upload / sync.
              </span>
            </div>

            <div className="overflow-x-auto max-h-[60vh] border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Policy No</th>
                    <th className="py-2.5 px-3">Policyholder</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Next F.U.P.</th>
                    <th className="py-2.5 px-3">Premium</th>
                    <th className="py-2.5 px-3">DOC</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                  {recentlyAddedList.map((p, idx) => (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setIsInspectModalOpen(false);
                        navigate(`/policies/${p.id}`);
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition text-slate-800 dark:text-slate-200"
                    >
                      <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{p.policyNumber}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-white">{p.customerName}</td>
                      <td className="py-2.5 px-3 font-sans">{p.originalPlanString || p.planCode}</td>
                      <td className="py-2.5 px-3 font-sans">{p.premiumMode}</td>
                      <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">{formatDate(p.firstUnpaidPremiumDate)}</td>
                      <td className="py-2.5 px-3">{formatCurrency(p.premiumAmount)}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{formatDate(p.commencementDate)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-blue-600 dark:text-blue-400 hover:underline font-sans text-xs font-semibold">View &rarr;</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Total: <strong>{recentlyAddedList.length}</strong> policies
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInspectModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
