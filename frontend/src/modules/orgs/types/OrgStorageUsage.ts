import type { Bytes } from "./Bytes";
import type { OrgId } from "./OrgId";

export type OrgStorageUsage = {
  org_id: OrgId;
  used_bytes: Bytes;
  calculated_at: Date;
};
