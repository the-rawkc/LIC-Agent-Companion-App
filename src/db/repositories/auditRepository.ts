import { db } from '../database';
import type { AuditLog } from '@/types';

export const auditRepository = {
  async getRecent(limit: number = 50): Promise<AuditLog[]> {
    return await db.auditLogs.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async getByEntity(entityType: AuditLog['entityType'], entityId: string): Promise<AuditLog[]> {
    return await db.auditLogs
      .where('entityType')
      .equals(entityType)
      .filter((log) => log.entityId === entityId)
      .reverse()
      .sortBy('timestamp');
  },

  async clearLogs(): Promise<void> {
    await db.auditLogs.clear();
  }
};
