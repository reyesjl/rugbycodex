import type { UUID } from './UUID';
import type { OrgId } from './OrgId';
import type { UserId } from './UserId';
import type { JobState } from './JobState';
import type { JobType } from './JobType';

/**
 * Admin list item for jobs with aggregated details
 */
export type AdminJobListItem = {
  id: UUID;
  org_id: OrgId;
  org_name: string | null;
  media_asset_id: UUID | null;
  media_asset_segment_id: UUID | null;
  narration_id: UUID | null;
  type: JobType;
  state: JobState;
  progress: number;
  error_code: string | null;
  error_message: string | null;
  attempt: number;
  created_by: UserId | null;
  creator_name: string | null;
  creator_username: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};
