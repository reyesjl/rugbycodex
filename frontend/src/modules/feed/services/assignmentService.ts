export type FeedAssignment = {
  id: string;
  media_asset_id: string;
  media_asset_segment_id: string;
  title: string;
  assigned_to: 'player' | 'team';
  created_at: string | Date;

  // Completion state (different backends may use different flags)
  completed?: boolean;
  watched?: boolean;
  reviewed?: boolean;
};

export const assignmentService = {
  async listAssignmentsForUser(): Promise<FeedAssignment[]> {
    return [];
  },

  async listAssignmentsForTeam(): Promise<FeedAssignment[]> {
    return [];
  },
};
