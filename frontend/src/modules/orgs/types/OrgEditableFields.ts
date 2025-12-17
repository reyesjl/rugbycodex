import type { OrganizationType } from "./OrganizationType";
import type { OrganizationVisibility } from "./OrganizationVisibility";

export type OrgEditableFields = {
  name?: string;
  bio?: string | null;
  visibility?: OrganizationVisibility;
  type?: OrganizationType | null;
};
