import type { OrgId } from "./OrgId";
import type { OrgRole } from "./OrgRole";
import type { UserId } from "./UserId";

export type OrgMembership = {
  org_id: OrgId;
  user_id: UserId;
  role: OrgRole;
  joined_at: Date | null;
};
