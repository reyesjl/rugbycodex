export type OrchestratorMode = "match_summary" | "auto_assign" | "my_rugby";

export type Role = "viewer" | "member" | "staff" | "manager" | "owner";

export type OrchestratorRequest = {
  user_id: string;
  org_id: string;
  mode: OrchestratorMode;
  message?: string;
  context?: {
    asset_id?: string;
  };
};

export type ProfileSummary = {
  id: string;
  name: string | null;
  username: string | null;
};

export type GroupSummary = {
  id: string;
  name: string | null;
};

export type NarrationContext = {
  text: string;
  segment_id: string;
  start_seconds: number | null;
  end_seconds: number | null;
  tags?: string[];
};

export type AssignmentContext = {
  title: string;
  description: string | null;
  segment_id: string | null;
  target_type: string | null;
};

export type MatchSummaryResponse = {
  text: string;
  clips: Array<{
    segment_id: string;
    start_seconds: number;
    end_seconds: number;
  }>;
};

export type AutoAssignResponse = {
  assignments: Array<{
    title: string;
    description?: string;
    segment_id: string;
    group_id: string;
    reason: string;
  }>;
};

export type MyRugbyCoachResponse = {
  focus_areas: string[];
};

export type MyRugbyPlayerResponse = {
  work_ons: string[];
};
