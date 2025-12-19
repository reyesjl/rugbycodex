import type { Megabytes } from "./Megabytes";
import type { OrgId } from "./OrgId";

export type OrgStorageLimit = {
  org_id: OrgId;
  limit_mb: Megabytes;
};
