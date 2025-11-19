/**
 * Role assigned to a user within an organization.
 */
export type OrgRole = 'owner' | 'manager' | 'staff' | 'member' | 'viewer';

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


