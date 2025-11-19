export const MEMBERSHIP_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
] as const;
/**
 * Role assigned to a user within an organization.
 */
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number]['value'];

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
  org_role: MembershipRole;
  /** Date the user joined the organization. */
  join_date: Date;
};


