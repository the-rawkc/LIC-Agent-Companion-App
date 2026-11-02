import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  onSubmit,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      // Lock both HTML and BODY to ensure no background page slider or scroll happens
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.overflow = originalBodyOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-[96vw]',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden animate-in fade-in duration-200 pointer-events-auto"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        aria-hidden="true"
      />

      {/* Modal Dialog Box - Centered True Popup Window */}
      <div
        className={`relative z-10 w-full ${maxWidthStyles[maxWidth]} max-h-[94dvh] sm:max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top with compact padding */}
        <div className="flex items-start justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="pr-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 -mt-0.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content & Footer with internal thin slider */}
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-3.5 sm:p-4.5 overflow-y-auto flex-1 overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.4)_transparent]">
              {children}
            </div>
            {footer && (
              <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </form>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-3.5 sm:p-4.5 overflow-y-auto flex-1 overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.4)_transparent]">
              {children}
            </div>
            {footer && (
              <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
