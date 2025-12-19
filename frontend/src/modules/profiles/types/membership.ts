export type MembershipRole = "owner" | "manager" | "staff" | "member" | "viewer" | (string & {});

export type MembershipRoleOption = {
  label: string;
  value: MembershipRole;
};

/**
 * Options for membership-role selection UIs.
 *
 * Keep this list in sync with the database enum / policy expectations.
 */
export const MEMBERSHIP_ROLES: ReadonlyArray<MembershipRoleOption> = [
  { label: "Owner", value: "owner" },
  { label: "Manager", value: "manager" },
  { label: "Staff", value: "staff" },
  { label: "Member", value: "member" },
  { label: "Viewer", value: "viewer" },
];

/**
 * Role rank ordering used for sorting members and computing capability thresholds.
 * Lower number = more authority.
 */
export const ROLE_ORDER: Readonly<Record<string, number>> = {
  owner: 0,
  manager: 1,
  staff: 2,
  member: 3,
  viewer: 4,
};

