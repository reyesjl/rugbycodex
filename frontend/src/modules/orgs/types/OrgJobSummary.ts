import type { OrgId } from "./OrgId";
import type { OrgJob } from "./OrgJob";

export type OrgJobSummary = {
  org_id: OrgId;
  total: number;
  by_state: Record<string, number>;
  recent: OrgJob[];
  computed_at: Date;
};
