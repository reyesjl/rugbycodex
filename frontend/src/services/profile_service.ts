import { supabase } from '@/lib/supabaseClient';
import type { UserProfile, OrgMembership } from '@/types';

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
  // Fetch profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profileData) {
    throw new Error('Profile not found with id: ' + userId);
  }

  // Fetch memberships
  const { data: membershipsData, error: membershipsError } = await supabase
    .from('org_members')
    .select(`
      org_id,
      role,
      joined_at,
      organizations (
        id,
        name,
        slug
      )
    `)
    .eq('user_id', userId);

  if (membershipsError) {
    throw membershipsError;
  }

  const memberships: OrgMembership[] = membershipsData?.map(item => ({
    org_id: item.org_id,
    org_name: (item.organizations as { name?: string })?.name || 'Unknown',
    slug: (item.organizations as { slug?: string })?.slug || 'unknown',
    role: item.role,
    join_date: new Date(item.joined_at),
  })) ?? [];

  return {
    id: profileData.id,
    name: profileData.name,
    xp: profileData.xp,
    creation_time: new Date(profileData.creation_time),
    role: profileData.role,
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
