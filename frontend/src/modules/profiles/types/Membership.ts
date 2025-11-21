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
 * A mapping of membership role values to their corresponding order index.
 * 
 * The `ROLE_ORDER` object is constructed from the `MEMBERSHIP_ROLES` array,
 * assigning each role's `value` property to its index in the array. This allows
 * for easy lookup of a role's position or precedence within the membership roles.
 *
 * @remarks
 * Useful for sorting or comparing roles based on their defined order.
 *
 * @example
 * ```typescript
 * const adminOrder = ROLE_ORDER['admin']; // e.g., 0
 * const memberOrder = ROLE_ORDER['member']; // e.g., 1
 * ```
 */
export const ROLE_ORDER: Record<string, number> = MEMBERSHIP_ROLES
  .reduce((acc, r, i) => {
    acc[r.value] = i;
    return acc;
  }, {} as Record<string, number>);


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


