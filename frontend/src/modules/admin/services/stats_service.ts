import { supabase } from '@/lib/supabaseClient';
import type { DashboardStats, AdminDashboardOverview } from '@/modules/admin/types';

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

export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const { data, error } = await supabase.rpc('admin_get_dashboard_overview');

  if (error) {
    throw new Error(`Failed to fetch admin dashboard overview: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from admin dashboard overview');
  }

  return data as AdminDashboardOverview;
}
