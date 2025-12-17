import type { Bytes } from "./Bytes";
import type { OrgId } from "./OrgId";

export type OrgStats = {
  org_id: OrgId;
  member_count: number;
  media_asset_count: number;
  total_storage_bytes: Bytes;
  jobs_count: number;
  last_upload_at: Date | null;
  last_job_at: Date | null;
  computed_at: Date;
};
