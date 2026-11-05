import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Receipt,
  Search,
  Check,
  Calendar,
  Layers,
  HelpCircle,
  Clock,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { extractCommissionBillFromPdf, extractCommissionBillFromExcel } from '@/services/pdf/extractCommissionBill';
import { commissionBillService, isBasePolicy } from '@/services/commission/commissionBillService';
import { db, ensureDataSynchronized } from '@/db/database';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Modal } from '@/components/shared/Modal';
import type { CommissionBillPreviewItem, PremiumMode } from '@/types';

export function CommissionBillPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number; percentage: number } | null>(null);
  const [batchInfo, setBatchInfo] = useState<string | null>(null);
  const [agencyCode, setAgencyCode] = useState<string | null>(null);

  const [items, setItems] = useState<CommissionBillPreviewItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'up_to_date' | 'not_in_db'>('all');
  const [autoCreateMissing, setAutoCreateMissing] = useState(false);

  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    updatedCount: number;
    createdCount: number;
    skippedCount: number;
  } | null>(null);

  // Recently Added Batch History
  const [lastAddedBatch, setLastAddedBatch] = useState<{
    timestamp: string;
    count: number;
    policyNumbers: string[];
    policies?: Array<{
      id: string;
      policyNumber: string;
      customerName: string;
      premiumMode: string;
      firstUnpaidPremiumDate: string;
      commencementDate?: string;
      createdAt?: string;
    }>;
  } | null>(null);

  const loadLastAddedBatch = async () => {
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

      // If last_added_batch is not yet set or contained base policies, identify newly created policies beyond the 1,516 base
      const allPolicies = await db.policies.toArray();
      const newlyAdded = allPolicies.filter((p) => !isBasePolicy(p.policyNumber));
      if (newlyAdded.length > 0) {
        const batch = {
          timestamp: newlyAdded[0].createdAt || new Date().toISOString(),
          count: newlyAdded.length,
          policyNumbers: newlyAdded.map((p) => p.policyNumber),
          policies: newlyAdded.map((p) => ({
            id: p.id,
            policyNumber: p.policyNumber,
            customerName: p.customerName,
            premiumMode: p.premiumMode,
            firstUnpaidPremiumDate: p.firstUnpaidPremiumDate,
            commencementDate: p.commencementDate,
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
    loadLastAddedBatch();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const name = selectedFile.name.toLowerCase();
    const isPdf = name.endsWith('.pdf');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');

    if (!isPdf && !isExcel) {
      alert('Please upload a valid PDF Commission Bill (.pdf) or Excel file (.xlsx, .xls, .csv).');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setProgress({ page: 1, total: 1, percentage: 10 });

    try {
      await ensureDataSynchronized();
      if (isPdf) {
        const parsed = await extractCommissionBillFromPdf(selectedFile, (p) => setProgress(p));
        setBatchInfo(parsed.batchInfo || null);
        setAgencyCode(parsed.agencyCode || null);
        const staged = await commissionBillService.preparePreview(parsed.items);
        setItems(staged);
      } else {
        const parsed = await extractCommissionBillFromExcel(selectedFile);
        const staged = await commissionBillService.preparePreview(parsed.items);
        setItems(staged);
      }
    } catch (err) {
      alert(`Error reading commission bill: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleModeChange = (itemId: string, newMode: PremiumMode) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return commissionBillService.recalculateItemMode(item, newMode);
        }
        return item;
      })
    );
  };

  const handleToggleSelect = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        // If selecting all, select ready_to_update items (or all matched)
        if (select) {
          if (item.status === 'ready_to_update' || autoCreateMissing) {
            return { ...item, selected: true };
          }
          return item;
        }
        return { ...item, selected: false };
      })
    );
  };

  const handleApplyUpdates = async (updateAll: boolean = false) => {
    const targetItems = updateAll ? items.map((i) => ({ ...i, selected: true })) : items.filter((i) => i.selected);
    if (targetItems.length === 0) {
      alert('Please select at least one policy to update.');
      return;
    }

    setIsCommitting(true);
    try {
      const result = await commissionBillService.commitUpdates(targetItems, {
        autoCreateMissingPolicies: true,
        forceUpdate: updateAll,
      });

      setCommitResult({
        updatedCount: result.updatedCount,
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
      });

      await loadLastAddedBatch();

      // Refresh items list to reflect updated DB state
      const targetIds = new Set(targetItems.map((t) => t.id));
      const refreshed = items.map((item) => {
        if (targetIds.has(item.id)) {
          return {
            ...item,
            currentFup: item.calculatedNewFup,
            status: 'already_up_to_date' as const,
            selected: true,
            policyFoundInDb: true,
          };
        }
        return item;
      });
      setItems(refreshed);
    } catch (err) {
      alert(`Failed to apply updates: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    if (statusFilter === 'ready' && item.status !== 'ready_to_update') return false;
    if (statusFilter === 'up_to_date' && item.status !== 'already_up_to_date') return false;
    if (statusFilter === 'not_in_db' && item.status !== 'not_in_db') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchPol = item.policyNo.includes(q);
      const matchName = item.customerName.toLowerCase().includes(q);
      return matchPol || matchName;
    }
    return true;
  });

  const readyCount = items.filter((i) => i.status === 'ready_to_update').length;
  const upToDateCount = items.filter((i) => i.status === 'already_up_to_date').length;
  const notInDbCount = items.filter((i) => i.status === 'not_in_db').length;
  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                FUP Update
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Upload your LIC bill (PDF or Excel) to update next due dates (FUP)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleApplyUpdates(true)}
                disabled={isCommitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Update All ({items.length}) Policies</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setItems([]);
                  setFile(null);
                  setBatchInfo(null);
                }}
                className="flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Upload Zone (shown when no items loaded) */}
      {items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center transition hover:border-emerald-400 dark:hover:border-emerald-500">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Upload Commission Bill
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Choose the commission bill PDF or Excel file received from LIC portal.
              </p>
            </div>

            <div className="flex items-center justify-center pt-2">
              <Button
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <FileText className="w-4 h-4" />
                <span>Choose PDF or Excel File</span>
              </Button>
            </div>

            {/* Simple explanatory note */}
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 text-left text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>How this works:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                <li>
                  The <strong className="text-slate-700 dark:text-slate-300">Due Date</strong> in the bill is taken as the last paid date.
                </li>
                <li>
                  The next due date is calculated automatically from the policy payment mode (Monthly, Quarterly, Half-Yearly, Yearly).
                </li>
                <li>
                  Updated dates appear everywhere in the app automatically.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && progress && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Parsing Commission Bill... (Page {progress.page} of {progress.total})</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Preview Section */}
      {items.length > 0 && (
        <div className="space-y-6">
          {/* Metadata Banner */}
          {(batchInfo || agencyCode) && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {agencyCode ? `Agency: ${agencyCode}` : 'LIC Commission Annexure-A'}
                </span>
                {batchInfo && (
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Batch: <span className="font-semibold text-slate-900 dark:text-white">{batchInfo}</span>
                  </span>
                )}
              </div>
              <span className="text-slate-500 dark:text-slate-400">
                {file ? `File: ${file.name}` : 'Source: Annexure-A Statement'}
              </span>
            </div>
          )}

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase">Total Policies</span>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {items.length}
              </p>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium uppercase flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Needs Update
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {readyCount}
              </p>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium uppercase flex items-center gap-1">
                <Check className="w-3 h-3" /> Already Updated
              </span>
              <p className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {upToDateCount}
              </p>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium uppercase">
                Not in App
              </span>
              <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {notInDbCount}
              </p>
            </div>
          </div>

          {/* Action Toolbar & Filters */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  onClick={() => setStatusFilter('ready')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    statusFilter === 'ready'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                  }`}
                >
                  Needs Update ({readyCount})
                </button>
                <button
                  onClick={() => setStatusFilter('up_to_date')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    statusFilter === 'up_to_date'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Already Updated ({upToDateCount})
                </button>
                {notInDbCount > 0 && (
                  <button
                    onClick={() => setStatusFilter('not_in_db')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      statusFilter === 'not_in_db'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                    }`}
                  >
                    Not in App ({notInDbCount})
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search policy or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Quick Multi-select & Commit Trigger Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Select All to Update ({readyCount})
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Deselect All
                </button>

                {notInDbCount > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer ml-3">
                    <input
                      type="checkbox"
                      checked={autoCreateMissing}
                      onChange={(e) => setAutoCreateMissing(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Auto-create missing policies</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => handleApplyUpdates(true)}
                  disabled={items.length === 0 || isCommitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs px-3.5 py-2"
                >
                  {isCommitting ? (
                    <span>Updating Policies...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Select All &amp; Update ({items.length} Policies)</span>
                    </>
                  )}
                </Button>
                {selectedCount > 0 && selectedCount !== items.length && (
                  <Button
                    variant="outline"
                    onClick={() => handleApplyUpdates(false)}
                    disabled={isCommitting}
                    className="text-xs px-3 py-2"
                  >
                    Update Selected ({selectedCount})
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Policy Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider select-none">
                  <tr>
                    <th className="p-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCount > 0 && selectedCount === filteredItems.length}
                        onChange={(e) => {
                          const check = e.target.checked;
                          setItems((prev) =>
                            prev.map((it) => {
                              const isShown = filteredItems.some((fi) => fi.id === it.id);
                              return isShown ? { ...it, selected: check } : it;
                            })
                          );
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="p-3 w-12 text-center">S.No</th>
                    <th className="p-3">Policy &amp; Customer</th>
                    <th className="p-3">Paid Date</th>
                    <th className="p-3">Mode</th>
                    <th className="p-3">Current FUP</th>
                    <th className="p-3">New FUP</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredItems.map((item, idx) => {
                    const isMatched = item.policyFoundInDb;
                    const isReady = item.status === 'ready_to_update';
                    const isUpToDate = item.status === 'already_up_to_date';

                    return (
                      <tr
                        key={item.id}
                        className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                          item.selected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>

                        {/* S.No */}
                        <td className="p-3 text-center text-slate-400 text-[11px]">
                          {item.sNo ?? idx + 1}
                        </td>

                        {/* Policy & Customer */}
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.policyNo}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                              {item.customerName}
                            </span>
                            {item.planTerm && (
                              <span className="text-[10px] text-slate-400">
                                Plan: {item.planTerm}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Paid Due Date (DueDt) */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatDate(item.paidDueDate)}
                            </span>
                          </div>
                          {item.occurrencesInBill && item.occurrencesInBill > 1 ? (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                              {item.occurrencesInBill} entries in bill • Latest
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Paid in this bill</span>
                          )}
                        </td>

                        {/* Mode Selector */}
                        <td className="p-3">
                          <select
                            value={item.mode}
                            onChange={(e) => handleModeChange(item.id, e.target.value as PremiumMode)}
                            className="text-xs py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          >
                            <option value="Half-Yearly">Half-Yearly (+6m)</option>
                            <option value="Quarterly">Quarterly (+3m)</option>
                            <option value="Yearly">Yearly (+12m)</option>
                            <option value="Monthly">Monthly (+1m)</option>
                            <option value="Single">Single (No FUP)</option>
                          </select>
                        </td>

                        {/* Current FUP in DB */}
                        <td className="p-3">
                          {isMatched ? (
                            <span className="text-slate-600 dark:text-slate-400">
                              {formatDate(item.currentFup)}
                            </span>
                          ) : (
                            <span className="text-amber-500 italic text-[11px]">Not in App</span>
                          )}
                        </td>

                        {/* New Projected FUP */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <span>{formatDate(item.calculatedNewFup)}</span>
                            {isReady && <ArrowRight className="w-3 h-3 text-emerald-500" />}
                          </div>
                          {isReady && item.currentFup && (
                            <span className="text-[10px] text-slate-400">
                              Advances from {formatDate(item.currentFup)}
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3 text-center">
                          {isReady && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Needs Update
                            </span>
                          )}
                          {isUpToDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              <Check className="w-3 h-3" />
                              Updated
                            </span>
                          )}
                          {!isMatched && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <AlertTriangle className="w-3 h-3" />
                              Not in App
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History of Recently Added Policies */}
      {lastAddedBatch && lastAddedBatch.count > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>History of Last Added Policies</span>
                  <Badge variant="warning" size="sm" className="font-bold">
                    {lastAddedBatch.count} New
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Auto-added from Bill on {formatDate(lastAddedBatch.timestamp)}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/policies?filter=recently_added')}
              leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
              className="text-xs font-semibold self-start sm:self-auto text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              View in Policies List
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-2.5 px-3">Policy No</th>
                  <th className="py-2.5 px-3">Policyholder</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Current FUP</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {(lastAddedBatch.policies || lastAddedBatch.policyNumbers.map((no) => ({ policyNumber: no, customerName: 'Customer', premiumMode: 'Half-Yearly', firstUnpaidPremiumDate: '' }))).map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {p.policyNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                      {p.customerName || 'Customer'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {p.premiumMode || 'Half-Yearly'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatDate(p.firstUnpaidPremiumDate) || 'Updated'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => navigate(`/policies?search=${p.policyNumber}`)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success Commitment Dialog */}
      {commitResult && (
        <Modal
          isOpen={true}
          onClose={() => setCommitResult(null)}
          title="Updates Saved"
        >
          <div className="space-y-4 text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Due Dates Updated Successfully!
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Your policy due dates have been advanced and saved to your device and synced to cloud.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400">Policies Updated:</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {commitResult.updatedCount}
                </p>
              </div>
              {commitResult.createdCount > 0 && (
                <div>
                  <span className="text-slate-400">New Policies Added:</span>
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {commitResult.createdCount}
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 italic">
              When these policies are viewed anywhere in the app, the new due dates are shown automatically.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              {commitResult.createdCount > 0 ? (
                <Button
                  variant="primary"
                  onClick={() => navigate('/policies?filter=recently_added')}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  View Last Added Policies ({commitResult.createdCount})
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => navigate('/policies')}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  View Policies
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setCommitResult(null)}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
