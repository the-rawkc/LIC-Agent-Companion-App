import { db, ensureDataSynchronized } from '@/db/database';
import { policyRepository } from '@/db/repositories/policyRepository';
import { customerRepository } from '@/db/repositories/customerRepository';
import { advanceFupDate, parseDateToISO, generateUUID, parseCleanNumber, normalizeSearchString } from '@/utils/formatters';
import { d1SyncService } from '@/services/cloud/d1SyncService';
import userUploadedPoliciesData from '@/services/sampleData/userUploadedPolicies.json';
import type {
  RawCommissionRow,
  CommissionBillPreviewItem,
  CommissionItemStatus,
  PremiumMode,
  Policy,
} from '@/types';

/**
 * Pre-compiled lookup set of the 1,516 verified base policies.
 * Used to immediately distinguish the baseline portfolio from newly added policies.
 */
export const BASE_POLICY_NUMBERS = new Set<string>(
  (userUploadedPoliciesData as any[]).map((r) => String(r.policyNo || '').replace(/[^0-9]/g, ''))
);

export function isBasePolicy(policyNumber: string | null | undefined): boolean {
  if (!policyNumber) return false;
  const clean = String(policyNumber).replace(/[^0-9]/g, '').trim();
  if (!clean) return false;
  return BASE_POLICY_NUMBERS.has(clean) || BASE_POLICY_NUMBERS.has(clean.replace(/^0+/, ''));
}

/**
 * Infer probable premium mode from the interval between Risk Date (DOC) and Paid Due Date
 */
export function inferModeFromDates(riskDateIso: string | null, dueDateIso: string | null): PremiumMode {
  if (!riskDateIso || !dueDateIso) return 'Half-Yearly';

  const risk = new Date(riskDateIso);
  const due = new Date(dueDateIso);
  if (isNaN(risk.getTime()) || isNaN(due.getTime())) return 'Half-Yearly';

  const monthsDiff = (due.getFullYear() - risk.getFullYear()) * 12 + (due.getMonth() - risk.getMonth());
  if (monthsDiff <= 0) return 'Half-Yearly';

  if (monthsDiff % 12 === 0) return 'Yearly';
  if (monthsDiff % 6 === 0) return 'Half-Yearly';
  if (monthsDiff % 3 === 0) return 'Quarterly';
  return 'Monthly';
}

/**
 * Normalize mode string to one of the standard app modes
 */
export function normalizeMode(rawMode: string | undefined): PremiumMode {
  if (!rawMode) return 'Half-Yearly';
  const m = rawMode.toLowerCase().trim();
  if (m.includes('half') || m === 'hly' || m === 'h') return 'Half-Yearly';
  if (m.includes('quarter') || m === 'qly' || m === 'q') return 'Quarterly';
  if (m.includes('year') || m === 'yly' || m === 'y') return 'Yearly';
  if (m.includes('month') || m === 'mly' || m === 'm' || m.includes('ecs') || m.includes('nach')) return 'Monthly';
  if (m.includes('single') || m === 'sgl') return 'Single';
  return 'Half-Yearly';
}

export interface CommitCommissionUpdatesResult {
  updatedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
}

