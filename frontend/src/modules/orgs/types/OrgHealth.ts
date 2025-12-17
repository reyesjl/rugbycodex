import type { Bytes } from "./Bytes";
import type { Megabytes } from "./Megabytes";
import type { OrgHealthStatus } from "./OrgHealthStatus";
import type { OrgId } from "./OrgId";

export type OrgHealth = {
  org_id: OrgId;
  status: OrgHealthStatus;
  signals: {
    storage?: {
      used_bytes: Bytes;
      limit_mb: Megabytes;
      near_limit: boolean;
    };
    jobs?: {
      failing_recently: boolean;
      last_error_at?: Date | null;
    };
    activity?: {
      last_upload_at?: Date | null;
      last_job_at?: Date | null;
    };
  };
  computed_at: Date;
};
