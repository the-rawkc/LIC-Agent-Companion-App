import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  ArrowRight,
  RotateCcw,
  Clock,
  Sparkles,
  Edit2,
  Check
} from 'lucide-react';
import { extractPoliciesFromPdf } from '@/services/pdf/extractPdfText';
import { extractPoliciesFromExcel } from '@/services/excel/extractExcelData';
import { importService, type CommitImportOptions } from '@/services/import/importService';
import { db } from '@/db/database';
import { SAMPLE_RAW_POLICY_ROWS } from '@/services/sampleData/licSampleRecords';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { StagedPolicyRow, ImportPreviewSummary, ImportHistory } from '@/types';

export function ImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'excel' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number; percentage: number } | null>(null);
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'replace'>('replace');
  const [filterStaged, setFilterStaged] = useState<'all' | 'ready' | 'review' | 'invalid' | 'duplicates'>('all');
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Inline row edit state
  const [editingRow, setEditingRow] = useState<StagedPolicyRow | null>(null);

  useEffect(() => {
    loadImportHistory();
  }, []);

  async function loadImportHistory() {
    const list = await db.importHistory.orderBy('importDate').reverse().toArray();
    setImportHistory(list);
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const name = selectedFile.name.toLowerCase();
    const isPdf = name.endsWith('.pdf');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');

    if (!isPdf && !isExcel) {
      alert('Please select a valid PDF report (.pdf) or Excel spreadsheet (.xlsx, .xls, .csv).');
      return;
    }

    setFile(selectedFile);
    if (isExcel) {
      setFileType('excel');
      await processExcel(selectedFile);
    } else {
      setFileType('pdf');
      await processPdf(selectedFile);
    }
  };

  const processExcel = async (fileToProcess: File) => {
    setIsProcessing(true);
    setProgress({ page: 1, total: 1, percentage: 50 });
    setPreview(null);

    try {
      const extracted = await extractPoliciesFromExcel(fileToProcess);
      setProgress({ page: 1, total: 1, percentage: 95 });

      const detectedKeys = Object.entries(extracted.matchedColumns).map(
        ([colLabel, sourceHeader]) => `${colLabel}: "${sourceHeader}"`
      );
      const previewSummary = await importService.preparePreview(
        extracted.extractedRows,
        1,
        [
          `Worksheet: "${extracted.sheetName}" (${extracted.totalRows} policies extracted in exact row sequence).`,
          `Uniform Column Mapping: ${detectedKeys.join(' • ')}`,
          ...extracted.warnings,
        ]
      );

      setPreview(previewSummary);
    } catch (err) {
      console.error('Excel extraction failed', err);
      alert('Failed to read Excel spreadsheet: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const processPdf = async (fileToProcess: File | ArrayBuffer, customFilename = 'LIC_Agent_Report.pdf') => {
    setIsProcessing(true);
    setProgress({ page: 0, total: 1, percentage: 0 });
    setPreview(null);

    try {
      const extracted = await extractPoliciesFromPdf(fileToProcess, (prog) => {
        setProgress(prog);
      });

      const previewSummary = await importService.preparePreview(
        extracted.extractedRows,
        extracted.totalPages,
        extracted.warnings
      );

      setPreview(previewSummary);
    } catch (err) {
      console.error('Extraction failed', err);
      alert('Failed to read PDF document: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleLoadDemo = async () => {
    setIsProcessing(true);
    setFile({ name: 'LIC_Agent_Report_2026_Sample.pdf' } as any);
    try {
      const previewSummary = await importService.preparePreview(SAMPLE_RAW_POLICY_ROWS, 76, [
        'Loaded representative authentic sample records from LIC report pages 1-76.'
      ]);
      setPreview(previewSummary);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEditedRow = (updated: StagedPolicyRow) => {
    if (!preview) return;
    const updatedRows = preview.rows.map((r) => (r.rowId === updated.rowId ? updated : r));
    setPreview({
      ...preview,
      rows: updatedRows,
    });
    setEditingRow(null);
  };

  const handleExecuteCommit = async () => {
    if (!preview) return;
    setIsCommitting(true);

    try {
      const res = await importService.commitImport({
        filename: file?.name || 'Imported_Report.pdf',
        reportDate: '2026-10-29',
        rows: preview.rows,
        duplicateHandling,
      });

      setIsCommitModalOpen(false);
      await loadImportHistory();
      setPreview(null);
      setFile(null);
      navigate('/policies');
    } catch (err) {
      console.error('Commit failed', err);
      alert('Failed to save policies: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsCommitting(false);
    }
  };

  const handleExecuteRollback = async () => {
    if (!rollbackId) return;
    setIsRollingBack(true);
    try {
      const res = await importService.rollbackImport(rollbackId);
      setRollbackId(null);
      await loadImportHistory();
      alert(`Import undone. Removed ${res.deletedPolicies} policies from app.`);
    } catch (err) {
      alert('Could not undo import: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRollingBack(false);
    }
  };

  const filteredStagedRows = preview?.rows.filter((r) => {
    if (filterStaged === 'ready') return r.isValid && r.warnings.length === 0 && !r.isDuplicate;
    if (filterStaged === 'review') return r.warnings.length > 0;
    if (filterStaged === 'invalid') return !r.isValid;
    if (filterStaged === 'duplicates') return r.isDuplicate;
    return true;
  }) || [];

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Upload className="w-6 h-6 text-blue-600" />
            <span>Import Policies (Excel / PDF)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Add policies automatically from your LIC Excel file or PDF statement
          </p>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Past Imports ({importHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        <div className="space-y-6">
          {/* File Picker Box */}
          {!preview && !isProcessing && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-3xl p-8 sm:p-12 text-center bg-white dark:bg-slate-900 transition cursor-pointer group shadow-xs"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition shadow-inner">
                  <FileText className="w-7 h-7" />
                </div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition shadow-inner">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Upload LIC Report (PDF or Excel)
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto">
                Supports official LIC PDF agent reports and Excel registers (<strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>). 100% processed privately on your device.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} leftIcon={<Upload className="w-3.5 h-3.5" />}>
                  Choose Document (PDF / Excel)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleLoadDemo(); }}
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                >
                  Load Report Sample
                </Button>
              </div>
            </div>
          )}

          {/* Processing Progress Indicator */}
          {isProcessing && progress && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto animate-bounce">
                {fileType === 'excel' ? (
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <FileText className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {fileType === 'excel' ? 'Extracting Excel Spreadsheet Data...' : 'Extracting PDF Table Data...'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {fileType === 'excel' ? 'Parsing columns and validating policy rows...' : `Parsing Page ${progress.page} of ${progress.total}`}
                </p>
              </div>

              {/* Progress bar */}
              <div className="max-w-md mx-auto w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-blue-600">
                {progress.percentage}%
              </span>
            </div>
          )}

          {/* Staged Preview Section */}
          {preview && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Summary Metrics Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Import Preview</span>
                      <Badge variant={fileType === 'excel' ? 'success' : 'info'}>
                        {fileType === 'excel' ? 'Excel Spreadsheet' : 'PDF Report'}
                      </Badge>
                      <Badge variant="purple">{preview.totalRowsDetected} Rows</Badge>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      File: <strong>{file?.name || 'Report'}</strong>
                      {fileType !== 'excel' && ` • ${preview.pagesProcessed} Pages processed`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPreview(null); setFile(null); }}
                    >
                      Discard
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => setIsCommitModalOpen(true)}
                      leftIcon={<Check className="w-4 h-4" />}
                    >
                      Confirm & Save ({preview.rows.filter((r) => r.isValid).length})
                    </Button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-3 text-xs">
                  <button
                    onClick={() => setFilterStaged('all')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition ${
                      filterStaged === 'all'
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    All ({preview.rows.length})
                  </button>
                  <button
                    onClick={() => setFilterStaged('ready')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition ${
                      filterStaged === 'ready'
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Ready to Add ({preview.readyToImportCount})
                  </button>
                  <button
                    onClick={() => setFilterStaged('review')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition ${
                      filterStaged === 'review'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    Needs Check ({preview.requiringReviewCount})
                  </button>
                  <button
                    onClick={() => setFilterStaged('duplicates')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition ${
                      filterStaged === 'duplicates'
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Already in App ({preview.potentialDuplicateCount})
                  </button>
                  {preview.invalidCount > 0 && (
                    <button
                      onClick={() => setFilterStaged('invalid')}
                      className={`px-3 py-1.5 rounded-xl font-medium transition ${
                        filterStaged === 'invalid'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      Invalid ({preview.invalidCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Rows List */}
              <div className="space-y-2.5">
                {filteredStagedRows.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    No rows in this filter category.
                  </p>
                ) : (
                  filteredStagedRows.map((r) => (
                    <div
                      key={r.rowId}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        !r.isValid
                          ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20'
                          : r.warnings.length > 0
                          ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/10'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            #{r.serialNumber || '?'}
                          </span>
                          <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                            {r.policyNumber || 'Missing Policy No'}
                          </span>
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {r.customerName}
                          </span>
                          <Badge variant="info" size="sm">
                            Plan {r.originalPlan}
                          </Badge>
                          {r.isDuplicate && (
                            <Badge variant="purple" size="sm">
                              Existing Policy
                            </Badge>
                          )}
                          {!r.isValid && (
                            <Badge variant="danger" size="sm">
                              Invalid
                            </Badge>
                          )}
                        </div>

                        {/* Financial and dates line with uniform column labels */}
                        <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Sum Assured (₹): <strong>{formatCurrency(r.sumAssured)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Premium (₹): <strong>{formatCurrency(r.premium)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Mode: <strong>{r.mode}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            D.O.C.: <strong>{formatDate(r.doc)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            F.U.P.: <strong className="text-amber-600 dark:text-amber-400">{formatDate(r.fup)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            D.O.M.: <strong>{formatDate(r.dom)}</strong>
                          </span>
                          {r.dob && (
                            <>
                              <span>•</span>
                              <span>
                                D.O.B.: <strong>{formatDate(r.dob)}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Error or Warning details */}
                        {r.validationErrors.length > 0 && (
                          <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{r.validationErrors.join(' • ')}</span>
                          </p>
                        )}
                        {r.warnings.length > 0 && (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{r.warnings.join(' • ')}</span>
                          </p>
                        )}
                      </div>

                      {/* Action to edit row */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRow(r)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        className="shrink-0"
                      >
                        Edit
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Edit Staged Row Modal */}
          {editingRow && (
            <Modal
              isOpen={Boolean(editingRow)}
              onClose={() => setEditingRow(null)}
              title="Edit Row Before Import"
              description="Make corrections directly to this record"
              maxWidth="md"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditedRow({
                  ...editingRow,
                  isValid: true,
                  validationErrors: [],
                  userEdited: true,
                });
              }}
              footer={
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingRow(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Save Changes
                  </Button>
                </>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Policy No <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingRow.policyNumber}
                      onChange={(e) => setEditingRow({ ...editingRow, policyNumber: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingRow.customerName}
                      onChange={(e) => setEditingRow({ ...editingRow, customerName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Plan / Term / PPT <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingRow.originalPlan}
                      onChange={(e) => setEditingRow({ ...editingRow, originalPlan: e.target.value })}
                      placeholder="e.g. 814/21/21"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sum Assured (₹)
                    </label>
                    <input
                      type="number"
                      value={editingRow.sumAssured}
                      onChange={(e) => setEditingRow({ ...editingRow, sumAssured: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Premium (₹)
                    </label>
                    <input
                      type="number"
                      value={editingRow.premium}
                      onChange={(e) => setEditingRow({ ...editingRow, premium: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Premium Mode
                    </label>
                    <input
                      type="text"
                      value={editingRow.mode}
                      onChange={(e) => setEditingRow({ ...editingRow, mode: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      D.O.C. (Commencement)
                    </label>
                    <input
                      type="text"
                      value={editingRow.doc}
                      onChange={(e) => setEditingRow({ ...editingRow, doc: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      F.U.P. (Due Date)
                    </label>
                    <input
                      type="text"
                      value={editingRow.fup}
                      onChange={(e) => setEditingRow({ ...editingRow, fup: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      D.O.M. (Maturity Date)
                    </label>
                    <input
                      type="text"
                      value={editingRow.dom}
                      onChange={(e) => setEditingRow({ ...editingRow, dom: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      D.O.B. (Date of Birth)
                    </label>
                    <input
                      type="text"
                      value={editingRow.dob || ''}
                      onChange={(e) => setEditingRow({ ...editingRow, dob: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                </div>
              </div>
            </Modal>
          )}

          {/* Save Policies Confirmation Dialog */}
          <Modal
            isOpen={isCommitModalOpen}
            onClose={() => setIsCommitModalOpen(false)}
            title="Save Policies to App"
            description="Save these policies to your phone or computer"
            maxWidth="sm"
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setIsCommitModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  isLoading={isCommitting}
                  onClick={handleExecuteCommit}
                >
                  Save Policies
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                <p>
                  <strong>Total policies to save:</strong>{' '}
                  {preview?.rows.filter((r) => r.isValid).length} valid records
                </p>
                <p>
                  <strong>Policies already in app:</strong>{' '}
                  {preview?.potentialDuplicateCount}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  How should existing policies be handled?
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="dupChoice"
                      checked={duplicateHandling === 'replace'}
                      onChange={() => setDuplicateHandling('replace')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-blue-900 dark:text-blue-300 block">
                        Clean Replace (Recommended)
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        Clears old policy list and loads all records fresh from this file in exact row order
                      </span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="dupChoice"
                      checked={duplicateHandling === 'update'}
                      onChange={() => setDuplicateHandling('update')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Update existing policies
                      </span>
                      <span className="text-slate-500">
                        Keeps existing policies and updates due dates, premium, and customer names
                      </span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="dupChoice"
                      checked={duplicateHandling === 'skip'}
                      onChange={() => setDuplicateHandling('skip')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Skip existing policies
                      </span>
                      <span className="text-slate-500">
                        Keep existing policies as they are and only add new policies
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </Modal>
        </div>
      ) : (
        /* Tab: Past Imports */
        <div className="space-y-3">
          {importHistory.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No previous imports found.
            </p>
          ) : (
            importHistory.map((h) => (
              <div
                key={h.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {h.filename}
                    </span>
                    <Badge variant="info" size="sm">
                      {h.createdCount} Added
                    </Badge>
                    {h.updatedCount > 0 && (
                      <Badge variant="purple" size="sm">
                        {h.updatedCount} Updated
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Imported on {formatDate(h.importDate, 'medium')} • Total {h.totalRows} policies checked
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRollbackId(h.id)}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5 text-rose-500" />}
                  className="shrink-0"
                >
                  Undo Import
                </Button>
              </div>
            ))
          )}

          {/* Rollback Confirmation */}
          <ConfirmDialog
            isOpen={Boolean(rollbackId)}
            onClose={() => setRollbackId(null)}
            onConfirm={handleExecuteRollback}
            title="Undo This Import"
            message="This will remove the policies added during this import session. Any policies you updated manually will be kept safe."
            confirmLabel="Undo & Remove"
            isLoading={isRollingBack}
          />
        </div>
      )}
    </div>
  );
}
