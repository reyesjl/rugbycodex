import type { Bytes } from "./Bytes";
import type { Megabytes } from "./Megabytes";
import type { Organization } from "./Organization";

export type OrgNearLimit = {
  organization: Organization;
  used_bytes: Bytes;
  limit_mb: Megabytes;
  utilization_ratio: number;
  computed_at: Date;
};
