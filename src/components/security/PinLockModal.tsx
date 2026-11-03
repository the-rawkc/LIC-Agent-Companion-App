import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Delete } from 'lucide-react';
import { pinService } from '@/services/security/pinService';

export interface PinLockModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function PinLockModal({ isOpen, onSuccess }: PinLockModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (pin.length >= 6 || isVerifying) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);
    setErrorMessage('');

    // If 4 digits entered, try verifying
    if (newPin.length >= 4) {
      setIsVerifying(true);
      try {
        const valid = await pinService.verifyPin(newPin);
        if (valid) {
          setPin('');
          onSuccess();
        } else if (newPin.length === 6) {
          setError(true);
          setErrorMessage('Incorrect PIN. Please try again.');
          setPin('');
        }
      } catch {
        setError(true);
        setErrorMessage('Verification failed.');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
    setErrorMessage('');
  };

  const content = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950 p-4 select-none pointer-events-auto"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100dvh' }}
    >
      <div className="w-full max-w-xs flex flex-col items-center">
        {/* App Logo / Lock Icon */}
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 shadow-lg shadow-blue-500/10">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">
          LIC Agent Companion
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Enter 4-digit PIN to unlock
        </p>

        {/* PIN Dots */}
        <div className="flex gap-3 my-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                pin.length > i
                  ? 'bg-blue-500 border-blue-500 scale-110 shadow-md shadow-blue-500/50'
                  : error
                  ? 'border-rose-500 bg-rose-500/20 animate-shake'
                  : 'border-slate-700 bg-slate-900'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-400 -mt-4 mb-4 font-medium animate-in fade-in text-center">
            {errorMessage || 'Incorrect PIN. Please try again.'}
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3.5 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white font-medium text-xl border border-slate-800 active:scale-95 transition flex items-center justify-center shadow-sm"
            >
              {digit}
            </button>
          ))}

          <div />

          <button
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white font-medium text-xl border border-slate-800 active:scale-95 transition flex items-center justify-center shadow-sm"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white font-medium text-base border border-slate-800/60 active:scale-95 transition flex items-center justify-center"
            aria-label="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
