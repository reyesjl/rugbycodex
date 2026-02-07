export type AdminUserListItem = {
  id: string;
  name: string;
  username: string;
  role: 'user' | 'admin';
  xp: number;
  primary_org: string | null;
  primary_org_name: string | null;
  creation_time: Date | string;
  org_membership_count: number;
};
