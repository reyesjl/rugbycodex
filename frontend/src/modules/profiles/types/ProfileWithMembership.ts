import type { MembershipRole } from "./membership";
import type { UserProfile } from "./UserProfile";

/**
 * Denormalized profile + a single membership row used in org member lists.
 */
export type ProfileWithMembership = UserProfile & {
  org_id: string;
  org_name: string;
  slug: string;
  org_role: MembershipRole;
  join_date: Date;
};

