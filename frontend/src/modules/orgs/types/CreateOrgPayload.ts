import type { Megabytes } from "./Megabytes";
import type { OrganizationType } from "./OrganizationType";
import type { OrganizationVisibility } from "./OrganizationVisibility";
import type { UserId } from "./UserId";

export type CreateOrgPayload = {
  name: string;
  slug: string;
  owner_id?: UserId | null;
  type?: OrganizationType;
  visibility?: OrganizationVisibility;
  bio?: string | null;
  storage_limit_mb?: Megabytes;
};
