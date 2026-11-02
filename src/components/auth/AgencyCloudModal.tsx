import React, { useState, useEffect } from 'react';
import { Cloud, ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { d1SyncService } from '@/services/cloud/d1SyncService';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';

export interface AgencyCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'sync' | 'push' | 'pull';
  onSuccess?: () => void;
}

export function AgencyCloudModal({ isOpen, onClose, mode = 'sync', onSuccess }: AgencyCloudModalProps) {
  const navigate = useNavigate();
  const [agencyCode, setAgencyCode] = useState('');
  const [pin, setPin] = useState('');
  const [agentName, setAgentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [policiesRestored, setPoliciesRestored] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setPoliciesRestored(null);
      loadConfig();
    }
  }, [isOpen]);

  async function loadConfig() {
    try {
      const config = await d1SyncService.getSyncConfig();
      if (config.agencyCode) setAgencyCode(config.agencyCode);
      if (config.agentName) setAgentName(config.agentName);
      if (typeof window !== 'undefined') {
        const sessionPin = sessionStorage.getItem('lic_session_pin');
        if (sessionPin) setPin(sessionPin);
      }
    } catch {
      // ignore
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyCode.trim() || agencyCode.trim().length < 4) {
      setError('Please enter a valid Agency Code (at least 4 characters).');
      return;
    }
    if (!pin.trim() || pin.trim().length < 4) {
      setError('Please enter your 4-digit or 6-digit Security PIN.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setPoliciesRestored(null);

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lic_session_pin', pin.trim());
      }

      if (mode === 'pull') {
        // Force Pull / Restore from cloud only
        const result = await d1SyncService.pullFromCloud(agencyCode, pin);
        setPoliciesRestored(result.policiesCount);
        if (result.policiesCount > 0) {
          setSuccessMessage(
            `Successfully restored ${result.policiesCount} policies and ${result.customersCount} customers to this device!`
          );
        } else {
          setSuccessMessage(
            `Connection successful, but 0 policies were found in cloud backup for Agency Code ${agencyCode}. If you have policies on another phone, please open that phone and tap "Two-Way Cloud Sync" first.`
          );
        }
      } else {
        // Complete Two-Way Sync (Syncs both download & upload)
        const result = await d1SyncService.fullTwoWaySync(agencyCode, pin, agentName);
        setPoliciesRestored(result.pulledCount);
        if (result.pulledCount > 0) {
          setSuccessMessage(
            `Successfully synced! Downloaded ${result.pulledCount} policies from cloud onto this device.`
          );
        } else if (result.pushedCount > 0) {
          setSuccessMessage(
            `Successfully synced! Uploaded ${result.pushedCount} local policies to Cloudflare D1.`
          );
        } else {
          setSuccessMessage(
            `Sync successful! Connected to Cloudflare D1 (0 policies found). Make sure your main phone has uploaded its data.`
          );
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please check your credentials and connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    onClose();
    navigate('/dashboard');
  };

  const isPullMode = mode === 'pull';
  const modalTitle = isPullMode ? 'Restore from Cloudflare D1' : 'Two-Way Cloud Sync';
  const modalDescription = isPullMode
    ? 'Download all policies and customer profiles stored in the cloud for this Agency Code.'
    : 'Synchronizes your device with Cloudflare D1: downloads any cloud records and uploads any local records.';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="leading-relaxed font-medium">{successMessage}</p>
              {policiesRestored !== null && policiesRestored > 0 && (
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition shadow-xs"
                >
                  <span>Open Dashboard to view policies</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Agent Agency Code <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={agencyCode}
            onChange={(e) => setAgencyCode(e.target.value)}
            placeholder="e.g. 08345678"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Records are multi-tenant and strictly isolated by Agency Code.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Security PIN / Password <span className="text-rose-500">*</span>
          </label>
          <input
            type="password"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter your registered PIN"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            The same 4-digit PIN you use to unlock or log into the application.
          </p>
        </div>

        {mode !== 'pull' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Agent Name (Optional)
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Sticky Action Footer - Always visible on all screens */}
        <div className="sticky -bottom-4 sm:-bottom-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs pt-3 pb-1 mt-4 border-t border-slate-100 dark:border-slate-800 -mx-4 -mb-4 px-4 sm:-mx-5 sm:-mb-5 sm:px-5 flex items-center justify-end gap-2.5 z-10 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Close
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isLoading}
            leftIcon={
              isPullMode ? (
                <ArrowDownCircle className="w-4 h-4" />
              ) : (
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              )
            }
          >
            {isLoading
              ? isPullMode
                ? 'Restoring from D1...'
                : 'Syncing Data...'
              : isPullMode
              ? 'Restore All Policies'
              : 'Start Two-Way Sync'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
