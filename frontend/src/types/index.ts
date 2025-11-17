
export type ProfileRole = 'admin' | 'moderator' | 'user';

export type UserProfile = {
  id: string;
  name: string;
  xp: number | null;
  creation_time: Date;
  role: ProfileRole;
};

export type OrgMembership = {
  org_id: string;
  org_name: string;
  slug: string;
  role: string;
  join_date: Date;
};

