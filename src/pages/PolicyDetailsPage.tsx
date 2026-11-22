import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  User,
  Calendar,
  IndianRupee,
  AlertTriangle,
  Edit2,
  Bell,
  CheckCircle2,
  Clock,
  Printer,
  Share2,
  Trash2,
  Info,
  Phone,
  Plus,
  MessageSquare
} from 'lucide-react';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository, type CustomerWithSummary } from '@/db/repositories/customerRepository';
import { reminderRepository, type ReminderWithDetails } from '@/db/repositories/reminderRepository';
import { formatCurrency, formatDate, advanceFupDate, parsePlanTermPpt, calculateMaturityDate, getPolicyMaturityDate, getPolicyLifecycleStatus, openPolicyWhatsAppShare } from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Policy, PremiumMode, PolicyRecordStatus } from '@/types';

export function PolicyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [customer, setCustomer] = useState<CustomerWithSummary | null>(null);
  const [reminders, setReminders] = useState<ReminderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Payment Recording State
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editSumAssured, setEditSumAssured] = useState('');
  const [editPremium, setEditPremium] = useState('');
  const [editMode, setEditMode] = useState<PremiumMode>('Half-Yearly');
  const [editDoc, setEditDoc] = useState('');
  const [editFup, setEditFup] = useState('');
  const [editDom, setEditDom] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editStatus, setEditStatus] = useState<PolicyRecordStatus>('active');
  const [editNotes, setEditNotes] = useState('');

  // Add Reminder Modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState('');
  const [reminderType, setReminderType] = useState('premium_due_verification');

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadPolicyDetails(id);
    }
  }, [id]);

  async function loadPolicyDetails(policyId: string) {
    setIsLoading(true);
    try {
      const pol = await policyRepository.getById(policyId);
      if (pol) {
        setPolicy(pol);
        setEditCustomerName(pol.customerName);
        setEditPlan(pol.originalPlanString);
        setEditSumAssured(pol.sumAssured.toString());
        setEditPremium(pol.premiumAmount.toString());
        setEditMode(pol.premiumMode);
        setEditDoc(pol.commencementDate);
        setEditFup(pol.firstUnpaidPremiumDate);
        const correctDom = getPolicyMaturityDate(pol);
        setEditDom(correctDom || pol.maturityDate || '');
        setEditDob(pol.dateOfBirth || '');
        setEditStatus(pol.recordStatus);
        setEditNotes(pol.notes || '');

        const cust = await customerRepository.getWithSummary(pol.customerId);
        if (cust) setCustomer(cust);

        const rems = await reminderRepository.getByPolicyId(pol.id);
        setReminders(rems);
      } else {
        setPolicy(null);
      }
    } catch (err) {
      console.error('Failed to load policy', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handlePlanChange = (val: string) => {
    setEditPlan(val);
    const parsed = parsePlanTermPpt(val);
    if (parsed.term && editDoc) {
      const calc = calculateMaturityDate(editDoc, parsed.term);
      if (calc) setEditDom(calc);
    }
  };

  const handleDocChange = (val: string) => {
    setEditDoc(val);
    const parsed = parsePlanTermPpt(editPlan);
    if (parsed.term && val) {
      const calc = calculateMaturityDate(val, parsed.term);
      if (calc) setEditDom(calc);
    }
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;

    try {
      const parsedPlan = parsePlanTermPpt(editPlan.trim());
      const planCode = parsedPlan.planCode || editPlan.trim();
      const term = parsedPlan.term;
      const ppt = parsedPlan.ppt;
      const calculatedDom = term && editDoc ? calculateMaturityDate(editDoc, term) : null;
      const maturityDate = editDom || calculatedDom || '';

      await policyRepository.update(policy.id, {
        customerName: editCustomerName.trim(),
        originalPlanString: editPlan.trim(),
        planCode,
        term,
        premiumPayingTerm: ppt,
        sumAssured: parseFloat(editSumAssured) || 0,
        premiumAmount: parseFloat(editPremium) || 0,
        premiumMode: editMode,
        commencementDate: editDoc,
        firstUnpaidPremiumDate: editFup,
        maturityDate,
        dateOfBirth: editDob || null,
        recordStatus: editStatus,
        notes: editNotes.trim() || undefined,
      });

      if (editDob && customer && !customer.dateOfBirth) {
        await customerRepository.update(customer.id, { dateOfBirth: editDob });
      }

      setIsEditModalOpen(false);
      await loadPolicyDetails(policy.id);
    } catch (err) {
      console.error('Failed to update policy', err);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy || !reminderTitle.trim() || !reminderDueDate) return;

    try {
      await reminderRepository.create({
        customerId: policy.customerId,
        policyId: policy.id,
        title: reminderTitle.trim(),
        description: `Policy ${policy.policyNumber} follow-up`,
        dueDate: reminderDueDate,
        reminderType: reminderType as any,
        status: 'pending',
        priority: 'high',
      });

      setIsReminderModalOpen(false);
      setReminderTitle('');
      setReminderDueDate('');
      await loadPolicyDetails(policy.id);
    } catch (err) {
      console.error('Failed to create reminder', err);
    }
  };

  const handleDeletePolicy = async () => {
    if (!policy) return;
    try {
      await policyRepository.delete(policy.id);
      setIsDeleteDialogOpen(false);
      navigate('/policies');
    } catch (err) {
      console.error('Failed to delete policy', err);
    }
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const handleRecordPayment = async () => {
    if (!policy) return;
    setIsRecordingPayment(true);
    try {
      const result = await policyRepository.recordPayment(policy.id);
      setPaymentSuccessNotice(
        `Premium payment recorded! Next F.U.P. automatically advanced to ${formatDate(result.newFup)} (${result.policy.premiumMode}).`
      );
      setIsPaymentConfirmOpen(false);
      await loadPolicyDetails(policy.id);
      setTimeout(() => setPaymentSuccessNotice(null), 5000);
    } catch (err: any) {
      alert('Failed to record payment: ' + (err.message || String(err)));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading policy details...</p>
        </div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex-1 p-6 text-center max-w-md mx-auto">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Policy Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">This record could not be found or has been removed.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/policies')} className="mt-4">
          Return to Policies
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 sm:p-5 space-y-4 max-w-5xl mx-auto w-full print:p-0">
      {/* Back button */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/policies')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Policies</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPaymentConfirmOpen(true)}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold"
          >
            Mark Premium Paid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPolicyWhatsAppShare(policy, customer?.mobileNumber)}
            leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold"
            title="Share policy details"
          >
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSummary}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsReminderModalOpen(true)}
            leftIcon={<Bell className="w-3.5 h-3.5" />}
          >
            Reminder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
            className="text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/60"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Payment Success Alert */}
      {paymentSuccessNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{paymentSuccessNotice}</span>
        </div>
      )}

      {/* Warnings Banner if any */}
      {Boolean(policy.extractionWarnings && policy.extractionWarnings.length > 0) && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Extraction Warnings
            </h4>
            <ul className="mt-0.5 space-y-0.5 text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
              {(policy.extractionWarnings || []).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Policy
              </span>
              <Badge variant="info">Plan {policy.originalPlanString}</Badge>
              {(() => {
                const ls = getPolicyLifecycleStatus(policy);
                const badgeConfig: Record<string, { label: string; cls: string }> = {
                  matured: { label: 'Matured', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-300 dark:border-purple-700' },
                  claimed: { label: 'Claimed', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200 border-sky-300 dark:border-sky-700' },
                  due: { label: 'Premium Due', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700' },
                  surrendered: { label: 'Surrendered', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
                  lapsed: { label: 'Lapsed', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800' },
                  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
                };
                const cfg = badgeConfig[ls] || badgeConfig.active;
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                );
              })()}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
              {policy.policyNumber}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
              {policy.customerName}
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              Report Date: <strong className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{policy.sourceReportDate || '29-10-2026'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 5 Detailed Structural Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Section A: Policy Identification */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>A. Policy Identification</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Policy Number</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{policy.policyNumber}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Plan / Term / PPT</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{policy.originalPlanString}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Plan Code</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{policy.planCode}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Policy Term</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {policy.term ? `${policy.term} Years` : 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Premium Paying Term</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {policy.premiumPayingTerm ? `${policy.premiumPayingTerm} Years` : 'Single / Full'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">List Serial (#)</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {policy.sourceSerialNumber ? `#${policy.sourceSerialNumber}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Section B: Customer Details */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <User className="w-3.5 h-3.5" />
              <span>B. Customer Information</span>
            </div>
            {customer && (
              <button
                onClick={() => navigate(`/customers/${customer.id}`)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                View Profile →
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Name</span>
              <span className="font-bold text-slate-900 dark:text-white">{policy.customerName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Contact Number</span>
              {customer?.mobileNumber ? (
                <a href={`tel:${customer.mobileNumber}`} className="text-blue-600 font-medium">
                  {customer.mobileNumber}
                </a>
              ) : (
                <span className="text-slate-400 italic">No mobile recorded</span>
              )}
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Other Policies</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {customer ? `${customer.policyCount - 1} other policy(ies)` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">DOB (Recorded)</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {formatDate(policy.dateOfBirth)}
              </span>
            </div>
          </div>
        </div>

        {/* Section C: Financial Information */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <IndianRupee className="w-3.5 h-3.5" />
            <span>C. Financial Information</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Sum Assured</span>
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white font-mono">
                {policy.sumAssured === 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">₹0 (As Reported)</span>
                ) : (
                  formatCurrency(policy.sumAssured)
                )}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Premium Amount</span>
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white font-mono">
                {formatCurrency(policy.premiumAmount)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Payment Mode</span>
              <Badge variant="default">{policy.premiumMode}</Badge>
            </div>
          </div>
        </div>

        {/* Section D: Dates & Tracking */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            <span>D. Dates & Tracking</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Start Date (DOC)</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {formatDate(policy.commencementDate)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Next Due Date (FUP)</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                {formatDate(policy.firstUnpaidPremiumDate)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Maturity Date (DOM)</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {formatDate(getPolicyMaturityDate(policy))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section E: Notes & Reminders */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Bell className="w-4 h-4 text-blue-600" />
            <span>E. Notes & Follow-up Tasks ({reminders.length})</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReminderModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Task
          </Button>
        </div>

        {policy.notes && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold block mb-0.5">Policy Notes:</span>
            <p className="whitespace-pre-line">{policy.notes}</p>
          </div>
        )}

        {reminders.length === 0 ? (
          <p className="text-xs text-slate-400 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center">
            No specific follow-up tasks recorded for this policy yet.
          </p>
        ) : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{r.title}</p>
                  <p className="text-slate-400 mt-0.5">Due: {formatDate(r.dueDate)}</p>
                </div>
                <Badge variant={r.status === 'completed' ? 'success' : 'default'}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="flex justify-end pt-2 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          onClick={() => setIsDeleteDialogOpen(true)}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Delete Policy Record
        </Button>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Policy Record"
        maxWidth="md"
        onSubmit={handleUpdatePolicy}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Plan/Term/PPT
              </label>
              <input
                type="text"
                value={editPlan}
                onChange={(e) => handlePlanChange(e.target.value)}
                placeholder="e.g. 815-21 or 833-22"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sum Assured (₹)
              </label>
              <input
                type="number"
                value={editSumAssured}
                onChange={(e) => setEditSumAssured(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Premium (₹)
              </label>
              <input
                type="number"
                value={editPremium}
                onChange={(e) => setEditPremium(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mode
              </label>
              <select
                value={editMode}
                onChange={(e) => setEditMode(e.target.value as PremiumMode)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="Yearly">Yearly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
                <option value="Single">Single</option>
                <option value="N/F">N/F</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Policy Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as PolicyRecordStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active (In Force)</option>
                <option value="due">Due (Premium Pending)</option>
                <option value="matured">Matured</option>
                <option value="claimed">Claimed</option>
                <option value="surrendered">Surrendered</option>
                <option value="lapsed">Lapsed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Next Due Date (FUP)
              </label>
              <input
                type="date"
                value={editFup}
                onChange={(e) => setEditFup(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date of Birth (DOB)
              </label>
              <input
                type="date"
                value={editDob}
                onChange={(e) => setEditDob(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date (DOC)
              </label>
              <input
                type="date"
                value={editDoc}
                onChange={(e) => handleDocChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Maturity Date (DOM)
              </label>
              <input
                type="date"
                value={editDom}
                onChange={(e) => setEditDom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Agent Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* Add Reminder Modal */}
      <Modal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title="Create Policy Follow-up"
        maxWidth="sm"
        onSubmit={handleCreateReminder}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsReminderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Schedule Task
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              placeholder="e.g. Call for premium collection"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Due Date *
            </label>
            <input
              type="date"
              value={reminderDueDate}
              onChange={(e) => setReminderDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
      </Modal>

      {/* Record Payment Confirmation */}
      {policy && (
        <ConfirmDialog
          isOpen={isPaymentConfirmOpen}
          onClose={() => setIsPaymentConfirmOpen(false)}
          onConfirm={handleRecordPayment}
          title="Record Premium Payment"
          message={`Confirm premium collection of ${formatCurrency(policy.premiumAmount)} for policy ${policy.policyNumber}?\n\nCurrent F.U.P.: ${formatDate(policy.firstUnpaidPremiumDate)}\nNew Next F.U.P.: ${formatDate(advanceFupDate(policy.firstUnpaidPremiumDate, policy.premiumMode))} (Mode: ${policy.premiumMode})\n\nThis will auto-advance the next due date and maintain an audit log.`}
          confirmLabel={isRecordingPayment ? "Updating..." : "Confirm & Advance F.U.P."}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeletePolicy}
        title="Delete Policy Record"
        message={`Are you sure you want to delete policy ${policy.policyNumber}? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
