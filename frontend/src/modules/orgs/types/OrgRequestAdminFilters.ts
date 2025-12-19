import type { OrganizationRequestStatus } from "./OrganizationRequestStatus";
import type { OrganizationType } from "./OrganizationType";
import type { UserId } from "./UserId";

export type OrgRequestAdminFilters = {
  status?: OrganizationRequestStatus;
  requested_type?: OrganizationType;
  requester_id?: UserId;
  reviewed_by?: UserId;
  created_after?: Date;
  created_before?: Date;
  search?: string;
  limit?: number;
  offset?: number;
};
