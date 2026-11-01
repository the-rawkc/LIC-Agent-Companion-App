import React, { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { pinService } from '@/services/security/pinService';
import { KeyRound, ShieldCheck } from 'lucide-react';

export interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isChange?: boolean;
}

export function PinSetupModal({
  isOpen,
  onClose,
  onSuccess,
  isChange = false,
}: PinSetupModalProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be between 4 and 6 digits');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only numbers');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isChange) {
        const valid = await pinService.verifyPin(currentPin);
        if (!valid) {
          setError('Current PIN is incorrect');
          setIsSubmitting(false);
          return;
        }
      }

      await pinService.setupPin(newPin);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isChange ? 'Change Security PIN' : 'Set Application PIN'}
      description="Protect customer records when you hand your phone to someone"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/50">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            Your PIN is salted and hashed using PBKDF2 with 100,000 iterations on your device. Never shared or sent online.
          </p>
        </div>

        {isChange && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            New PIN (4-6 digits)
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Confirm New PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••"
            required
          />
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            {error}
          </p>
        )}

        <div className="sticky -bottom-4 sm:-bottom-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs pt-3 pb-1 mt-4 border-t border-slate-100 dark:border-slate-800 -mx-4 -mb-4 px-4 sm:-mx-5 sm:-mb-5 sm:px-5 flex items-center justify-end gap-2.5 z-10 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<KeyRound className="w-4 h-4" />}
          >
            {isChange ? 'Update PIN' : 'Enable PIN'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
