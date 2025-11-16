import { supabase } from '@/lib/supabaseClient';

export type Organization = {
  id: string;
  owner: string | null;
  slug: string;
  name: string;
  created_at: Date;
  storage_limit_mb: number;
  bio: string | null;
};

export async function getOrganizationBySlug(slug: string): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Organization not found by slug: ' + slug);
  }

  return {
    id: data.id,
    owner: data.owner,
    slug: data.slug,
    name: data.name,
    created_at: new Date(data.created_at),
    storage_limit_mb: data.storage_limit_mb,
    bio: data.bio,
  };
}

export async function getAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*');

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No organizations found.');
  }

  return data.map((org) => ({
    id: org.id,
    owner: org.owner,
    slug: org.slug,
    name: org.name,
    created_at: new Date(org.created_at),
    storage_limit_mb: org.storage_limit_mb,
    bio: org.bio,
  }));
}

export async function updateBioById(id: string, bio: string) {
  //TODO: SQL Upsert validation?
  if (bio.length > 500) {
    throw new Error('Bio exceeds maximum length of 500 characters.');
  }
  const { error } = await supabase
    .from('organizations')
    .update({ bio })
    .eq('id', id);

  if (error) {
    console.error('Error updating bio:', error);
    throw error;
  }
}

export async function createOrganization(
  name: string,
  slug: string,
  owner: string | null,
  storage_limit_mb: number = 10000,
): Promise<void> {
  const { data, error } = await supabase
    .from('organizations')
    .insert([
      {
        "name": name,
        "slug": slug,
        "owner": owner,
        "storage_limit_mb": storage_limit_mb,
      },
    ])
    .select();

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Organization creation failed.');
  }
}

export async function deleteOrganizationById(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Organization not found for deletion with id: ' + id);
  }
}
