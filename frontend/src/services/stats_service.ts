import { supabase } from '@/lib/supabaseClient';

export type DashboardStats = {
  organizations: number;
  members: number;
  narrations: number;
  uploads: number;
};

async function getTableCount(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  if (count === null) {
    throw new Error(`Failed to get count for table: ${table}`);
  }

  return count;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [organizations, members, narrations, uploads] = await Promise.all([
    getTableCount('organizations'),
    getTableCount('profiles'),
    getTableCount('narrations'),
    getTableCount('media_assets'),
  ]);

  return {
    organizations,
    members,
    narrations,
    uploads,
  };
}
