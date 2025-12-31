import type { OrganizationVisibility } from "./OrganizationVisibility";
import type { OrganizationType } from "./OrganizationType";
import type { OrgRole } from "./OrgRole";

export type JoinOrgWithCodeResult = {
  status: "joined" | "already_member";
  org: {
    id: string;
    slug: string;
    name: string;
    visibility: OrganizationVisibility;
    type: OrganizationType | null;
  };
  membership: {
    role: OrgRole;
    joined_at: string; // ISO timestamp — keep it honest
  };
};