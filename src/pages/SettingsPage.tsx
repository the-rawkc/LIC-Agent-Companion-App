import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Lock,
  KeyRound,
  ShieldCheck,
  HardDrive,
  Download,
  Upload,
  Moon,
  Sun,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Smartphone,
  Cloud,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Fingerprint
} from 'lucide-react';
import { pinService } from '@/services/security/pinService';
import { biometricService } from '@/services/security/biometricService';
import { backupService, type BackupPayload } from '@/services/backup/backupService';
import { d1SyncService, type SyncConfig, type SyncStatus } from '@/services/cloud/d1SyncService';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { db, getActiveAgencyCode } from '@/db/database';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PinSetupModal } from '@/components/security/PinSetupModal';
import { AgencyCloudModal } from '@/components/auth/AgencyCloudModal';
import { formatDate } from '@/utils/formatters';

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isPinSetupModalOpen, setIsPinSetupModalOpen] = useState(false);
  const [isPinChangeModalOpen, setIsPinChangeModalOpen] = useState(false);

  // Biometrics State
  const [isBiometricHardware, setIsBiometricHardware] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);
  const [isBiometricTesting, setIsBiometricTesting] = useState(false);

  // Backup state
  const [backupPassword, setBackupPassword] = useState('');
  const [isEncryptedExportModalOpen, setIsEncryptedExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Restore state
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decryptError, setDecryptError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  // Theme & Report Date
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [reportDate, setReportDate] = useState('2026-10-29');

  // Storage info
  const [storageUsage, setStorageUsage] = useState<{ usage: string; quota: string } | null>(null);

  // Reset database state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Cloudflare D1 Sync state
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [d1Status, setD1Status] = useState<SyncStatus | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [cloudModalMode, setCloudModalMode] = useState<'push' | 'pull'>('push');
  const [isCheckingD1, setIsCheckingD1] = useState(false);

  useEffect(() => {
    loadSettings();
    checkStorage();
    checkCloudStatus();
  }, []);

  async function checkCloudStatus() {
    setIsCheckingD1(true);
    try {
      const config = await d1SyncService.getSyncConfig();
      setSyncConfig(config);
      const status = await d1SyncService.checkConnection();
      setD1Status(status);
    } catch {
      // ignore
    } finally {
      setIsCheckingD1(false);
    }
  }

  async function loadSettings() {
    const pinConfigured = await pinService.isPinConfigured();
    setIsPinEnabled(pinConfigured);

    // Biometrics support & status
    const bioHardware = await biometricService.isHardwareAvailable();
    setIsBiometricHardware(bioHardware);
    setIsBiometricEnabled(biometricService.isBiometricEnabled());

    const savedTheme = await settingsRepository.get<string>('theme', 'light');
    setTheme(savedTheme === 'dark' ? 'dark' : 'light');

    const savedDate = await settingsRepository.get<string>('reportDate', '2026-10-29');
    setReportDate(savedDate);
  }

  async function checkStorage() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageMB = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
        setStorageUsage({ usage: `${usageMB} MB`, quota: `${quotaMB} MB` });
      } catch {
        // ignore
      }
    }
  }

  const handleToggleTheme = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    await settingsRepository.set('theme', newTheme);
  };

  const handleDisablePin = async () => {
    if (confirm('Are you sure you want to disable PIN protection?')) {
      await pinService.disablePin();
      setIsPinEnabled(false);
    }
  };

  const handleEnableBiometrics = async () => {
    try {
      const code = getActiveAgencyCode() || 'AGENT';
      await biometricService.registerBiometrics(code);
      setIsBiometricEnabled(true);
      setBiometricNotice('Fingerprint biometric authentication enabled successfully!');
      setTimeout(() => setBiometricNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to register fingerprint.');
    }
  };

  const handleTestBiometrics = async () => {
    setIsBiometricTesting(true);
    try {
      const res = await biometricService.verifyBiometrics();
      if (res.success) {
        setBiometricNotice('Biometric verification successful! Fingerprint recognized.');
        setTimeout(() => setBiometricNotice(null), 4000);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('canceled')) {
        alert(err.message || 'Biometric verification failed.');
      }
    } finally {
      setIsBiometricTesting(false);
    }
  };

  const handleDisableBiometrics = () => {
    if (confirm('Disable fingerprint biometric access for this agency?')) {
      biometricService.disableBiometrics();
      setIsBiometricEnabled(false);
      setBiometricNotice('Biometric access disabled.');
      setTimeout(() => setBiometricNotice(null), 3000);
    }
  };

  // Plain JSON export
  const handleExportPlainJson = async () => {
    setIsExporting(true);
    try {
      const json = await backupService.exportJsonBackup();
      downloadFile(json, `LIC_Companion_Backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    } finally {
      setIsExporting(false);
    }
  };

  // Encrypted backup export
  const handleExportEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupPassword || backupPassword.length < 4) return;
    setIsExporting(true);
    try {
      const encryptedJson = await backupService.exportEncryptedBackup(backupPassword);
      downloadFile(
        encryptedJson,
        `LIC_Companion_Encrypted_Backup_${new Date().toISOString().slice(0, 10)}.licbackup`,
        'application/json'
      );
      setIsEncryptedExportModalOpen(false);
      setBackupPassword('');
    } catch (err) {
      alert('Encryption failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await backupService.exportPoliciesToCsv();
      downloadFile(csv, `LIC_Policies_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
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

  // Restore file picker handler
  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const text = await selectedFile.text();
    setRestoreFileContent(text);

    try {
      const parsed = JSON.parse(text);
      if (parsed.encrypted) {
        setIsPasswordModalOpen(true);
      } else if (backupService.validatePayload(parsed)) {
        setRestorePayload(parsed);
      } else {
        alert('Unrecognized or corrupted backup file structure.');
      }
    } catch {
      alert('File is not valid JSON.');
    }
  };

  const handleDecryptAndPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecryptError('');
    if (!restoreFileContent || !decryptPassword) return;

    try {
      const payload = await backupService.decryptBackup(restoreFileContent, decryptPassword);
      setRestorePayload(payload);
      setIsPasswordModalOpen(false);
      setDecryptPassword('');
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : 'Decryption failed. Incorrect password.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePayload) return;
    setIsRestoring(true);
    try {
      const res = await backupService.restoreBackup(restorePayload);
      setRestorePayload(null);
      setRestoreFileContent(null);
      setRestoreSuccess(`Successfully restored ${res.policiesCount} policies and ${res.customersCount} customers.`);
      setTimeout(() => setRestoreSuccess(null), 6000);
    } catch (err) {
      alert('Restore failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetDatabase = async () => {
    await Promise.all([
      db.policies.clear(),
      db.customers.clear(),
      db.reminders.clear(),
      db.importHistory.clear(),
      db.auditLogs.clear(),
    ]);
    setIsResetConfirmOpen(false);
    alert('All local application records have been cleared.');
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-blue-600" />
          <span>Settings & Data Management</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Security PIN, local-first backups, CSV exports, and app preferences
        </p>
      </div>

      {restoreSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{restoreSuccess}</span>
        </div>
      )}

      {/* Card 1: Application Security PIN */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Application Access Lock (PIN)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Protect customer records when you hand your Android phone to someone
              </p>
            </div>
          </div>
          <Badge variant={isPinEnabled ? 'success' : 'default'}>
            {isPinEnabled ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          {isPinEnabled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPinChangeModalOpen(true)}
                leftIcon={<KeyRound className="w-3.5 h-3.5" />}
              >
                Change PIN
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisablePin}
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Disable PIN
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  pinService.lockSession();
                  window.location.reload();
                }}
                leftIcon={<Lock className="w-3.5 h-3.5" />}
              >
                Lock Session Now
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPinSetupModalOpen(true)}
              leftIcon={<KeyRound className="w-4 h-4" />}
            >
              Set 4-Digit PIN
            </Button>
          )}
        </div>
      </div>

      {/* Biometric & Fingerprint Authentication Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Biometric & Fingerprint Unlock
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unlock your workspace instantly with your mobile fingerprint scanner or platform biometrics
              </p>
            </div>
          </div>
          <Badge variant={!isBiometricHardware ? 'default' : isBiometricEnabled ? 'success' : 'warning'}>
            {!isBiometricHardware ? 'Hardware Unavailable' : isBiometricEnabled ? 'Biometrics Active' : 'Not Enrolled'}
          </Badge>
        </div>

        {biometricNotice && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-800 dark:text-purple-300 font-medium">
            {biometricNotice}
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          {!isBiometricHardware ? (
            <p className="text-xs text-slate-400">
              Your current device or browser does not support WebAuthn platform biometrics. PIN access is active.
            </p>
          ) : isBiometricEnabled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestBiometrics}
                disabled={isBiometricTesting}
                leftIcon={<Fingerprint className="w-3.5 h-3.5 text-purple-600" />}
              >
                {isBiometricTesting ? 'Scanning...' : 'Test Fingerprint Sensor'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisableBiometrics}
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Disable Biometrics
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnableBiometrics}
              className="bg-purple-600 hover:bg-purple-500 text-white"
              leftIcon={<Fingerprint className="w-4 h-4" />}
            >
              Enroll Device Fingerprint
            </Button>
          )}
        </div>
      </div>

      {/* Cloudflare D1 Cloud Sync */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-200 dark:border-blue-900/60 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Cloudflare D1 Cloud Database (100% Free)
                </h2>
                <Badge variant={d1Status?.d1Ready ? 'success' : 'default'} size="sm">
                  {d1Status?.d1Ready ? 'D1 Connected' : 'Ready to Connect'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically backup and restore all policies by your <strong>Agency Code</strong>. Never lose data if you uninstall the app or switch phones.
              </p>
            </div>
          </div>
          <button
            onClick={checkCloudStatus}
            disabled={isCheckingD1}
            title="Refresh D1 connection status"
            className="p-2 text-slate-400 hover:text-blue-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingD1 ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* Agency Info bar */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Linked Agency Code</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
              {syncConfig?.agencyCode || 'Not configured yet'}
            </span>
            {syncConfig?.agentName && (
              <span className="text-xs text-slate-500 ml-2">({syncConfig.agentName})</span>
            )}
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Last Cloud Backup</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {syncConfig?.lastSyncAt ? formatDate(syncConfig.lastSyncAt, 'medium') : 'Never synced'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCloudModalMode('push');
              setIsCloudModalOpen(true);
            }}
            leftIcon={<ArrowUpCircle className="w-4 h-4" />}
          >
            Sync / Backup to D1
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCloudModalMode('pull');
              setIsCloudModalOpen(true);
            }}
            leftIcon={<ArrowDownCircle className="w-4 h-4" />}
          >
            Restore by Agency Code
          </Button>
        </div>
      </div>

      {/* Card 2: Backup & Export */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Data Backup & Exports
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Never rely solely on one device. Export your database regularly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Encrypted JSON Backup */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Password-Protected Backup
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                AES-GCM 256-bit encrypted with your password. Safest for saving on Google Drive, USB, or email.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsEncryptedExportModalOpen(true)}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export Encrypted
            </Button>
          </div>

          {/* Policy CSV Export */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Spreadsheet CSV
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Exports all policies for opening in Microsoft Excel or Google Sheets.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
          </div>

          {/* Plain JSON Backup */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block flex items-center gap-1.5">
                <Download className="w-4 h-4 text-slate-600" />
                Raw JSON Backup
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Standard JSON backup without password. Store only in secure private folders.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPlainJson}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export JSON
            </Button>
          </div>
        </div>

        {/* Restore Section */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.licbackup"
            onChange={handleRestoreFileSelected}
            className="hidden"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Restore Database from Backup
              </span>
              <span className="text-[11px] text-slate-500 block">
                Supports both encrypted (.licbackup) and standard (.json) backup files
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
            >
              Select Backup File
            </Button>
          </div>
        </div>
      </div>

      {/* Card 3: App Appearance & Preferences */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Preferences & Details
        </h2>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {/* Theme Selector */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">Appearance</span>
              <span className="text-slate-400">Choose between light and dark visual themes</span>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => handleToggleTheme('light')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                  theme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                onClick={() => handleToggleTheme('dark')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                  theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Report Date Reference */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">Report Reference Date</span>
              <span className="text-slate-400">Source PDF date for policy status calculations</span>
            </div>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              {reportDate}
            </span>
          </div>

          {/* Storage Usage */}
          {storageUsage && (
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Browser Storage</span>
                <span className="text-slate-400">IndexedDB local storage used</span>
              </div>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {storageUsage.usage} / {storageUsage.quota}
              </span>
            </div>
          )}

          {/* Android PWA info */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-blue-600" />
                Install on Android Phone
              </span>
              <span className="text-slate-400">
                Open in Chrome or Brave, tap the three dots menu (⋮), and choose "Add to Home Screen" or "Install App".
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Clear Data */}
      <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400">
            Reset All Local Data
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
            Permanently clear all policies, customer profiles, and follow-ups from this browser.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setIsResetConfirmOpen(true)}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Reset Database
        </Button>
      </div>

      {/* PIN Setup Modal */}
      <PinSetupModal
        isOpen={isPinSetupModalOpen}
        onClose={() => setIsPinSetupModalOpen(false)}
        onSuccess={() => {
          setIsPinEnabled(true);
          loadSettings();
        }}
      />

      {/* PIN Change Modal */}
      <PinSetupModal
        isOpen={isPinChangeModalOpen}
        onClose={() => setIsPinChangeModalOpen(false)}
        onSuccess={() => {
          loadSettings();
        }}
        isChange={true}
      />

      {/* Encrypted Export Password Modal */}
      <Modal
        isOpen={isEncryptedExportModalOpen}
        onClose={() => setIsEncryptedExportModalOpen(false)}
        title="Password-Protected Backup"
        description="Choose a strong password to encrypt your customer data"
        maxWidth="sm"
      >
        <form onSubmit={handleExportEncrypted} className="space-y-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
            Uses authenticated <strong>AES-GCM 256-bit</strong> encryption. Please remember or safely record this password; it cannot be recovered if lost.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Backup Encryption Password (min 4 characters)
            </label>
            <input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              required
              minLength={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEncryptedExportModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" size="sm" isLoading={isExporting}>
              Encrypt & Download
            </Button>
          </div>
        </form>
      </Modal>

      {/* Decrypt Password Modal for Restoration */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setRestoreFileContent(null);
        }}
        title="Enter Backup Password"
        description="This backup file is encrypted"
        maxWidth="sm"
      >
        <form onSubmit={handleDecryptAndPreview} className="space-y-4">
          {decryptError && (
            <div className="p-2.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded-xl border border-rose-200">
              {decryptError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={decryptPassword}
              onChange={(e) => setDecryptPassword(e.target.value)}
              placeholder="Enter backup password..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setRestoreFileContent(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Decrypt Backup
            </Button>
          </div>
        </form>
      </Modal>

      {/* Restore Preview Confirmation Modal */}
      <Modal
        isOpen={Boolean(restorePayload)}
        onClose={() => setRestorePayload(null)}
        title="Confirm Backup Restoration"
        description="Review backup contents before overwriting current data"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p>
              <strong>Backup Export Date:</strong> {formatDate(restorePayload?.exportDate, 'medium')}
            </p>
            <p>
              <strong>Policies to restore:</strong> {restorePayload?.data.policies.length}
            </p>
            <p>
              <strong>Customers to restore:</strong> {restorePayload?.data.customers.length}
            </p>
            <p>
              <strong>Reminders to restore:</strong> {restorePayload?.data.reminders.length}
            </p>
          </div>

          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            Warning: Restoring this backup will replace any currently stored policies on this device.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRestorePayload(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isRestoring}
              onClick={handleConfirmRestore}
            >
              Replace & Restore
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetDatabase}
        title="Clear All Database Records"
        message="Are you completely sure? This will delete all policy and customer records permanently. Ensure you have exported a backup first."
        confirmLabel="Yes, Clear All"
      />

      {/* Cloudflare D1 Sync Modal */}
      <AgencyCloudModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        mode={cloudModalMode}
        onSuccess={() => {
          checkCloudStatus();
          loadSettings();
        }}
      />
    </div>
  );
}
