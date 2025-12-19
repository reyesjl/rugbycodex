import type { Megabytes } from "./Megabytes";
import type { OrgId } from "./OrgId";
import type { OrganizationType } from "./OrganizationType";
import type { OrganizationVisibility } from "./OrganizationVisibility";
import type { UserId } from "./UserId";

export type Organization = {
  id: OrgId;
  owner: UserId | null;
  slug: string;
  name: string;
  created_at: Date;
  storage_limit_mb: Megabytes;
  bio: string | null;
  visibility: OrganizationVisibility;
  type: OrganizationType | null;
};
