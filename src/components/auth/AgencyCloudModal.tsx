import React, { useState, useEffect } from 'react';
import { Cloud, ArrowUpCircle, ArrowDownCircle, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { d1SyncService } from '@/services/cloud/d1SyncService';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';

interface AgencyCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'push' | 'pull';
  onSuccess?: () => void;
}

export function AgencyCloudModal({ isOpen, onClose, mode, onSuccess }: AgencyCloudModalProps) {
  const [agencyCode, setAgencyCode] = useState('');
  const [pin, setPin] = useState('');
  const [agentName, setAgentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
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
      setError('Please enter a 4-digit or 6-digit Security PIN.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lic_session_pin', pin.trim());
      }

      if (mode === 'push') {
        // Authenticate/Register first
        await d1SyncService.authenticate(agencyCode, pin, agentName);
        // Push all data
        const result = await d1SyncService.pushToCloud(agencyCode, pin);
        setSuccessMessage(
          `Successfully synced ${result.counts.policies} policies and ${result.counts.customers} customers to Cloudflare D1!`
        );
      } else {
        // Pull all data
        const result = await d1SyncService.pullFromCloud(agencyCode, pin);
        setSuccessMessage(
          `Successfully restored ${result.policiesCount} policies and ${result.customersCount} customers to your device!`
        );
      }

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please check your credentials and connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'push' ? 'Backup to Cloudflare D1' : 'Restore from Cloudflare D1'}
      description={
        mode === 'push'
          ? 'Upload all your current policies, customers, and reminders to your secure, free Cloudflare D1 database.'
          : 'Recover all your policies, customers, and reminders after reinstalling the app on this or any device.'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
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
            Data is strictly isolated to your Agency Code in the database.
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
            placeholder="Enter your secret PIN"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Used to securely encrypt and authorize access to your agency records.
          </p>
        </div>

        {mode === 'push' && (
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
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isLoading}
            leftIcon={
              mode === 'push' ? (
                <ArrowUpCircle className="w-4 h-4" />
              ) : (
                <ArrowDownCircle className="w-4 h-4" />
              )
            }
          >
            {isLoading
              ? mode === 'push'
                ? 'Syncing to D1...'
                : 'Restoring from D1...'
              : mode === 'push'
              ? 'Start Cloud Sync'
              : 'Restore All Policies'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
