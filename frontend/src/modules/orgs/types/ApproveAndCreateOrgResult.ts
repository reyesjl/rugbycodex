import type { OrgRequestAdminView } from "./OrgRequestAdminView";
import type { Organization } from "./Organization";

export type ApproveAndCreateOrgResult = {
  request: OrgRequestAdminView;
  organization: Organization;
};
