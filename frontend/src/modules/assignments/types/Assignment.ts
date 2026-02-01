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
