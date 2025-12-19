import type { OrgId } from "./OrgId";
import type { OrgRequestId } from "./OrgRequestId";
import type { OrganizationRequestStatus } from "./OrganizationRequestStatus";
import type { OrganizationType } from "./OrganizationType";
import type { UserId } from "./UserId";

export type OrgRequest = {
  id: OrgRequestId;
  requester_id: UserId;
  requested_name: string;
  requested_slug: string;
  requested_type: OrganizationType;
  message: string | null;
  status: OrganizationRequestStatus;
  reviewed_by: UserId | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  organization_id: OrgId | null;
  created_at: Date;
  updated_at: Date;
};
