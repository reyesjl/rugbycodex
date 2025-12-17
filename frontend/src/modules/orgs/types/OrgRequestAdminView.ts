import type { OrgRequest } from "./OrgRequest";
import type { ProfileSummary } from "./ProfileSummary";

export type OrgRequestAdminView = OrgRequest & {
  requester?: ProfileSummary;
  reviewer?: ProfileSummary;
};
