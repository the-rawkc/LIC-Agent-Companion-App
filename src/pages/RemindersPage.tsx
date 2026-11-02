import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Trash2,
  User,
  FileText
} from 'lucide-react';
import { reminderRepository, type ReminderWithDetails } from '@/db/repositories/reminderRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { policyRepository } from '@/db/repositories/policyRepository';
import { formatCurrency, formatDate, getDaysDifference } from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Customer, Policy, ReminderType, ReminderPriority } from '@/types';

export function RemindersPage() {
  const [searchParams] = useSearchParams();
  const [reminders, setReminders] = useState<ReminderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
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
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [rems, custs, pols] = await Promise.all([
        reminderRepository.getAllWithDetails(),
        customerRepository.getAll(),
        policyRepository.getAll(),
      ]);
      setReminders(rems);
      setCustomers(custs);
      setPolicies(pols);
    } catch (err) {
      console.error('Failed to load reminders', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleToggle = async (id: string) => {
    await reminderRepository.toggleStatus(id);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await reminderRepository.delete(id);
    await loadData();
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueDate || !newCustomerId) return;

    try {
      await reminderRepository.create({
        customerId: newCustomerId,
        policyId: newPolicyId || undefined,
        title: newTitle.trim(),
        description: newDescription.trim() || 'Follow-up task',
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

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-600" />
            <span>Reminders & Follow-ups</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Keep track of customer interactions, premium due checks, and maturities
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Reminder
        </Button>
      </div>

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
          description="Everything is up to date or no tasks have been scheduled for this timeframe."
          actionLabel="Add Reminder"
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
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs transition flex items-start justify-between gap-3 ${
                  isOverdue
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20'
                    : isDueToday
                    ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <button
                    onClick={() => handleToggle(r.id)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                      r.status === 'completed'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {r.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div className="min-w-0">
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
                          ? 'Today'
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

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg"
                    title="Delete reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
              Select Customer *
            </label>
            <select
              value={newCustomerId}
              onChange={(e) => {
                setNewCustomerId(e.target.value);
                setNewPolicyId('');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>

          {newCustomerId && availableCustomerPolicies.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Link to Policy (Optional)
              </label>
              <select
                value={newPolicyId}
                onChange={(e) => setNewPolicyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None (General customer reminder)</option>
                {availableCustomerPolicies.map((p) => (
                  <option key={p.id} value={p.id}>
                    Policy {p.policyNumber} (Plan {p.originalPlanString})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Call client for premium renewal"
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
                onChange={(e) => setNewPriority(e.target.value as ReminderPriority)}
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
              Task Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as ReminderType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="customer_followup">Customer Follow-up</option>
              <option value="premium_due_verification">Verify Premium Due Date</option>
              <option value="maturity_followup">Maturity Follow-up</option>
              <option value="document_verification">Document Verification</option>
              <option value="general">General Task</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
