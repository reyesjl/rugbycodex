import type { Megabytes } from "./Megabytes";
import type { OrganizationType } from "./OrganizationType";
import type { OrganizationVisibility } from "./OrganizationVisibility";
import type { UserId } from "./UserId";

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  owner?: UserId | null;
  storage_limit_mb?: Megabytes;
  bio?: string | null;
  visibility?: OrganizationVisibility;
  type?: OrganizationType | null;
};
