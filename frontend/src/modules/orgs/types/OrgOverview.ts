import type { OrgJobSummary } from "./OrgJobSummary";
import type { OrgMediaAssetSummary } from "./OrgMediaAssetSummary";
import type { OrgMembership } from "./OrgMembership";
import type { OrgStats } from "./OrgStats";
import type { OrgStorageLimit } from "./OrgStorageLimit";
import type { OrgStorageRemaining } from "./OrgStorageRemaining";
import type { OrgStorageUsage } from "./OrgStorageUsage";
import type { Organization } from "./Organization";

export type OrgOverview = {
  organization: Organization;
  membership: OrgMembership | null;
  stats: OrgStats;
  storage: {
    usage: OrgStorageUsage;
    limit: OrgStorageLimit;
    remaining: OrgStorageRemaining;
    near_limit: boolean;
  };
  recent_uploads: OrgMediaAssetSummary[];
  jobs: OrgJobSummary;
  computed_at: Date;
};
