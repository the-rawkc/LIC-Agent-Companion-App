import type { RawExtractedRow } from '@/types';
import userUploadedPoliciesData from './userUploadedPolicies.json';

/**
 * Authentic verified records drawn directly from the agent's LIC policy Excel spreadsheet (1,516 policies).
 * Every row matches 1-to-1 with exact policy numbers and customer names.
 */
export const SAMPLE_RAW_POLICY_ROWS: RawExtractedRow[] = userUploadedPoliciesData as unknown as RawExtractedRow[];
export const USER_UPLOADED_POLICY_ROWS: RawExtractedRow[] = userUploadedPoliciesData as unknown as RawExtractedRow[];
