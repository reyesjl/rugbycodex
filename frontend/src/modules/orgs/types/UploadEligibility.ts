import type { Bytes } from "./Bytes";
import type { Megabytes } from "./Megabytes";
import type { OrgId } from "./OrgId";

export type UploadEligibility = {
  allowed: boolean;
  reason?: string;
  org_id: OrgId;
  file_size_bytes: Bytes;
  remaining_bytes?: Bytes;
  limit_mb?: Megabytes;
  used_bytes?: Bytes;
};
