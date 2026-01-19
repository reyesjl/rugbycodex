import { supabase } from '@/lib/supabaseClient';
import type { OrgUsage } from '@/modules/usage/types/Usage';

export const usageService = {
  async getOrgUsage(orgId: string): Promise<OrgUsage> {
    const { data, error } = await supabase
      .from('org_storage_usage')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('No usage data available.');
    }

    return data as OrgUsage;
  },
};
