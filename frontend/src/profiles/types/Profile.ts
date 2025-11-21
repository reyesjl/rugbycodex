import type { MembershipRole, OrgMembership } from "@/profiles/types/Membership";

/**
 * Role given to a profile which controls access and moderation abilities.
 */
export type ProfileRole = 'admin' | 'moderator' | 'user';

/**
 * Data describing a single user profile returned from the backend service.
 */
export type UserProfile = {
  /** Unique identifier for the profile record. */
  id: string;
  /** Display name chosen by the user. */
  name: string;
  /** Accumulated experience points, if any. */
  xp: number | null;
  /** Timestamp of profile creation. */
  creation_time: Date;
  /** Access level granted to the profile. */
  role: ProfileRole;
};

/** Normalized profile information coupled with all organization memberships. */
export type ProfileDetail = UserProfile & { memberships: OrgMembership[] };

/**
 * User profile along with their membership to a specific organization.
 * Conforms to the VIEW defined ProfileWithMembership in the database.
 */
export type ProfileWithMembership = UserProfile & OrgMembership;

export type ProfileRow = {
  id: string;
  name: string;
  xp: number | null;
  creation_time: string | Date | null;
  role: UserProfile['role'];
};

export type ProfileWithMembershipViewRow = ProfileRow & {
  org_id: string;
  org_name: string | null;
  slug: string | null;
  org_role: MembershipRole;
  join_date: string | Date | null;
};