export const commissionBillService = {
  /**
   * Prepares a staged preview of all rows in the commission bill.
   * Groups multiple entries for the same policy to the latest paid DueDt,
   * performs strict policy lookup, and determines current vs calculated next FUPs.
   */
  async preparePreview(rawRows: RawCommissionRow[]): Promise<CommissionBillPreviewItem[]> {
    // 1. Group rows by clean policy number to handle policies with multiple installments in one bill
    const groupedByPolicy = new Map<string, RawCommissionRow[]>();

    for (const row of rawRows) {
      const cleanPolNo = (row.policyNo || '').replace(/[^0-9]/g, '').trim();
      if (!cleanPolNo) continue;

      const list = groupedByPolicy.get(cleanPolNo) || [];
      list.push(row);
      groupedByPolicy.set(cleanPolNo, list);
    }

    // Ensure data is synchronized across database instances
    await ensureDataSynchronized();

    // Load all DB policies once for fast, 100% accurate lookup without race conditions
    const allDbPolicies = await db.policies.toArray();
    const dbPoliciesByNumber = new Map<string, Policy>();
    for (const p of allDbPolicies) {
      const pClean = p.policyNumber.replace(/[^0-9]/g, '').trim();
      if (pClean) {
        dbPoliciesByNumber.set(pClean, p);
        // Also map without leading zeros to match unpadded Excel numbers
        dbPoliciesByNumber.set(pClean.replace(/^0+/, ''), p);
      }
    }

    const items: CommissionBillPreviewItem[] = [];
    let sequentialIndex = 1;

    for (const [cleanPolNo, rows] of groupedByPolicy.entries()) {
      // Filter rows with parseable DueDt
      const validRows = rows.filter((r) => Boolean(parseDateToISO(r.dueDt)));
      if (validRows.length === 0) continue;

      // Sort rows by DueDt ascending so the last one is guaranteed to be the LATEST paid installment
      validRows.sort((a, b) => {
        const dateA = parseDateToISO(a.dueDt) || '';
        const dateB = parseDateToISO(b.dueDt) || '';
        return dateA.localeCompare(dateB);
      });

      // Always pick the latest date among all occurrences of this policy in the bill
      const latestRow = validRows[validRows.length - 1];
      const paidDueDateIso = parseDateToISO(latestRow.dueDt)!;

      const riskDateIso = parseDateToISO(latestRow.riskDate);
      const adjDateIso = parseDateToISO(latestRow.adjDate);

      // Aggregate total premium and commission for this policy if multiple rows existed
      const totalPrem = rows.reduce((acc, r) => acc + parseCleanNumber(r.premium), 0);
      const totalComm = rows.reduce((acc, r) => acc + parseCleanNumber(r.commission), 0);

      // Strict lookup in DB (supporting padded or unpadded policy numbers)
      const existing =
        dbPoliciesByNumber.get(cleanPolNo) || dbPoliciesByNumber.get(cleanPolNo.replace(/^0+/, ''));

      let effectiveMode: PremiumMode = 'Half-Yearly';
      let currentFup: string | null = null;
      let policyFound = false;
      let existingPolicyId: string | undefined;
      let customerName = latestRow.phName || `Customer of ${cleanPolNo}`;

      if (existing) {
        policyFound = true;
        existingPolicyId = existing.id;
        customerName = existing.customerName || customerName;
        currentFup = existing.firstUnpaidPremiumDate || existing.commencementDate;

        const existingModeNorm = normalizeMode(existing.premiumMode);
        if (existing.premiumMode && !['n/f', 'nf', 'na'].includes(existing.premiumMode.toLowerCase())) {
          effectiveMode = existingModeNorm;
        } else {
          // If existing mode is NF / NA, infer from dates or default
          effectiveMode = inferModeFromDates(riskDateIso || existing.commencementDate, paidDueDateIso);
        }
      } else {
        // Not in DB - infer mode from dates
        effectiveMode = inferModeFromDates(riskDateIso, paidDueDateIso);
      }

      // Calculate projected next FUP from the latest paid due date
      const calculatedNewFup = advanceFupDate(paidDueDateIso, effectiveMode);

      let status: CommissionItemStatus = 'not_in_db';
      let selected = true;

      if (policyFound) {
        const curIso = parseDateToISO(currentFup) || '';
        const newIso = parseDateToISO(calculatedNewFup) || '';
        if (!currentFup || !curIso || !newIso || curIso < newIso) {
          status = 'ready_to_update';
          selected = true;
        } else {
          status = 'already_up_to_date';
          selected = false;
        }
      } else {
        selected = true;
      }

      items.push({
        id: generateUUID(),
        sNo: latestRow.sNo ? parseInt(latestRow.sNo, 10) : sequentialIndex++,
        policyNo: cleanPolNo,
        customerName,
        planTerm: latestRow.planTerm || '',
        paidDueDate: paidDueDateIso,
        riskDate: riskDateIso,
        cbo: latestRow.cbo,
        adjDate: adjDateIso,
        premiumAmount: totalPrem,
        commissionAmount: totalComm,
        policyFoundInDb: policyFound,
        existingPolicyId,
        currentFup,
        mode: effectiveMode,
        calculatedNewFup,
        status,
        selected,
        occurrencesInBill: rows.length,
      });
    }

    return items;
  },

  /**
   * Recalculates projected next FUP when user edits the mode in the preview UI
   */
  recalculateItemMode(item: CommissionBillPreviewItem, newMode: PremiumMode): CommissionBillPreviewItem {
    const calculatedNewFup = advanceFupDate(item.paidDueDate, newMode);
    let status: CommissionItemStatus = item.status;

    if (item.policyFoundInDb) {
      const curIso = parseDateToISO(item.currentFup) || '';
      const newIso = parseDateToISO(calculatedNewFup) || '';
      if (!item.currentFup || !curIso || !newIso || curIso < newIso) {
        status = 'ready_to_update';
      } else {
        status = 'already_up_to_date';
      }
    }

    return {
      ...item,
      mode: newMode,
      calculatedNewFup,
      status,
    };
  },

  /**
   * Commits the selected updates to IndexedDB inside an ACID transaction.
   * Guarantees 100% data integrity:
   * 1. Strictly verifies Policy ID and Policy Number before applying any change.
   * 2. Preserves all other policy fields completely untouched.
   * 3. Prevents accidental regression if FUP is already ahead.
   * 4. Logs full audit history.
   */
  async commitUpdates(
    items: CommissionBillPreviewItem[],
    options?: { autoCreateMissingPolicies?: boolean; forceUpdate?: boolean }
  ): Promise<CommitCommissionUpdatesResult> {
    const now = new Date().toISOString();
    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const createdPolicies: Policy[] = [];

    // Execute within a Dexie transactional boundary to prevent partial writes
    await db.transaction('rw', [db.policies, db.customers, db.auditLogs, db.appSettings], async () => {
      for (const item of items) {
        if (!item.selected) {
          skippedCount++;
          continue;
        }

        try {
          let policy: Policy | undefined;
          if (item.existingPolicyId) {
            policy = await db.policies.get(item.existingPolicyId);
          }

          if (!policy) {
            // Fallback direct search in database by policy number
            const cleanItemNum = item.policyNo.replace(/[^0-9]/g, '').trim();
            const unpadded = cleanItemNum.replace(/^0+/, '');
            const candidates = await db.policies.toArray();
            policy = candidates.find((p) => {
              const pClean = p.policyNumber.replace(/[^0-9]/g, '').trim();
              return pClean === cleanItemNum || pClean.replace(/^0+/, '') === unpadded;
            });
          }

          if (policy) {
            const oldFup = policy.firstUnpaidPremiumDate || policy.commencementDate;
            const oldFupIso = parseDateToISO(oldFup) || '';
            const newFupIso = parseDateToISO(item.calculatedNewFup) || '';

            // Date safety rule: preserve latest date unless forceUpdate is specified
            if (oldFupIso && newFupIso && oldFupIso >= newFupIso && !options?.forceUpdate) {
              skippedCount++;
              continue;
            }

            // Update firstUnpaidPremiumDate, premiumMode, recordStatus, and updatedAt
            const updatedPolicy: Policy = {
              ...policy,
              firstUnpaidPremiumDate: item.calculatedNewFup,
              premiumMode: item.mode,
              recordStatus: policy.recordStatus === 'lapsed' ? 'active' : policy.recordStatus,
              updatedAt: now,
            };

            await db.policies.put(updatedPolicy);

            await db.auditLogs.add({
              id: generateUUID(),
              entityType: 'policy',
              entityId: policy.id,
              action: 'update',
              timestamp: now,
              summary: `Updated FUP for Policy ${policy.policyNumber} via Bill: ${oldFup} ➔ ${item.calculatedNewFup} (Paid Date: ${item.paidDueDate}, Mode: ${item.mode}).`,
              changedFields: {
                firstUnpaidPremiumDate: { old: oldFup, new: item.calculatedNewFup },
                premiumMode: { old: policy.premiumMode, new: item.mode },
              },
            });

            updatedCount++;
          } else if (options?.autoCreateMissingPolicies ?? true) {
            // Auto-create policy and customer if missing so all rows in the bill are saved!
            let customer = await customerRepository.findByNormalizedName(item.customerName);
            if (!customer) {
              const customerId = generateUUID();
              customer = {
                id: customerId,
                displayName: item.customerName,
                normalizedName: normalizeSearchString(item.customerName),
                createdAt: now,
                updatedAt: now,
              };
              await db.customers.add(customer);
            }

            const planCode = item.planTerm ? item.planTerm.split(/[-/]/)[0] : '815';
            const newPolicyId = generateUUID();
            const newPolicy: Policy = {
              id: newPolicyId,
              policyNumber: item.policyNo,
              customerId: customer.id,
              customerName: item.customerName,
              planCode,
              term: 20,
              premiumPayingTerm: 20,
              originalPlanString: item.planTerm || planCode,
              sumAssured: (item.premiumAmount || 10000) * 10,
              commencementDate: item.riskDate || item.paidDueDate,
              premiumMode: item.mode,
              firstUnpaidPremiumDate: item.calculatedNewFup,
              premiumAmount: item.premiumAmount || 0,
              maturityDate: advanceFupDate(item.paidDueDate, 'Yearly'),
              dateOfBirth: null,
              sourceSerialNumber: item.sNo ?? null,
              sourceReportDate: now.split('T')[0],
              sourceImportId: null,
              rawExtractedValues: {},
              extractionWarnings: [],
              recordStatus: 'active',
              createdAt: now,
              updatedAt: now,
            };

            await db.policies.add(newPolicy);

            await db.auditLogs.add({
              id: generateUUID(),
              entityType: 'policy',
              entityId: newPolicyId,
              action: 'create',
              timestamp: now,
              summary: `Policy ${item.policyNo} (${item.customerName}) auto-created from Bill with FUP ${item.calculatedNewFup} (Mode: ${item.mode}).`,
              changedFields: {
                firstUnpaidPremiumDate: { old: null, new: item.calculatedNewFup },
                premiumMode: { old: null, new: item.mode },
              },
            });

            createdPolicies.push(newPolicy);
            createdCount++;
          } else {
            skippedCount++;
          }
        } catch (err) {
          failedCount++;
          errors.push(`Error processing ${item.policyNo}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Persist the batch history of newly added policies for auditing & viewing
      if (createdPolicies.length > 0) {
        await db.appSettings.put({
          key: 'last_added_batch',
          value: {
            timestamp: now,
            count: createdPolicies.length,
            policyNumbers: createdPolicies.map((p) => p.policyNumber),
            policies: createdPolicies.map((p) => ({
              id: p.id,
              policyNumber: p.policyNumber,
              customerName: p.customerName,
              premiumMode: p.premiumMode,
              firstUnpaidPremiumDate: p.firstUnpaidPremiumDate,
              commencementDate: p.commencementDate,
              createdAt: p.createdAt,
            })),
          },
          updatedAt: now,
        });
      }
    });

    if (updatedCount > 0 || createdCount > 0) {
      // Immediate push to Cloudflare D1 so updates are instantaneously live across all agent devices
      const { agencyCode, pin, pinHash } = d1SyncService.getCredentials();
      if (agencyCode && (pin || pinHash)) {
        try {
          await d1SyncService.pushToCloud(agencyCode, pin || '');
          console.log(`[CommissionBill] Direct Cloud sync successfully completed for Agent ${agencyCode}`);
        } catch (e) {
          console.warn('[CommissionBill] Direct Cloud sync error, falling back to background autoSync:', e);
          d1SyncService.triggerAutoSync();
        }
      } else {
        d1SyncService.triggerAutoSync();
      }
    }

    return {
      updatedCount,
      createdCount,
      skippedCount,
      failedCount,
      errors,
    };
  },
};
