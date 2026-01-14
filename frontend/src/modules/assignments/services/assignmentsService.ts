import { supabase } from '@/lib/supabaseClient';
import type {
  AssignmentTargetType,
  FeedAssignment,
  OrgAssignment,
  OrgAssignmentListItem,
  OrgAssignmentTarget,
  UserAssignmentFeed,
} from '@/modules/assignments/types';

export const assignmentsService = {
  async getAssignmentsForOrg(orgId: string): Promise<OrgAssignmentListItem[]> {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, org_id, created_by, title, description, due_at, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const ids = (assignments ?? []).map((a) => (a as any).id as string);
    if (ids.length === 0) return [];

    const { data: targets, error: targetsError } = await supabase
      .from('assignment_targets')
      .select('assignment_id, target_type, target_id')
      .in('assignment_id', ids);

    if (targetsError) throw targetsError;

    const targetsByAssignment = new Map<string, OrgAssignmentTarget[]>();
    for (const t of (targets ?? []) as OrgAssignmentTarget[]) {
      const existing = targetsByAssignment.get(t.assignment_id) ?? [];
      existing.push(t);
      targetsByAssignment.set(t.assignment_id, existing);
    }

    const { data: segments, error: segmentsError } = await supabase
      .from('assignment_segments')
      .select('assignment_id')
      .in('assignment_id', ids);

    if (segmentsError) throw segmentsError;

    const segmentCountByAssignment = new Map<string, number>();
    for (const s of (segments ?? []) as Array<{ assignment_id: string }>) {
      segmentCountByAssignment.set(s.assignment_id, (segmentCountByAssignment.get(s.assignment_id) ?? 0) + 1);
    }

    return (assignments ?? []).map((a) => {
      const row = a as OrgAssignment;
      const id = (a as any).id as string;
      return {
        ...row,
        targets: targetsByAssignment.get(id) ?? [],
        clipCount: segmentCountByAssignment.get(id) ?? 0,
      };
    });
  },

  async createAssignment(
    orgId: string,
    payload: {
      title: string;
      description?: string | null;
      dueAt?: string | null;
      targets?: Array<{ type: AssignmentTargetType; id?: string | null }>;
    },
  ): Promise<OrgAssignment> {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const profileId = userResult.user?.id;
    if (!profileId) throw new Error('You must be signed in to create an assignment.');

    const { data: assignment, error } = await supabase
      .from('assignments')
      .insert({
        org_id: orgId,
        created_by: profileId,
        title: payload.title,
        description: payload.description ?? null,
        due_at: payload.dueAt ?? null,
      })
      .select('id, org_id, created_by, title, description, due_at, created_at')
      .single();

    if (error) throw error;

    const targets = payload.targets ?? [];
    if (targets.length > 0) {
      const rows = targets.map((t) => ({
        assignment_id: (assignment as any).id,
        target_type: t.type,
        target_id: t.type === 'team' ? null : (t.id ?? null),
      }));

      const { error: targetsError } = await supabase.from('assignment_targets').insert(rows);
      if (targetsError) throw targetsError;
    }

    return assignment as OrgAssignment;
  },

  async getAssignmentsForUser(orgId: string, userId: string): Promise<UserAssignmentFeed> {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, title, created_at, due_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const assignmentIds = (assignments ?? []).map((a: any) => a.id as string);
    if (assignmentIds.length === 0) {
      return { assignedToYou: [], assignedToTeam: [] };
    }

    const { data: targets, error: targetsError } = await supabase
      .from('assignment_targets')
      .select('assignment_id, target_type, target_id')
      .in('assignment_id', assignmentIds);

    if (targetsError) throw targetsError;

    const toYouIds = new Set<string>();
    const toTeamIds = new Set<string>();

    for (const t of (targets ?? []) as OrgAssignmentTarget[]) {
      if (t.target_type === 'team') {
        toTeamIds.add(t.assignment_id);
      }
      if (t.target_type === 'player' && t.target_id === userId) {
        toYouIds.add(t.assignment_id);
      }
    }

    const relevantIds = Array.from(new Set([...toYouIds, ...toTeamIds]));
    if (relevantIds.length === 0) {
      return { assignedToYou: [], assignedToTeam: [] };
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('assignment_progress')
      .select('assignment_id, completed')
      .eq('profile_id', userId)
      .in('assignment_id', relevantIds);

    if (progressError) throw progressError;

    const completed = new Set(
      (progressRows ?? [])
        .filter((r: any) => Boolean(r.completed))
        .map((r: any) => r.assignment_id as string),
    );

    const toFeed = (row: any, assigned_to: 'player' | 'team'): FeedAssignment => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      due_at: row.due_at,
      assigned_to,
      completed: completed.has(row.id),
    });

    const byId = new Map<string, any>();
    for (const a of assignments ?? []) byId.set((a as any).id, a);

    return {
      assignedToYou: Array.from(toYouIds).map((id) => byId.get(id)).filter(Boolean).map((a) => toFeed(a, 'player')),
      assignedToTeam: Array.from(toTeamIds).map((id) => byId.get(id)).filter(Boolean).map((a) => toFeed(a, 'team')),
    };
  },

  async markAssignmentComplete(assignmentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('assignment_progress')
      .upsert(
        {
          assignment_id: assignmentId,
          profile_id: userId,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'assignment_id,profile_id' },
      );

    if (error) throw error;
  },

    async attachSegment(assignmentId: string, mediaSegmentId: string): Promise<void> {
      const { error } = await supabase.from('assignment_segments').insert({
        assignment_id: assignmentId,
        media_segment_id: mediaSegmentId,
      });

      if (error) throw error;
    },
};
