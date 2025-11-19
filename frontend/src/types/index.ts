
/**
 * Role given to a profile which controls access and moderation abilities.
 */
export type ProfileRole = 'admin' | 'moderator' | 'user';

/**
 * Role assigned to a user within an organization.
 */
export type OrgRole = 'owner' | 'manager' | 'staff' | 'member' | 'viewer';

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
  org_role: OrgRole;
  /** Date the user joined the organization. */
  join_date: Date;
};

/**
 * User profile along with their membership to a specific organization.
 * Conforms to the VIEW defined ProfileWithMembership in the database.
 */
export type ProfileWithMembership = UserProfile & OrgMembership;

export function toProfileWithMembership(row: any): ProfileWithMembership {
  return {
    // UserProfile fields
    id: row.id,
    name: row.name,
    xp: row.xp,
    creation_time: new Date(row.creation_time),
    role: row.role,

    // OrgMembership fields
    org_id: row.org_id,
    org_name: row.org_name,
    slug: row.slug,
    org_role: row.org_role,
    join_date: new Date(row.join_date),
  };
}
