import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Edit2,
  Plus,
  FileText,
  Bell,
  Trash2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { customerRepository, type CustomerWithSummary } from '@/db/repositories/customerRepository';
import { reminderRepository, type ReminderWithDetails } from '@/db/repositories/reminderRepository';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function CustomerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerWithSummary | null>(null);
  const [reminders, setReminders] = useState<ReminderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Add Reminder Modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderType, setReminderType] = useState('customer_followup');
  const [reminderPolicyId, setReminderPolicyId] = useState('');

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (id) {
      loadCustomerDetails(id);
    }
  }, [id]);

  async function loadCustomerDetails(customerId: string) {
    setIsLoading(true);
    try {
      const data = await customerRepository.getWithSummary(customerId);
      if (data) {
        setCustomer(data);
        setEditName(data.displayName);
        setEditMobile(data.mobileNumber || '');
        setEditEmail(data.email || '');
        setEditAddress(data.address || '');
        setEditNotes(data.notes || '');

        const rems = await reminderRepository.getByCustomerId(customerId);
        setReminders(rems);
      } else {
        setCustomer(null);
      }
    } catch (err) {
      console.error('Failed to load customer', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    try {
      await customerRepository.update(customer.id, {
        displayName: editName.trim(),
        mobileNumber: editMobile.trim() || undefined,
        email: editEmail.trim() || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });

      setIsEditModalOpen(false);
      await loadCustomerDetails(customer.id);
    } catch (err) {
      console.error('Failed to update customer', err);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !reminderTitle.trim() || !reminderDate) return;

    try {
      await reminderRepository.create({
        customerId: customer.id,
        policyId: reminderPolicyId || undefined,
        title: reminderTitle.trim(),
        description: `Follow-up with ${customer.displayName}`,
        dueDate: reminderDate,
        reminderType: reminderType as any,
        status: 'pending',
        priority: 'medium',
      });

      setIsReminderModalOpen(false);
      setReminderTitle('');
      setReminderDate('');
      setReminderPolicyId('');
      if (id) await loadCustomerDetails(id);
    } catch (err) {
      console.error('Failed to create reminder', err);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    try {
      await customerRepository.delete(customer.id);
      setIsDeleteDialogOpen(false);
      navigate('/customers');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete customer');
    }
  };

  const handleToggleReminder = async (reminderId: string) => {
    await reminderRepository.toggleStatus(reminderId);
    if (id) await loadCustomerDetails(id);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 p-6 text-center max-w-md mx-auto">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">This profile may have been merged or deleted.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/customers')} className="mt-4">
          Return to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Back button */}
      <button
        onClick={() => navigate('/customers')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Customers</span>
      </button>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <User className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {customer.displayName}
                </h1>
                <Badge variant={customer.policyCount > 1 ? 'purple' : 'info'}>
                  {customer.policyCount} {customer.policyCount === 1 ? 'Policy' : 'Policies'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Internal Customer ID: <span className="font-mono">{customer.id}</span>
              </p>

              {/* Contact Information Quick Bar */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                {customer.mobileNumber ? (
                  <>
                    <a
                      href={`tel:${customer.mobileNumber}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{customer.mobileNumber}</span>
                    </a>
                    <a
                      href={`https://wa.me/91${customer.mobileNumber.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                    No phone number recorded
                  </span>
                )}

                {customer.email && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            >
              Edit Info
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReminderModalOpen(true)}
              leftIcon={<Bell className="w-3.5 h-3.5" />}
            >
              Add Reminder
            </Button>
          </div>
        </div>

        {/* Address and Notes */}
        {(customer.address || customer.notes) && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {customer.address && (
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{customer.address}</span>
              </div>
            )}
            {customer.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 sm:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">Agent Notes:</span>
                <p className="whitespace-pre-line leading-relaxed">{customer.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Financial Portfolio Summary */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Total Sum Assured</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
              {formatCurrency(customer.totalSumAssured)}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Recorded Premium Sum</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
              {formatCurrency(customer.totalRecordedPremium)}
            </span>
            <span className="text-[10px] text-slate-400 block">installment total</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Active Policies</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
              {customer.policyCount}
            </span>
          </div>
        </div>
      </div>

      {/* Associated Policies Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Associated Policies ({customer.policies.length})</span>
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/policies?action=new&customerId=${customer.id}`)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Policy
          </Button>
        </div>

        {customer.policies.length === 0 ? (
          <p className="text-xs text-slate-400 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
            No policies currently linked to this customer profile.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {customer.policies.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/policies/${p.id}`)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-4 shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold font-mono text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {p.policyNumber}
                      </span>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Plan/Term/PPT: <strong className="text-slate-700 dark:text-slate-300 font-mono">{p.originalPlanString}</strong>
                      </span>
                    </div>
                    <Badge variant={p.recordStatus === 'active' ? 'success' : 'warning'} size="sm">
                      {p.recordStatus}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sum Assured</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(p.sumAssured)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Premium ({p.premiumMode})</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(p.premiumAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">D.O.C.</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(p.commencementDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">F.U.P.</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {formatDate(p.firstUnpaidPremiumDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <span>Maturity: {formatDate(p.maturityDate)}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">View details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Reminders Section */}
      <div className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          <span>Follow-up Reminders ({reminders.length})</span>
        </h2>

        {reminders.length === 0 ? (
          <p className="text-xs text-slate-400 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
            No active follow-ups or reminders for this customer.
          </p>
        ) : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleReminder(r.id)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                      r.status === 'completed'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {r.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${r.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Due: {formatDate(r.dueDate)} • {r.description}
                    </p>
                  </div>
                </div>
                <Badge variant={r.priority === 'high' ? 'danger' : 'default'} size="sm">
                  {r.priority}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone: Delete Customer Profile */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Delete profile only if customer has zero associated policies.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          onClick={() => {
            setDeleteError('');
            setIsDeleteDialogOpen(true);
          }}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Delete Customer
        </Button>
      </div>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Profile"
        maxWidth="sm"
        onSubmit={handleSaveCustomer}
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
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={editMobile}
              onChange={(e) => setEditMobile(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 9876543210"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Address
            </label>
            <textarea
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* Add Reminder Modal */}
      <Modal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title="Add Follow-up Reminder"
        description={`Schedule reminder for ${customer.displayName}`}
        maxWidth="sm"
        onSubmit={handleCreateReminder}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsReminderModalOpen(false)}>
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
              Reminder Title *
            </label>
            <input
              type="text"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Call for premium payment"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Due Date *
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reminder Type
            </label>
            <select
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="customer_followup">Customer Follow-up</option>
              <option value="premium_due_verification">Verify Premium Due Date</option>
              <option value="maturity_followup">Maturity Follow-up</option>
              <option value="document_verification">Document Verification</option>
              <option value="general">General Task</option>
            </select>
          </div>

          {customer.policies.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Link to Policy (Optional)
              </label>
              <select
                value={reminderPolicyId}
                onChange={(e) => setReminderPolicyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No specific policy</option>
                {customer.policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    Policy {p.policyNumber} (Plan {p.originalPlanString})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteCustomer}
        title="Delete Customer Profile"
        message={deleteError || `Are you sure you want to delete profile for "${customer.displayName}"?`}
        confirmLabel="Delete"
      />
    </div>
  );
}
