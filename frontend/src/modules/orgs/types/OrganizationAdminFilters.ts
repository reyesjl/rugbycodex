import type { OrganizationType } from "./OrganizationType";
import type { OrganizationVisibility } from "./OrganizationVisibility";
import type { UserId } from "./UserId";

export type OrganizationAdminFilters = {
  search?: string;
  owner_id?: UserId;
  visibility?: OrganizationVisibility;
  type?: OrganizationType;
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
};
