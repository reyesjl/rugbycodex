import type { OrgMembership } from "./OrgMembership";
import type { Organization } from "./Organization";

export type UserOrganizationSummary = {
  organization: Organization;
  membership: OrgMembership;
};
