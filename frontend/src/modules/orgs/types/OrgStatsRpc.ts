/**
 * Response from get_org_stats() RPC function
 * Used for dashboard statistics on OrgOverview page
 */
export type OrgStatsRpc = {
  total_matches: number;
  matches_last_30_days: number;
  total_narrations: number;
  total_segments: number;
  identity_tagged_segments: number;
  well_covered_matches: number;
  avg_narrations_per_match: number;
  incomplete_assignments: number;
};
