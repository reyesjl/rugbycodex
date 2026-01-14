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

  assigned_to: 'player' | 'team';

  completed: boolean;
};

export type UserAssignmentFeed = {
  assignedToYou: FeedAssignment[];
  assignedToTeam: FeedAssignment[];
};
