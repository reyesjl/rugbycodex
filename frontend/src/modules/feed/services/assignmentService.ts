export type FeedAssignment = {
  id: string;
  media_asset_id: string;
  media_asset_segment_id: string;
  title: string;
  assigned_to: 'user' | 'team';
  created_at: string | Date;
};

export const assignmentService = {
  async listAssignmentsForUser(_orgId: string): Promise<FeedAssignment[]> {
    return [];
  },

  async listAssignmentsForTeam(_orgId: string): Promise<FeedAssignment[]> {
    return [];
  },
};
