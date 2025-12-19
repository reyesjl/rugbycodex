import type { OrgMembership } from "./OrgMembership";
import type { UserProfile } from "./UserProfile";

/**
 * Membership-enriched profile view used by legacy (v1) screens.
 *
 * Note:
 * - This type includes organization display data (name/slug) but does not imply
 *   authorization. Treat it as a read model only.
 */
export type ProfileDetail = UserProfile & {
  memberships: OrgMembership[];
};

