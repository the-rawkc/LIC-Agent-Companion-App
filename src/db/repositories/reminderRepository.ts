import { db } from '../database';
import type { Reminder, ReminderStatus, ReminderType } from '@/types';

export interface ReminderWithDetails extends Reminder {
  customerName?: string;
  policyNumber?: string;
}

export const reminderRepository = {
  async getAll(): Promise<Reminder[]> {
    return await db.reminders.orderBy('dueDate').toArray();
  },

  async getAllWithDetails(): Promise<ReminderWithDetails[]> {
    const [reminders, customers, policies] = await Promise.all([
      db.reminders.orderBy('dueDate').toArray(),
      db.customers.toArray(),
      db.policies.toArray(),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c.displayName]));
    const policyMap = new Map(policies.map((p) => [p.id, p.policyNumber]));

    return reminders.map((r) => ({
      ...r,
      customerName: customerMap.get(r.customerId) || 'Unknown Customer',
      policyNumber: r.policyId ? policyMap.get(r.policyId) : undefined,
    }));
  },

  async getById(id: string): Promise<Reminder | undefined> {
    return await db.reminders.get(id);
  },

  async getByCustomerId(customerId: string): Promise<Reminder[]> {
    return await db.reminders.where('customerId').equals(customerId).toArray();
  },

  async getByPolicyId(policyId: string): Promise<Reminder[]> {
    return await db.reminders.where('policyId').equals(policyId).toArray();
  },

  async create(reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newReminder: Reminder = {
      ...reminder,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await db.reminders.add(newReminder);

    await db.auditLogs.add({
      id: crypto.randomUUID(),
      entityType: 'reminder',
      entityId: id,
      action: 'create',
      timestamp: now,
      summary: `Created reminder: "${reminder.title}" for ${reminder.dueDate}`,
    });

    return id;
  },

  async update(id: string, updates: Partial<Reminder>): Promise<void> {
    const existing = await db.reminders.get(id);
    if (!existing) throw new Error(`Reminder with ID ${id} not found.`);

    const now = new Date().toISOString();
    await db.reminders.update(id, {
      ...updates,
      updatedAt: now,
    });
  },

  async delete(id: string): Promise<void> {
    await db.reminders.delete(id);
  },

  async toggleStatus(id: string): Promise<ReminderStatus> {
    const existing = await db.reminders.get(id);
    if (!existing) throw new Error(`Reminder not found.`);

    const newStatus: ReminderStatus = existing.status === 'completed' ? 'pending' : 'completed';
    await this.update(id, { status: newStatus });
    return newStatus;
  }
};
