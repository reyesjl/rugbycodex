
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

/**
 * Relationship between a user profile and an organization.
 */
export type OrgMembership = {
  /** Identifier of the organization. */
  org_id: string;
  /** Human readable organization name. */
  org_name: string;
  /** Organization slug used in URLs. */
  slug: string;
  /** Role given to the user inside the organization. */
  role: string;
  /** Date the user joined the organization. */
  join_date: Date;
};
