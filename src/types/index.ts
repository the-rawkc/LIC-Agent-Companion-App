export type PremiumMode = 'Yearly' | 'Half-Yearly' | 'Quarterly' | 'Monthly' | 'Single' | 'N/F' | 'NF' | 'NA' | string;

export type PolicyRecordStatus = 'active' | 'lapsed' | 'matured' | 'needs_verification' | 'manual';

export interface RawExtractedRow {
  sNo?: string;
  policyNo?: string;
  name?: string;
  planTermPpt?: string;
  sumAssured?: string;
  doc?: string;
  mode?: string;
  fup?: string;
  premium?: string;
  dom?: string;
  dob?: string;
  pageNumber?: number;
  rawText?: string;
}

export interface Policy {
  id: string;
  policyNumber: string; // Original string preserved
  customerId: string;
  customerName: string;
  planCode: string;
  term: number | null;
  premiumPayingTerm: number | null;
  originalPlanString: string;
  sumAssured: number; // Decimal representation
  commencementDate: string; // ISO date YYYY-MM-DD
  premiumMode: PremiumMode;
  firstUnpaidPremiumDate: string; // F.U.P. ISO date YYYY-MM-DD
  premiumAmount: number; // Decimal representation
  maturityDate: string; // D.O.M. ISO date YYYY-MM-DD
  dateOfBirth: string | null; // DOB (nullable if 00/00/0000 or missing)
  sourceSerialNumber: number | null;
  sourceReportDate: string; // e.g. "2026-10-29"
  sourceImportId: string | null;
  rawExtractedValues: Record<string, string>;
  extractionWarnings: string[];
  recordStatus: PolicyRecordStatus;
  verifiedNextPremiumDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  displayName: string;
  normalizedName: string;
  mobileNumber?: string;
  alternateNumber?: string;
  email?: string;
  address?: string;
  dateOfBirth?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderType = 
  | 'customer_followup' 
  | 'premium_due_verification' 
  | 'maturity_followup' 
  | 'document_verification' 
  | 'general';

export type ReminderStatus = 'pending' | 'completed' | 'cancelled';
export type ReminderPriority = 'low' | 'medium' | 'high';

export interface Reminder {
  id: string;
  customerId: string;
  policyId?: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  reminderType: ReminderType;
  status: ReminderStatus;
  priority: ReminderPriority;
  createdAt: string;
  updatedAt: string;
}

export interface ImportHistory {
  id: string;
  filename: string;
  importDate: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  warnings: string[];
  createdPolicyIds: string[];
  updatedPolicyIds: string[];
}

export interface AuditLog {
  id: string;
  entityType: 'policy' | 'customer' | 'reminder' | 'import';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'merge' | 'import' | 'rollback';
  timestamp: string;
  summary: string;
  changedFields?: Record<string, { old: unknown; new: unknown }>;
}

export interface StagedPolicyRow {
  rowId: string;
  isValid: boolean;
  isDuplicate: boolean;
  duplicatePolicyId?: string;
  validationErrors: string[];
  warnings: string[];
  pageNumber: number;
  originalText: string;
  // Parsed candidate fields
  serialNumber?: number | null;
  policyNumber: string;
  customerName: string;
  planCode: string;
  term: number | null;
  ppt: number | null;
  originalPlan: string;
  sumAssured: number;
  doc: string;
  mode: string;
  fup: string;
  premium: number;
  dom: string;
  dob: string | null;
  // User can manually edit row in preview
  userEdited?: boolean;
}

export interface ImportPreviewSummary {
  totalRowsDetected: number;
  readyToImportCount: number;
  requiringReviewCount: number;
  invalidCount: number;
  potentialDuplicateCount: number;
  pagesProcessed: number;
  warnings: string[];
  rows: StagedPolicyRow[];
}

export interface AppSettings {
  pinHash?: string;
  pinSalt?: string;
  isPinEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  reportDate: string;
}
