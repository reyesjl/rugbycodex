import type { OrgMembership } from "./OrgMembership";
import type { ProfileSummary } from "./ProfileSummary";

export type OrgMember = {
  membership: OrgMembership;
  profile: ProfileSummary;
};
