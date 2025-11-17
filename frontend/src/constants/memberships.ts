export const MEMBERSHIP_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number]['value'];
