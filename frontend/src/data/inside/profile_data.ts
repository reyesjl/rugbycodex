export type ProfileRole = 'admin' | 'moderator' | 'user';

export interface UserProfile {
  id: string;
  xp: number | null;
  creation_time: string | null;
  name: string;
  role: ProfileRole;
}