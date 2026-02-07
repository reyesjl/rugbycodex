import { supabase } from '@/lib/supabaseClient';
import type { AdminJobListItem } from '@/modules/orgs/types/AdminJobListItem';
import type { JobState } from '@/modules/orgs/types/JobState';
import type { JobType } from '@/modules/orgs/types/JobType';

/**
 * Job service for admin operations
 */
export const jobService = {
  /**
   * Lists all jobs in the system (admin only).
   * 
   * @param filters - Optional search, state, and type filters
   * @returns List of jobs with org and creator details
   */
  async listAllJobs(filters?: {
    searchQuery?: string;
    state?: JobState | null;
    type?: JobType | null;
  }): Promise<AdminJobListItem[]> {
    type RpcRow = {
      id: string;
      org_id: string;
      org_name: string | null;
      media_asset_id: string | null;
      media_asset_segment_id: string | null;
      narration_id: string | null;
      type: string;
      state: string;
      progress: number;
      error_code: string | null;
      error_message: string | null;
      attempt: number;
      created_by: string | null;
      creator_name: string | null;
      creator_username: string | null;
      created_at: string;
      updated_at: string;
      started_at: string | null;
      finished_at: string | null;
    };

    const { data, error } = await supabase.rpc('admin_list_jobs_rpc', {
      p_search_query: filters?.searchQuery || null,
      p_state: filters?.state || null,
      p_type: filters?.type || null,
    });

    if (error) throw error;

    return (data as RpcRow[]).map((row) => ({
      id: row.id,
      org_id: row.org_id,
      org_name: row.org_name,
      media_asset_id: row.media_asset_id,
      media_asset_segment_id: row.media_asset_segment_id,
      narration_id: row.narration_id,
      type: row.type as JobType,
      state: row.state as JobState,
      progress: row.progress,
      error_code: row.error_code,
      error_message: row.error_message,
      attempt: row.attempt,
      created_by: row.created_by,
      creator_name: row.creator_name,
      creator_username: row.creator_username,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      started_at: row.started_at ? new Date(row.started_at) : null,
      finished_at: row.finished_at ? new Date(row.finished_at) : null,
    }));
  },
};
