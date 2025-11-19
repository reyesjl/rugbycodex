import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import {
  type OrgMembership,
  type OrgRole,
  type ProfileWithMembership,
  type UserProfile,
  toProfileWithMembership,
} from '@/types';

type ProfileRow = {
  id: string;
  name: string;
  xp: number | null;
  creation_time: string | Date | null;
  role: UserProfile['role'];
};

type MembershipRelationRow = {
  org_id: string;
  role: OrgRole;
  joined_at: string | Date | null;
  organization: { id: string; name: string; slug: string } | null;
};

type ProfileWithMembershipViewRow = ProfileRow & {
  org_id: string;
  org_name: string | null;
  slug: string | null;
  org_role: OrgRole;
  join_date: string | Date | null;
};

export type ProfileDetail = UserProfile & { memberships: OrgMembership[] };

export type MemberLeaderboardEntry = {
  id: string;
  name: string;
  xp: number;
  orgCount: number;
};

type ListQueryResult<T = any> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
type SingleQueryResult<T = any> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;

function asDate(value: string | Date | null, context: string): Date {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return parsed;
}

function toUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    xp: row.xp,
    creation_time: asDate(row.creation_time, 'profile creation'),
    role: row.role,
  };
}

function toMembership(row: Partial<MembershipRelationRow> & Partial<OrgMembership>): OrgMembership {
  if (!row.org_id) {
    throw new Error('Membership is missing organization identifier.');
  }
  return {
    org_id: row.org_id as string,
    org_name: row.org_name ?? row.organization?.name ?? 'Unknown',
    slug: row.slug ?? row.organization?.slug ?? 'unknown',
    org_role: row.role ?? row.org_role ?? 'member',
    join_date: asDate(row.joined_at ?? row.join_date ?? null, 'membership join'),
  };
}

async function getList<T = any>(query: ListQueryResult<T>, emptyMessage?: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  if (!data) {
    if (emptyMessage) {
      throw new Error(emptyMessage);
    }
    return [];
  }
  return data;
}

async function getSingle<T = any>(query: SingleQueryResult<T>, notFoundMessage: string): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  if (!data) {
    throw new Error(notFoundMessage);
  }
  return data;
}

async function getOrganizationIdBySlug(slug: string): Promise<string> {
  const org = await getSingle<{ id: string }>(
    supabase.from('organizations').select('id').eq('slug', slug).single(),
    `Organization not found with slug: ${slug}`
  );
  return org.id;
}

export const profileServiceV2 = {
  profiles: {
    async list(): Promise<UserProfile[]> {
      const rows = await getList<ProfileRow>(
        supabase.from('profiles').select('*').order('creation_time', { ascending: false }),
        'No profiles found.'
      );
      return rows.map(toUserProfile);
    },

    async getById(profileId: string): Promise<UserProfile> {
      const row = await getSingle<ProfileRow>(
        supabase.from('profiles').select('*').eq('id', profileId).single(),
        `Profile not found with id: ${profileId}`
      );
      return toUserProfile(row);
    },

    async getWithMemberships(profileId: string): Promise<ProfileDetail> {
      const row = await getSingle<ProfileRow & { memberships?: MembershipRelationRow[] }>(
        supabase
          .from('profiles')
          .select(
            `
            id,
            name,
            xp,
            creation_time,
            role,
            memberships:org_members (
              org_id,
              role,
              joined_at,
              organization:organizations (
                id,
                name,
                slug
              )
            )
          `
          )
          .eq('id', profileId)
          .single(),
        `Profile not found with id: ${profileId}`
      );

      const memberships = (row.memberships ?? []).map((membership) => toMembership(membership));

      return {
        ...toUserProfile(row),
        memberships,
      };
    },
  },

  leaderboard: {
    async topMembers(limit: number = 10): Promise<MemberLeaderboardEntry[]> {
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error('Limit must be a positive integer.');
      }

      const rows = await getList<{ id: string; name: string; xp: number | null; org_members?: { org_id: string }[] }>(
        supabase.from('profiles').select('id, name, xp, org_members(org_id)').order('xp', { ascending: false }).limit(limit)
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        xp: row.xp ?? 0,
        orgCount: row.org_members?.length ?? 0,
      }));
    },
  },

  memberships: {
    async listByOrganization(orgId: string): Promise<ProfileWithMembership[]> {
      const rows = await getList<ProfileWithMembershipViewRow>(
        supabase.from('profile_with_membership').select('*').eq('org_id', orgId),
        `No members found for organization with id: ${orgId}`
      );
      return rows.map(toProfileWithMembership);
    },

    async addByOrgSlug(userId: string, orgSlug: string, role: OrgRole = 'member'): Promise<void> {
      const orgId = await getOrganizationIdBySlug(orgSlug);
      const { error } = await supabase
        .from('org_members')
        .insert([{ user_id: userId, org_id: orgId, role }]);

      if (error) {
        if ('code' in error && error.code === '23505') {
          throw new Error('User is already a member of this organization.');
        }
        throw error;
      }
    },

    async remove(userId: string, orgId: string): Promise<void> {
      const { error } = await supabase.from('org_members').delete().eq('user_id', userId).eq('org_id', orgId);
      if (error) {
        throw error;
      }
    },

    async setRole(userId: string, orgId: string, role: OrgRole): Promise<void> {
      const { error } = await supabase.from('org_members').update({ role }).eq('user_id', userId).eq('org_id', orgId);
      if (error) {
        throw error;
      }
    },
  },
};
