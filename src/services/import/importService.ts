import { db } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { normalizeAndValidateExtractedRow } from '../pdf/validatePolicy';
import { parseCleanNumber, generateUUID } from '@/utils/formatters';
import { d1SyncService } from '@/services/cloud/d1SyncService';
import type { 
  RawExtractedRow, 
  StagedPolicyRow, 
  ImportPreviewSummary, 
  Policy, 
  ImportHistory,
  PolicyRecordStatus 
} from '@/types';

export interface CommitImportOptions {
  filename: string;
  reportDate: string;
  rows: StagedPolicyRow[];
  duplicateHandling: 'skip' | 'update' | 'replace' | 'review';
}

export interface CommitImportResult {
  importId: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  newCustomersCount: number;
}

export const importService = {
  /**
   * Previews raw extracted rows, identifies existing policies in DB, validates each row
   */
  async preparePreview(
    rawRows: RawExtractedRow[],
    totalPages: number,
    warnings: string[]
  ): Promise<ImportPreviewSummary> {
    const existingPolicies = await policyRepository.getAll();
    const existingPolicyNumbers = new Set(existingPolicies.map((p) => p.policyNumber));

    const stagedRows: StagedPolicyRow[] = [];
    let readyCount = 0;
    let reviewCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const { row, isValid, warnings: rowWarnings } = normalizeAndValidateExtractedRow(
        rawRows[i],
        i,
        existingPolicyNumbers
      );

      if (row.isDuplicate) {
        duplicateCount++;
      }

      if (!isValid) {
        invalidCount++;
      } else if (rowWarnings.length > 0 || row.isDuplicate) {
        reviewCount++;
      } else {
        readyCount++;
      }

      stagedRows.push(row);
    }

    return {
      totalRowsDetected: rawRows.length,
      readyToImportCount: readyCount,
      requiringReviewCount: reviewCount,
      invalidCount,
      potentialDuplicateCount: duplicateCount,
      pagesProcessed: totalPages,
      warnings,
      rows: stagedRows,
    };
  },

  /**
   * Commit verified and approved rows into IndexedDB
   */
  async commitImport(options: CommitImportOptions): Promise<CommitImportResult> {
    const importId = generateUUID();
    const now = new Date().toISOString();

    // If 'replace' chosen, start with a 100% clean database slate
    if (options.duplicateHandling === 'replace') {
      await db.transaction('rw', [db.policies, db.customers, db.reminders], async () => {
        await db.policies.clear();
        await db.customers.clear();
        await db.reminders.clear();
      });
    }

    const existingPolicies = await policyRepository.getAll();
    const policyMapByNumber = new Map(existingPolicies.map((p) => [p.policyNumber, p]));

    const existingCustomers = await customerRepository.getAll();
    // Map normalized name -> Customer
    const customerMapByName = new Map(existingCustomers.map((c) => [c.normalizedName, c]));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let rejectedCount = 0;
    let newCustomersCount = 0;

    const createdPolicyIds: string[] = [];
    const updatedPolicyIds: string[] = [];

    // Filter only valid or user-approved rows
    const rowsToProcess = options.rows.filter((r) => r.isValid);
    rejectedCount = options.rows.length - rowsToProcess.length;

    await db.transaction('rw', [db.policies, db.customers, db.importHistory, db.auditLogs], async () => {
      for (const row of rowsToProcess) {
        // Resolve customer accurately (using full stitched name, cleaned punctuation, and DOB disambiguation)
        const cleanName = (row.customerName || 'Unknown Customer').replace(/^[,\s;]+|[,\s;]+$/g, '').replace(/\s+/g, ' ').trim();
        const normalizedName = cleanName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const disambiguatedKey = row.dob ? `${normalizedName}_${row.dob}` : normalizedName;

        let customer = customerMapByName.get(disambiguatedKey) || customerMapByName.get(normalizedName);

        // If an existing customer has the same name but a different recorded DOB, do not misallocate
        if (customer && customer.dateOfBirth && row.dob && customer.dateOfBirth !== row.dob) {
          customer = customerMapByName.get(disambiguatedKey);
        }

        if (!customer) {
          const customerId = generateUUID();
          customer = {
            id: customerId,
            displayName: cleanName,
            normalizedName,
            dateOfBirth: row.dob,
            createdAt: now,
            updatedAt: now,
          };
          await db.customers.add(customer);
          customerMapByName.set(disambiguatedKey, customer);
          if (!customerMapByName.has(normalizedName)) {
            customerMapByName.set(normalizedName, customer);
          }
          newCustomersCount++;
        }

        const existingPolicy = policyMapByNumber.get(row.policyNumber);

        if (existingPolicy) {
          if (options.duplicateHandling === 'skip') {
            skippedCount++;
            continue;
          }

          if (options.duplicateHandling === 'update') {
            // Update existing policy while correcting customer link and names
            const updatedRecord: Policy = {
              ...existingPolicy,
              customerId: customer.id,
              customerName: cleanName,
              planCode: row.planCode,
              term: row.term ?? existingPolicy.term,
              premiumPayingTerm: row.ppt ?? existingPolicy.premiumPayingTerm,
              originalPlanString: row.originalPlan,
              sumAssured: row.sumAssured,
              commencementDate: row.doc,
              premiumMode: row.mode,
              firstUnpaidPremiumDate: row.fup,
              premiumAmount: row.premium,
              maturityDate: row.dom,
              dateOfBirth: row.dob ?? existingPolicy.dateOfBirth,
              sourceSerialNumber: row.serialNumber ?? existingPolicy.sourceSerialNumber,
              sourceReportDate: options.reportDate,
              sourceImportId: importId,
              extractionWarnings: row.warnings,
              updatedAt: now,
            };

            await db.policies.put(updatedRecord);
            if (customer.displayName !== cleanName) {
              customer.displayName = cleanName;
              customer.updatedAt = now;
              await db.customers.put(customer);
            }
            updatedCount++;
            updatedPolicyIds.push(existingPolicy.id);
            continue;
          }
        }

        // Determine record status
        let status: PolicyRecordStatus = 'active';
        if (row.warnings.length > 0) {
          status = 'needs_verification';
        }

        const newPolicyId = generateUUID();
        const newPolicy: Policy = {
          id: newPolicyId,
          policyNumber: row.policyNumber,
          customerId: customer.id,
          customerName: cleanName,
          planCode: row.planCode,
          term: row.term,
          premiumPayingTerm: row.ppt,
          originalPlanString: row.originalPlan,
          sumAssured: row.sumAssured,
          commencementDate: row.doc,
          premiumMode: row.mode,
          firstUnpaidPremiumDate: row.fup,
          premiumAmount: row.premium,
          maturityDate: row.dom,
          dateOfBirth: row.dob,
          sourceSerialNumber: row.serialNumber ?? null,
          sourceReportDate: options.reportDate,
          sourceImportId: importId,
          rawExtractedValues: {
            originalText: row.originalText,
          },
          extractionWarnings: row.warnings,
          recordStatus: status,
          createdAt: now,
          updatedAt: now,
        };

        await db.policies.add(newPolicy);
        createdCount++;
        createdPolicyIds.push(newPolicyId);
        policyMapByNumber.set(row.policyNumber, newPolicy);
      }

      // Record Import History
      const historyEntry: ImportHistory = {
        id: importId,
        filename: options.filename,
        importDate: now,
        totalRows: options.rows.length,
        createdCount,
        updatedCount,
        skippedCount,
        rejectedCount,
        warnings: options.rows.flatMap((r) => r.warnings).slice(0, 100),
        createdPolicyIds,
        updatedPolicyIds,
      };

      await db.importHistory.add(historyEntry);

      // Audit Log
      await db.auditLogs.add({
        id: generateUUID(),
        entityType: 'import',
        entityId: importId,
        action: 'import',
        timestamp: now,
        summary: `Imported ${options.filename}: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${newCustomersCount} new customers created.`,
      });
    });

    // Clean up orphaned customers (customers with 0 policies)
    try {
      const activeCustomerIds = new Set((await db.policies.toArray()).map((p) => p.customerId));
      const allCustomers = await db.customers.toArray();
      const orphanIds = allCustomers.filter((c) => !activeCustomerIds.has(c.id)).map((c) => c.id);
      if (orphanIds.length > 0) {
        await db.customers.bulkDelete(orphanIds);
      }
    } catch {
      // ignore
    }

    d1SyncService.triggerAutoSync(500);

    return {
      importId,
      createdCount,
      updatedCount,
      skippedCount,
      rejectedCount,
      newCustomersCount,
    };
  },

  /**
   * Rollback an import by deleting records created during that specific import
   */
  async rollbackImport(importId: string): Promise<{ deletedPolicies: number }> {
    const history = await db.importHistory.get(importId);
    if (!history) throw new Error('Import history not found');

    let deletedPolicies = 0;
    await db.transaction('rw', [db.policies, db.importHistory, db.auditLogs], async () => {
      for (const policyId of history.createdPolicyIds) {
        const policy = await db.policies.get(policyId);
        // Only delete if it has not been manually edited
        if (policy && policy.recordStatus !== 'manual') {
          await db.policies.delete(policyId);
          deletedPolicies++;
        }
      }

      await db.importHistory.delete(importId);

      await db.auditLogs.add({
        id: generateUUID(),
        entityType: 'import',
        entityId: importId,
        action: 'rollback',
        timestamp: new Date().toISOString(),
        summary: `Rolled back import ${history.filename} (ID: ${importId}). Removed ${deletedPolicies} created policies.`,
      });
    });

    // Clean up orphaned customers (customers with 0 policies)
    try {
      const activeCustomerIds = new Set((await db.policies.toArray()).map((p) => p.customerId));
      const allCustomers = await db.customers.toArray();
      const orphanIds = allCustomers.filter((c) => !activeCustomerIds.has(c.id)).map((c) => c.id);
      if (orphanIds.length > 0) {
        await db.customers.bulkDelete(orphanIds);
      }
    } catch {
      // ignore
    }

    d1SyncService.triggerAutoSync(500);

    return { deletedPolicies };
  },

  /**
   * Sanitizes all policy customer names, unifies matching customer profiles,
   * fixes punctuation, and removes any orphaned customers from older imports.
   */
  async cleanAndRepairDatabase(): Promise<{ fixedPolicies: number; cleanedCustomers: number; removedOrphans: number }> {
    let fixedPolicies = 0;
    let cleanedCustomers = 0;
    let removedOrphans = 0;

    const policies = await db.policies.toArray();
    const customers = await db.customers.toArray();
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const now = new Date().toISOString();

    for (const p of policies) {
      const cleanName = (p.customerName || 'Unknown Customer').replace(/^[,\s;]+|[,\s;]+$/g, '').replace(/\s+/g, ' ').trim();
      let needsUpdate = false;
      const updates: Partial<Policy> = {};

      if (p.customerName !== cleanName) {
        updates.customerName = cleanName;
        needsUpdate = true;
      }

      const linkedCust = customerMap.get(p.customerId);
      if (linkedCust && linkedCust.displayName !== cleanName) {
        linkedCust.displayName = cleanName;
        linkedCust.normalizedName = cleanName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        linkedCust.updatedAt = now;
        await db.customers.put(linkedCust);
        cleanedCustomers++;
      }

      if (needsUpdate) {
        await db.policies.update(p.id, { ...updates, updatedAt: now });
        fixedPolicies++;
      }
    }

    // Clean orphaned customers (0 policies)
    const activeCustomerIds = new Set((await db.policies.toArray()).map((p) => p.customerId));
    const allCusts = await db.customers.toArray();
    const orphanIds = allCusts.filter((c) => !activeCustomerIds.has(c.id)).map((c) => c.id);
    if (orphanIds.length > 0) {
      await db.customers.bulkDelete(orphanIds);
      removedOrphans = orphanIds.length;
    }

    d1SyncService.triggerAutoSync(500);
    return { fixedPolicies, cleanedCustomers, removedOrphans };
  }
};
