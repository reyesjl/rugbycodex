import type { Organization } from "@/modules/orgs/types";

export type BillingItem = {
  organization: Organization;
  member_count: number;
  narration_count: number | null; // null = still loading
  storage_used_bytes: number;
  monthly_revenue: number; // Calculated monthly revenue
  created_at: Date;
  last_activity_at: Date | null;
  loading_narrations?: boolean; // Track loading state
  narration_error?: string | null; // Track any errors loading narrations
};
