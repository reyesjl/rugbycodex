import type { JobState } from "./JobState";
import type { JobType } from "./JobType";
import type { OrgId } from "./OrgId";
import type { UUID } from "./UUID";
import type { UserId } from "./UserId";

export type OrgJob = {
  id: UUID;
  org_id: OrgId;
  type: JobType;
  state: JobState;
  progress: number;
  error_code: string | null;
  error_message: string | null;
  created_by: UserId | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};
