import type { Bytes } from "./Bytes";
import type { Megabytes } from "./Megabytes";
import type { OrgId } from "./OrgId";

export type OrgStorageRemaining = {
  org_id: OrgId;
  used_bytes: Bytes;
  limit_mb: Megabytes;
  remaining_bytes: Bytes;
  calculated_at: Date;
};
