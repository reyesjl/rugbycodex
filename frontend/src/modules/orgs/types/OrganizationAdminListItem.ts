import type { Bytes } from "./Bytes";
import type { OrgHealthStatus } from "./OrgHealthStatus";
import type { Organization } from "./Organization";

export type OrganizationAdminListItem = {
  organization: Organization;
  member_count?: number;
  storage_used_bytes?: Bytes;
  last_activity_at?: Date | null;
  health_status?: OrgHealthStatus;
};
