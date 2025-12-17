import type { OrgMembership } from "./OrgMembership";
import type { Organization } from "./Organization";

export type ResolvedOrgContext = {
  organization: Organization;
  membership: OrgMembership | null;
  matched_by: "id" | "slug";
};
