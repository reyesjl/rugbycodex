import type { OrgMembership } from "./OrgMembership";
import type { Organization } from "./Organization";

export type ActiveOrgContext = {
  organization: Organization;
  membership: OrgMembership | null;
  source: "profile.primary_org" | "client_state" | "explicit";
};
