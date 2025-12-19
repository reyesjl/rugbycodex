import type { OrgId } from "./OrgId";
import type { OrgJoinRequestStatus } from "./OrgJoinRequestStatus";
import type { UUID } from "./UUID";
import type { UserId } from "./UserId";

export type OrgJoinRequest = {
  id: UUID;
  org_id: OrgId;
  requester_id: UserId;
  note: string | null;
  status: OrgJoinRequestStatus;
  reviewed_by: UserId | null;
  reviewed_at: Date | null;
  created_at: Date;
};
