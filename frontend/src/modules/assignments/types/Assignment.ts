export type AssignmentTargetType = 'team' | 'player' | 'group';

export type OrgAssignment = {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
};

export type OrgAssignmentTarget = {
  assignment_id: string;
  target_type: AssignmentTargetType;
  target_id: string | null;
};

export type OrgAssignmentListItem = OrgAssignment & {
  targets: OrgAssignmentTarget[];
  clipCount: number;
};

export type FeedAssignment = {
  id: string;
  title: string;
  created_at: string;
  due_at: string | null;

  /** Primary segment to open when clicking from the feed (MVP: first attached segment). */
  segment_id: string | null;
  thumbnail_path?: string | null;

  assigned_to: 'player' | 'team' | 'group';

  completed: boolean;
  completed_at?: string | null;
};

export type UserAssignmentFeed = {
  assignedToYou: FeedAssignment[];
  assignedToTeam: FeedAssignment[];
  assignedToGroups: Array<{
    groupId: string;
    groupName: string;
    assignments: FeedAssignment[];
  }>;
};

export type AssignmentTargetInfo = {
  type: AssignmentTargetType;
  targetId: string | null;
  targetName: string | null;
};

export type ManagerAssignment = {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
  created_by: string;
  clipCount: number;
  completionCount: number;
  totalAssigned: number;
  targets: AssignmentTargetInfo[];
  lastCompletedAt: string | null;
};

// RPC Response Types

export type AssignmentStatus = 'overdue' | 'due_soon' | 'upcoming' | 'completed';

export type AssignmentWithProgress = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
  created_by: string;
  status: AssignmentStatus;
  total_assignees: number;
  completed_count: number;
  completion_rate: number; // 0.00 to 100.00
  target_label: string;
  clip_count: number;
  targets: OrgAssignmentTarget[];
};

export type AssigneeStatus = 'completed' | 'in_progress' | 'not_started';

export type AssignmentDetailAssignee = {
  user_id: string;
  user_name: string;
  email: string;
  status: AssigneeStatus;
  completion_rate: number; // 0.00 to 1.00
  completed_clips: number;
  total_clips: number;
  last_activity: string | null;
};

export type AssignmentDetailClip = {
  id: string;
  assignment_id: string;
  media_asset_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  thumbnail_path: string | null;
  duration: number;
};

export type AssignmentDetailTarget = OrgAssignmentTarget & {
  target_label: string;
};

export type AssignmentDetailSummary = {
  total_assignees: number;
  completed: number;
  in_progress: number;
  not_started: number;
};

export type AssignmentDetail = {
  assignment: OrgAssignment;
  targets: AssignmentDetailTarget[];
  clips: AssignmentDetailClip[];
  assignees: AssignmentDetailAssignee[];
  summary: AssignmentDetailSummary;
};
