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

export async function updateBioById(id: string, bio: string) {
  const { error } = await supabase
    .from('organizations')
    .update({ bio })
    .eq('id', id);

  if (error) {
    console.error('Error updating bio:', error);
    throw error;
  }
}
