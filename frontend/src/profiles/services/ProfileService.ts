import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import {
  type OrgMembership,
  type OrgRole,
} from '@/profiles/types';

import type { ProfileDetail, ProfileWithMembership, UserProfile } from '@/profiles/types';

/**
 * ProfileServiceV2 centralizes all profile and membership data access logic. It is the successor to
 * `profile_service.ts`, exposing the same capabilities but grouped into clear namespaces:
 *
 * - `profiles`: CRUD-style endpoints for profile rows and membership-enriched views.
 * - `leaderboard`: aggregations such as the XP leaderboard.
 * - `memberships`: operations that span profiles, org_members, and organizations.
 *
 * Usage:
 * ```ts
 * import { profileServiceV2 } from '@/services/profileServiceV2';
 *
 * const profiles = await profileServiceV2.profiles.list();
 * const profile = await profileServiceV2.profiles.getWithMemberships(profileId);
 * const leaderboard = await profileServiceV2.leaderboard.topMembers(5);
 * await profileServiceV2.memberships.addByOrgSlug(userId, 'org-slug', 'manager');
 * ```
 *
 * Prefer this service over direct Supabase calls or the legacy service to keep mappers, error handling,
 * and domain conventions consistent while we migrate callers.
 */

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
  organization: { id: string; name: string | null; slug: string | null } | null;
};

type ProfileWithMembershipViewRow = ProfileRow & {
  org_id: string;
  org_name: string | null;
  slug: string | null;
  org_role: OrgRole;
  join_date: string | Date | null;
};

/** Shape used by the XP leaderboard cards and tables. */
export type MemberLeaderboardEntry = {
  id: string;
  name: string;
  xp: number;
  orgCount: number;
};

type ListQueryResult<T = unknown> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
type SingleQueryResult<T = unknown> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;

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

function toMembership(row: MembershipRelationRow): OrgMembership {
  return {
    org_id: row.org_id,
    org_name: row.organization?.name ?? 'Unknown',
    slug: row.organization?.slug ?? 'unknown',
    org_role: row.role,
    join_date: asDate(row.joined_at, 'membership join'),
  };
}

function toProfileWithMembership(row: any): ProfileWithMembership {
  return {
    // UserProfile fields
    id: row.id,
    name: row.name,
    xp: row.xp,
    creation_time: new Date(row.creation_time),
    role: row.role,

    // OrgMembership fields
    org_id: row.org_id,
    org_name: row.org_name,
    slug: row.slug,
    org_role: row.org_role,
    join_date: new Date(row.join_date),
  };
}

async function getList<T = unknown>(query: ListQueryResult<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function getSingle<T = unknown>(query: SingleQueryResult<T>, notFoundMessage: string): Promise<T> {
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

export const profileService = {
  profiles: {
    /**
     * Fetches all profiles ordered by creation date (newest first).
     * @returns List of normalized user profiles.
     */
    async list(): Promise<UserProfile[]> {
      const rows = await getList<ProfileRow>(
        supabase.from('profiles').select('*').order('creation_time', { ascending: false })
      );
      return rows.map(toUserProfile);
    },

    /**
     * Retrieves a single profile by identifier.
     * @param profileId Profile UUID.
     * @throws Error when the profile does not exist.
     */
    async getById(profileId: string): Promise<UserProfile> {
      const row = await getSingle<ProfileRow>(
        supabase.from('profiles').select('*').eq('id', profileId).single(),
        `Profile not found with id: ${profileId}`
      );
      return toUserProfile(row);
    },

    /**
     * Returns a profile along with all organization memberships.
     * @param profileId Profile UUID.
     * @throws Error when profile is missing.
     */
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
    /**
     * Returns the top profiles ranked by XP.
     * @param limit Max number of results (must be positive).
     */
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
    /**
     * Lists members of an organization using the database view.
     * @param orgId Organization UUID.
     */
    async listByOrganization(orgId: string): Promise<ProfileWithMembership[]> {
      const rows = await getList<ProfileWithMembershipViewRow>(
        supabase.from('profile_with_membership').select('*').eq('org_id', orgId)
      );
      return rows.map(toProfileWithMembership);
    },

    /**
     * Adds a user to an organization by slug.
     * @throws Error when the org slug is invalid or the user already belongs to the org.
     */
    async addByOrgSlug(userId: string, orgSlug: string, role: OrgRole = 'member'): Promise<void> {
      const orgId = await getOrganizationIdBySlug(orgSlug);
      const { error } = await supabase
        .from('org_members')
        .insert([{ user_id: userId, org_id: orgId, role }]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('User is already a member of this organization.');
        }
        throw error;
      }
    },

    /**
     * Removes a membership between a user and organization.
     */
    async remove(userId: string, orgId: string): Promise<void> {
      const { error } = await supabase.from('org_members').delete().eq('user_id', userId).eq('org_id', orgId);
      if (error) {
        throw error;
      }
    },

    /**
     * Updates the role assigned to a user within an organization.
     */
    async setRole(userId: string, orgId: string, role: OrgRole): Promise<void> {
      const { error } = await supabase.from('org_members').update({ role }).eq('user_id', userId).eq('org_id', orgId);
      if (error) {
        throw error;
      }
    },
  },
};

