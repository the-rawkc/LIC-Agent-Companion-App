import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
  User,
  FileText,
  Share2,
  Settings,
  CheckSquare,
  Square,
  Sparkles,
  Info
} from 'lucide-react';
import { reminderRepository, type ReminderWithDetails } from '@/db/repositories/reminderRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { policyRepository } from '@/db/repositories/policyRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { profileRepository, type AgentProfile } from '@/db/repositories/profileRepository';
import {
  formatCurrency,
  formatDate,
  getDaysDifference,
  getPolicyLifecycleStatus,
  generatePolicyWhatsAppMessage,
  sharePolicyMessage,
  DEFAULT_SHARE_SETTINGS,
  type ReminderShareSettings
} from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Customer, Policy, ReminderType, ReminderPriority } from '@/types';

interface DisplayReminder extends ReminderWithDetails {
  policy?: Policy;
  isPolicyDerived?: boolean;
}

export function RemindersPage() {
  const [searchParams] = useSearchParams();
  const [reminders, setReminders] = useState<DisplayReminder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [shareSettings, setShareSettings] = useState<ReminderShareSettings>(DEFAULT_SHARE_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'upcoming_7' | 'upcoming_30' | 'overdue' | 'completed'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Add Reminder Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newPolicyId, setNewPolicyId] = useState('');
  const [newType, setNewType] = useState<ReminderType>('customer_followup');
  const [newPriority, setNewPriority] = useState<ReminderPriority>('medium');

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();

    // Load saved reminder share settings
    settingsRepository.get<ReminderShareSettings>('reminder_share_settings').then((saved) => {
      if (saved) {
        setShareSettings({ ...DEFAULT_SHARE_SETTINGS, ...saved });
      }
    });

    profileRepository.getProfile().then(setAgentProfile);

    const handleSync = () => {
      loadData();
    };
    window.addEventListener('lic_cloud_synced', handleSync);
    return () => window.removeEventListener('lic_cloud_synced', handleSync);
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [rems, custs, pols] = await Promise.all([
        reminderRepository.getAllWithDetails(),
        customerRepository.getAll(),
        policyRepository.getAll(),
      ]);

      const displayList: DisplayReminder[] = [...rems];
      const existingKeySet = new Set(rems.map((r) => `${r.policyId || ''}_${r.dueDate}`));

      // Auto-derive active policy reminders (dues & maturities) so the module is 100% functional
      for (const p of pols) {
        const lifecycle = getPolicyLifecycleStatus(p);

        // 1. Premium Due Reminders
        if (p.firstUnpaidPremiumDate && (lifecycle === 'due' || lifecycle === 'active')) {
          const diffDays = getDaysDifference(p.firstUnpaidPremiumDate);
          // Include overdue, today, and upcoming within 60 days
          if (diffDays <= 60) {
            const key = `${p.id}_${p.firstUnpaidPremiumDate}`;
            if (!existingKeySet.has(key)) {
              existingKeySet.add(key);
              displayList.push({
                id: `due_${p.id}`,
                customerId: p.customerId || p.id,
                policyId: p.id,
                title: `Premium Due: Policy ${p.policyNumber}`,
                description: `Installment Premium of ${formatCurrency(p.premiumAmount)} is due for ${p.customerName} (${p.premiumMode || 'Yearly'}).`,
                dueDate: p.firstUnpaidPremiumDate,
                reminderType: 'premium_due_verification',
                status: 'pending',
                priority: diffDays < 0 ? 'high' : diffDays === 0 ? 'high' : 'medium',
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                customerName: p.customerName,
                policyNumber: p.policyNumber,
                policy: p,
                isPolicyDerived: true,
              });
            }
          }
        }

        // 2. Maturity Reminders
        if (p.maturityDate && lifecycle !== 'matured' && lifecycle !== 'claimed' && lifecycle !== 'surrendered') {
          const matDays = getDaysDifference(p.maturityDate);
          if (matDays >= 0 && matDays <= 60) {
            const key = `mat_${p.id}_${p.maturityDate}`;
            if (!existingKeySet.has(key)) {
              existingKeySet.add(key);
              displayList.push({
                id: `mat_${p.id}`,
                customerId: p.customerId || p.id,
                policyId: p.id,
                title: `Maturity Coming Up: Policy ${p.policyNumber}`,
                description: `Policy matures on ${formatDate(p.maturityDate)} for ${p.customerName}. Plan: ${p.originalPlanString || p.planCode}.`,
                dueDate: p.maturityDate,
                reminderType: 'maturity_followup',
                status: 'pending',
                priority: 'high',
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                customerName: p.customerName,
                policyNumber: p.policyNumber,
                policy: p,
                isPolicyDerived: true,
              });
            }
          }
        }
      }

      // Sort by due date ascending
      displayList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      setReminders(displayList);
      setCustomers(custs);
      setPolicies(pols);
    } catch (err) {
      console.error('Failed to load reminders', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleToggle = async (id: string, isPolicyDerived?: boolean) => {
    if (isPolicyDerived) {
      // Toggle local state for policy-derived items
      setReminders((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: r.status === 'completed' ? 'pending' : 'completed' } : r
        )
      );
      return;
    }
    await reminderRepository.toggleStatus(id);
    await loadData();
  };

  const handleDelete = async (id: string, isPolicyDerived?: boolean) => {
    if (isPolicyDerived) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    await reminderRepository.delete(id);
    await loadData();
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueDate) return;

    try {
      const selectedPolicy = policies.find((p) => p.id === newPolicyId);
      await reminderRepository.create({
        customerId: selectedPolicy?.customerId || selectedPolicy?.id || 'general',
        policyId: newPolicyId || undefined,
        title: newTitle.trim(),
        description: newDescription.trim() || (selectedPolicy ? `Follow-up for ${selectedPolicy.customerName} (Policy ${selectedPolicy.policyNumber})` : 'Follow-up task'),
        dueDate: newDueDate,
        reminderType: newType,
        status: 'pending',
        priority: newPriority,
      });

      setIsAddModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      setNewCustomerId('');
      setNewPolicyId('');
      await loadData();
    } catch (err) {
      console.error('Failed to create reminder', err);
    }
  };

  const handleToggleSetting = async (key: keyof ReminderShareSettings) => {
    const updated = {
      ...shareSettings,
      [key]: !shareSettings[key],
    };
    setShareSettings(updated);
    await settingsRepository.set('reminder_share_settings', updated);
  };

  const handleShareReminder = async (r: DisplayReminder) => {
    let pol = r.policy;
    if (!pol && r.policyId) {
      pol = policies.find((p) => p.id === r.policyId);
    }
    if (!pol && r.policyNumber) {
      pol = policies.find((p) => p.policyNumber === r.policyNumber);
    }

    let messageText = '';
    if (pol) {
      messageText = generatePolicyWhatsAppMessage(pol, shareSettings, {
        name: agentProfile?.fullName,
        mobile: agentProfile?.mobileNumber,
      });
    } else {
      messageText = `*LIC Policy Reminder*\n────────────────────────────\n👤 *Customer:* ${r.customerName}\n📋 *Title:* ${r.title}\n📅 *Due Date:* ${formatDate(r.dueDate)}\n${r.description}\n────────────────────────────\n*Advisor:* ${agentProfile?.fullName || 'LIC Advisor'}\n*Contact:* ${agentProfile?.mobileNumber || ''}`;
    }

    // Opens app chooser (navigator.share) so user selects app & contact manually
    await sharePolicyMessage(messageText, r.title);
  };

  // Filter logic
  const filteredReminders = reminders.filter((r) => {
    if (filterTab === 'completed') return r.status === 'completed';
    if (r.status === 'completed') return false; // Show only non-completed for other tabs

    const days = getDaysDifference(r.dueDate);

    if (filterTab === 'today') return days === 0;
    if (filterTab === 'overdue') return days < 0;
    if (filterTab === 'upcoming_7') return days >= 0 && days <= 7;
    if (filterTab === 'upcoming_30') return days >= 0 && days <= 30;
    return true; // 'all'
  });

  const availableCustomerPolicies = policies.filter((p) => p.customerId === newCustomerId);

  // Sample policy for live preview
  const samplePolicy = policies[0] || {
    policyNumber: '123456789',
    customerName: 'Sample Customer',
    planCode: '815',
    policyTerm: 21,
    premiumPayingTerm: 21,
    sumAssured: 500000,
    premiumAmount: 24500,
    premiumMode: 'Half-Yearly',
    commencementDate: '2020-03-15',
    firstUnpaidPremiumDate: '2026-11-28',
    maturityDate: '2041-03-15',
    recordStatus: 'due',
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-600" />
            <span>Reminders & Follow-ups</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {filteredReminders.length} tasks and upcoming dues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isSettingsOpen ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            leftIcon={<Settings className="w-4 h-4" />}
            title="Configure what details are included when sending to customers"
          >
            Message Settings
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Reminder Message Settings Panel */}
      {isSettingsOpen && (
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Reminder Message Details (Choose what to send to customers)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select which fields should be included when you click Share. When sharing, you can choose any app (WhatsApp, SMS, etc.) and search the customer contact manually.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            {[
              { key: 'includeCustomerName', label: 'Customer Name' },
              { key: 'includePolicyNumber', label: 'Policy Number' },
              { key: 'includePremium', label: 'Premium Amount' },
              { key: 'includeDueDate', label: 'Next Due Date (FUP)' },
              { key: 'includeStatus', label: 'Due Status Banner' },
              { key: 'includeAgentDetails', label: 'Agent Name & Mobile' },
              { key: 'includePlan', label: 'Plan & Term' },
              { key: 'includeSumAssured', label: 'Sum Assured' },
              { key: 'includeMaturityDate', label: 'Maturity Date' },
            ].map(({ key, label }) => {
              const isChecked = shareSettings[key as keyof ReminderShareSettings];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleToggleSetting(key as keyof ReminderShareSettings)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition ${
                    isChecked
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 text-slate-900 dark:text-white font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Live Message Preview */}
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" /> Live Message Preview
            </span>
            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {generatePolicyWhatsAppMessage(samplePolicy, shareSettings, {
                name: agentProfile?.fullName || 'LIC Financial Advisor',
                mobile: agentProfile?.mobileNumber || '',
              })}
            </pre>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {[
          { id: 'all', label: 'All Pending' },
          { id: 'today', label: 'Due Today' },
          { id: 'upcoming_7', label: 'Next 7 Days' },
          { id: 'upcoming_30', label: 'Next 30 Days' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'completed', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading reminders...
        </div>
      ) : filteredReminders.length === 0 ? (
        <EmptyState
          title="No reminders in this view"
          description="Everything is up to date or no policy dues fall within this timeframe."
          actionLabel="Add Task"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {filteredReminders.map((r) => {
            const days = getDaysDifference(r.dueDate);
            const isOverdue = days < 0 && r.status !== 'completed';
            const isDueToday = days === 0 && r.status !== 'completed';

            return (
              <div
                key={r.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-3.5 sm:p-4 shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isOverdue
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20'
                    : isDueToday
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggle(r.id, r.isPolicyDerived)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                      r.status === 'completed'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                    }`}
                    title={r.status === 'completed' ? 'Mark pending' : 'Mark completed'}
                  >
                    {r.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm font-bold ${
                          r.status === 'completed'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {r.title}
                      </p>
                      <Badge
                        size="sm"
                        variant={
                          isOverdue
                            ? 'danger'
                            : isDueToday
                            ? 'warning'
                            : r.status === 'completed'
                            ? 'success'
                            : 'info'
                        }
                      >
                        {isOverdue
                          ? `${Math.abs(days)}d Overdue`
                          : isDueToday
                          ? 'Due Today'
                          : `Due ${formatDate(r.dueDate)}`}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {r.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {r.customerName}
                      </span>
                      {r.policyNumber && (
                        <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          Policy {r.policyNumber}
                        </span>
                      )}
                      <span>Type: {r.reminderType.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShareReminder(r)}
                    leftIcon={<Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold"
                    title="Share reminder with customer via any app"
                  >
                    Share
                  </Button>
                  {!r.isPolicyDerived && (
                    <button
                      onClick={() => handleDelete(r.id, r.isPolicyDerived)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg"
                      title="Delete reminder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Reminder Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Follow-up Reminder"
        maxWidth="sm"
        onSubmit={handleCreateReminder}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Reminder
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Policy (Optional)
            </label>
            <select
              value={newPolicyId}
              onChange={(e) => setNewPolicyId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- General Task (No Policy Linked) --</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.policyNumber} — {p.customerName} (₹{p.premiumAmount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Call regarding premium collection or claim document"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="customer_followup">Customer Follow-up</option>
              <option value="premium_due_verification">Premium Due Verification</option>
              <option value="maturity_followup">Maturity Follow-up</option>
              <option value="document_verification">Document Verification</option>
              <option value="general">General Task</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              placeholder="Additional details about this task..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
