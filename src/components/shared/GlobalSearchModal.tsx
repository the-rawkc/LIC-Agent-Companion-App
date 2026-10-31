import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, FileText, ArrowRight } from 'lucide-react';
import { searchService, type GlobalSearchResult } from '@/services/search/searchService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Badge } from './Badge';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchService.globalSearch(query);
        setResults(res);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectCustomer = (customerId: string) => {
    onClose();
    navigate(`/customers/${customerId}`);
  };

  const handleSelectPolicy = (policyId: string) => {
    onClose();
    navigate(`/policies/${policyId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-16 p-3 animate-in fade-in duration-150">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[85vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name, policy #, mobile, plan..."
            className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-base focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-block text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              ESC
            </span>
          )}
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto p-3 space-y-4">
          {isSearching && (
            <div className="py-8 text-center text-sm text-slate-500">
              <div className="inline-block animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full mb-2" />
              <p>Searching records...</p>
            </div>
          )}

          {!isSearching && query && results && results.totalMatches === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No customers or policies found matching "{query}"
            </div>
          )}

          {!query && (
            <div className="py-6 text-center text-xs text-slate-400 space-y-1">
              <p>Type 3+ digits for policy number, or letters for customer name.</p>
              <p className="font-mono">e.g. "242647", "Sharma", "Ghanshyam", "736"</p>
            </div>
          )}

          {/* Customer Matches */}
          {results && results.customers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Customers</span>
                <span>{results.customers.length}</span>
              </div>
              <div className="mt-1 space-y-1">
                {results.customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex items-center justify-between group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                          {c.displayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span>{c.policyCount} {c.policyCount === 1 ? 'Policy' : 'Policies'}</span>
                          {c.mobileNumber && <span>• {c.mobileNumber}</span>}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Policy Matches */}
          {results && results.policies.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Policies</span>
                <span>{results.policies.length}</span>
              </div>
              <div className="mt-1 space-y-1">
                {results.policies.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPolicy(p.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex items-center justify-between group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                            {p.policyNumber}
                          </p>
                          <Badge size="sm" variant="info">
                            Plan {p.planCode}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 break-words mt-0.5">
                          {p.customerName} • Prem: {formatCurrency(p.premiumAmount)} ({p.premiumMode}) • FUP: {formatDate(p.firstUnpaidPremiumDate)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
