import { supabase } from '@/lib/supabaseClient';
import { type UserProfile, type OrgMembership, type ProfileWithMembership, toProfileWithMembership } from '@/types';

export type ProfileWithMemberships = UserProfile & {
  memberships: OrgMembership[];
};

export async function getAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('creation_time', { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No profiles found.');
  }

  return data.map((profile) => ({
    id: profile.id,
    name: profile.name,
    xp: profile.xp,
    creation_time: new Date(profile.creation_time),
    role: profile.role,
  }));
}

export async function getProfileById(userId: string): Promise<ProfileWithMemberships> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
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
    `)
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Profile not found with id: ' + userId);
  }

  const memberships: OrgMembership[] = data.memberships?.map(item => ({
    org_id: item.org_id,
    org_name: (item.organization as { name?: string })?.name || 'Unknown',
    slug: (item.organization as { slug?: string })?.slug || 'unknown',
    org_role: item.role,
    join_date: new Date(item.joined_at),
  })) ?? [];

  return {
    id: data.id,
    name: data.name,
    xp: data.xp,
    creation_time: new Date(data.creation_time),
    role: data.role,
    memberships,
  };
}

export async function addMembershipToProfile(
  userId: string,
  orgSlug: string,
  role: string = 'member'
): Promise<void> {
  // First, get the org_id from the slug
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (orgError) {
    throw orgError;
  }

  if (!orgData) {
    throw new Error('Organization not found with slug: ' + orgSlug);
  }

  // Check if membership already exists
  const { data: existingMembership, error: checkError } = await supabase
    .from('org_members')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgData.id)
    .maybeSingle();

  if (checkError) {
    throw checkError;
  }

  if (existingMembership) {
    throw new Error('User is already a member of this organization.');
  }

  // Add membership
  const { error: insertError } = await supabase
    .from('org_members')
    .insert([
      {
        user_id: userId,
        org_id: orgData.id,
        role: role,
      },
    ]);

  if (insertError) {
    throw insertError;
  }
}

export async function removeMembershipFromProfile(
  userId: string,
  orgId: string
): Promise<void> {
  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (error) {
    throw error;
  }
}

export async function updateMembershipRole(
  userId: string,
  orgId: string,
  newRole: string
): Promise<void> {
  const { error } = await supabase
    .from('org_members')
    .update({ role: newRole })
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (error) {
    throw error;
  }
}

export async function getOrganizationMembers(orgId: string): Promise<ProfileWithMembership[]> {
  const { data, error } = await supabase
    .from('profile_with_membership')
    .select('*')
    .eq('org_id', orgId);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No members found for organization with id: ' + orgId);
  }

  return data.map(toProfileWithMembership);
}