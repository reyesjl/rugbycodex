import type { OrgId } from '@/modules/orgs/types';

export type ProfileRole = 'user' | 'admin'; // matches enum

export type Profile = {
  id: string;
  name: string;
  username: string;
  role: ProfileRole;
  xp: number;
  primary_org: OrgId | null;
  creation_time: Date;
};