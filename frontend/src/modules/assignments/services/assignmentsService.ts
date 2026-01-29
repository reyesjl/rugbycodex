import { supabase } from '@/lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';
import type {
  AssignmentTargetType,
  FeedAssignment,
  OrgAssignment,
  OrgAssignmentListItem,
  OrgAssignmentTarget,
  UserAssignmentFeed,
} from '@/modules/assignments/types';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';

type SegmentRow = {
  id: string;
  media_asset_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  created_at: string | Date | null;
  media_assets:
    | {
        id: string;
        org_id: string;
        uploader_id: string;
        bucket: string;
        storage_path: string;
        streaming_ready: boolean;
        thumbnail_path: string | null;
        file_size_bytes: number;
        mime_type: string;
        duration_seconds: number;
        checksum: string;
        source: string;
        file_name: string;
        kind: string;
        status: string;
        created_at: string | Date | null;
        base_org_storage_path: string;
      }
    | null;
};

export type AssignmentFeedMode = 'assigned_to_you' | 'assigned_to_team' | 'group';

export type AssignmentFeedEntry = {
  assignment: FeedAssignment;
  asset: OrgMediaAsset;
  segment: MediaAssetSegment;
};

export type AssignmentProgressRow = {
  assignment_id: string;
  profile_id: string;
  completed: boolean;
};

export type AssignmentTargetInput = { type: AssignmentTargetType; id?: string | null };

function asDate(value: string | Date | null, context: string): Date {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return parsed;
}

function reorderByStartId<T extends { id: string }>(list: T[], startId?: string | null): T[] {
  const id = startId ? String(startId) : '';
  if (!id) return list;
  const index = list.findIndex((item) => item.id === id);
  if (index <= 0) return list;
  return [list[index]!, ...list.slice(0, index), ...list.slice(index + 1)];
}

const FALLBACK_ASSIGNMENT_TITLE = 'Clip review';
export function normalizeAssignmentTitle(raw: string | null | undefined): string {
  const title = String(raw ?? '').trim();
  if (!title) return FALLBACK_ASSIGNMENT_TITLE;
  let cleaned = title;
  cleaned = cleaned.replace(/\b(coach|member|staff)\b/gi, '');
  cleaned = cleaned.replace(/\bvs\b\s+[A-Z0-9\s]+/g, '');
  cleaned = cleaned.replace(/\bsegment\s*\d+\b/gi, '');
  cleaned = cleaned.replace(/\bclip\s*\d+\b/gi, '');
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*[–-]\s*\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
  cleaned = cleaned.replace(/[•]/g, ' ');
  cleaned = cleaned.replace(/\s*[–-]\s*/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned || FALLBACK_ASSIGNMENT_TITLE;
}

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

  async updateAssignment(
    assignmentId: string,
    payload: { title: string; description?: string | null; dueAt?: string | null }
  ): Promise<OrgAssignment> {
    const { data, error } = await supabase
      .from('assignments')
      .update({
        title: payload.title,
        description: payload.description ?? null,
        due_at: payload.dueAt ?? null,
      })
      .eq('id', assignmentId)
      .select('id, org_id, created_by, title, description, due_at, created_at')
      .single();

    if (error) throw error;
    return data as OrgAssignment;
  },

  async replaceAssignmentTargets(assignmentId: string, targets: AssignmentTargetInput[]): Promise<void> {
    const { error: deleteError } = await supabase.from('assignment_targets').delete().eq('assignment_id', assignmentId);
    if (deleteError) throw deleteError;

    if (!targets || targets.length === 0) return;
    const rows = targets.map((t) => ({
      assignment_id: assignmentId,
      target_type: t.type,
      target_id: t.type === 'team' ? null : (t.id ?? null),
    }));

    const { error: insertError } = await supabase.from('assignment_targets').insert(rows);
    if (insertError) throw insertError;
  },

  async deleteAssignment(assignmentId: string): Promise<void> {
    const { error: assignmentError } = await supabase.from('assignments').delete().eq('id', assignmentId);
    if (assignmentError) throw assignmentError;
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
      return { assignedToYou: [], assignedToTeam: [], assignedToGroups: [] };
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

    // Groups the user belongs to (for group-targeted assignments).
    const { data: groupMembers, error: groupMembersError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('profile_id', userId);

    if (groupMembersError) throw groupMembersError;

    const groupIds = Array.from(
      new Set((groupMembers ?? []).map((r: any) => String(r.group_id)).filter(Boolean)),
    );

    const groupNameById = new Map<string, string>();
    if (groupIds.length > 0) {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('org_id', orgId)
        .in('id', groupIds);

      if (groupsError) throw groupsError;
      for (const g of (groups ?? []) as Array<{ id: string; name: string }>) {
        groupNameById.set(String(g.id), String(g.name));
      }
    }

    const assignmentIdsByGroup = new Map<string, Set<string>>();
    if (groupIds.length > 0) {
      const groupIdSet = new Set(groupIds);
      for (const t of (targets ?? []) as OrgAssignmentTarget[]) {
        if (t.target_type !== 'group') continue;
        const gid = t.target_id ? String(t.target_id) : '';
        if (!gid || !groupIdSet.has(gid)) continue;
        const set = assignmentIdsByGroup.get(gid) ?? new Set<string>();
        set.add(String(t.assignment_id));
        assignmentIdsByGroup.set(gid, set);
      }
    }

    const relevantIds = Array.from(
      new Set([
        ...toYouIds,
        ...toTeamIds,
        ...Array.from(assignmentIdsByGroup.values()).flatMap((s) => Array.from(s)),
      ]),
    );

    if (relevantIds.length === 0) {
      return { assignedToYou: [], assignedToTeam: [], assignedToGroups: [] };
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('assignment_progress')
      .select('assignment_id, completed, completed_at')
      .eq('profile_id', userId)
      .in('assignment_id', relevantIds);

    if (progressError) throw progressError;

    const completed = new Set<string>();
    const completedAtByAssignment = new Map<string, string | null>();
    for (const row of (progressRows ?? []) as Array<{ assignment_id: string; completed: boolean; completed_at?: string | null }>) {
      const assignmentId = String(row.assignment_id ?? '');
      if (!assignmentId) continue;
      if (row.completed) completed.add(assignmentId);
      if (row.completed_at) completedAtByAssignment.set(assignmentId, row.completed_at);
    }

    const { data: segmentRows, error: segmentError } = await supabase
      .from('assignment_segments')
      .select('assignment_id, media_segment_id')
      .in('assignment_id', relevantIds);

    if (segmentError) throw segmentError;

    const segmentIdByAssignment = new Map<string, string>();
    for (const s of (segmentRows ?? []) as Array<{ assignment_id: string; media_segment_id: string | null }>) {
      const assignmentId = String(s.assignment_id ?? '');
      if (!assignmentId || segmentIdByAssignment.has(assignmentId)) continue;
      const segmentId = String(s.media_segment_id ?? '');
      if (!segmentId) continue;
      segmentIdByAssignment.set(assignmentId, segmentId);
    }

    const segmentIds = Array.from(new Set(segmentIdByAssignment.values())).filter(Boolean);
    const thumbnailBySegmentId = new Map<string, string | null>();
    if (segmentIds.length > 0) {
      const { data: segmentThumbRows, error: segmentThumbError } = (await supabase
        .from('media_asset_segments')
        .select(
          `
          id,
          media_assets (
            thumbnail_path
          )
        `
        )
        .in('id', segmentIds)) as { data: Array<{ id: string; media_assets: { thumbnail_path: string | null } | null }> | null; error: PostgrestError | null };

      if (segmentThumbError) throw segmentThumbError;
      for (const row of segmentThumbRows ?? []) {
        thumbnailBySegmentId.set(String(row.id), row.media_assets?.thumbnail_path ?? null);
      }
    }

    const thumbnailByAssignment = new Map<string, string | null>();
    for (const [assignmentId, segmentId] of segmentIdByAssignment.entries()) {
      thumbnailByAssignment.set(assignmentId, thumbnailBySegmentId.get(segmentId) ?? null);
    }

    const toFeed = (row: any, assigned_to: 'player' | 'team' | 'group'): FeedAssignment => ({
      id: row.id,
      title: normalizeAssignmentTitle(row.title),
      created_at: row.created_at,
      due_at: row.due_at,
      segment_id: segmentIdByAssignment.get(String(row.id)) ?? null,
      thumbnail_path: thumbnailByAssignment.get(String(row.id)) ?? null,
      assigned_to,
      completed: completed.has(row.id),
      completed_at: completedAtByAssignment.get(String(row.id)) ?? null,
    });

    const byId = new Map<string, any>();
    for (const a of assignments ?? []) byId.set((a as any).id, a);

    const assignedToYou = Array.from(toYouIds)
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((a) => toFeed(a, 'player'));

    const assignedToTeam = Array.from(toTeamIds)
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((a) => toFeed(a, 'team'));

    const assignedToGroups = Array.from(assignmentIdsByGroup.entries())
      .map(([groupId, ids]) => {
        const groupName = groupNameById.get(groupId) ?? 'Group';
        const assignments = Array.from(ids)
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((a) => toFeed(a, 'group'));

        return { groupId, groupName, assignments };
      })
      .filter((g) => g.assignments.length > 0)
      .sort((a, b) => a.groupName.toLowerCase().localeCompare(b.groupName.toLowerCase()));

    return { assignedToYou, assignedToTeam, assignedToGroups };
  },

  async getAssignmentProgress(assignmentIds: string[]): Promise<AssignmentProgressRow[]> {
    const ids = Array.from(new Set(assignmentIds.map((id) => String(id)).filter(Boolean)));
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('assignment_progress')
      .select('assignment_id, profile_id, completed')
      .in('assignment_id', ids);

    if (error) throw error;
    return (data ?? []) as AssignmentProgressRow[];
  },

  async getAssignmentFeed(options: {
    orgId: string;
    userId: string;
    mode: AssignmentFeedMode;
    groupId?: string | null;
    startAssignmentId?: string | null;
  }): Promise<AssignmentFeedEntry[]> {
    const { orgId, userId, mode } = options;
    if (!orgId || !userId) return [];

    const feed = await this.getAssignmentsForUser(orgId, userId);

    let assignments: FeedAssignment[] = [];
    if (mode === 'assigned_to_you') {
      assignments = feed.assignedToYou;
    } else if (mode === 'assigned_to_team') {
      assignments = feed.assignedToTeam;
    } else if (mode === 'group') {
      const groupId = String(options.groupId ?? '');
      if (!groupId) {
        throw new Error('Missing groupId for group assignments.');
      }
      const group = feed.assignedToGroups.find((g) => g.groupId === groupId);
      assignments = group?.assignments ?? [];
    }

    const playableAssignments = assignments.filter((a) => Boolean(a.segment_id));
    const orderedAssignments = reorderByStartId(playableAssignments, options.startAssignmentId);

    const segmentIds = Array.from(
      new Set(orderedAssignments.map((a) => a.segment_id).filter(Boolean))
    ) as string[];
    if (segmentIds.length === 0) return [];

    const { data, error } = (await supabase
      .from('media_asset_segments')
      .select(
        `
        id,
        media_asset_id,
        segment_index,
        start_seconds,
        end_seconds,
        created_at,
        media_assets (
          id,
          org_id,
          uploader_id,
          bucket,
          storage_path,
          streaming_ready,
          thumbnail_path,
          file_size_bytes,
          mime_type,
          duration_seconds,
          checksum,
          source,
          file_name,
          kind,
          status,
          created_at,
          base_org_storage_path
        )
      `
      )
      .eq('media_assets.org_id', orgId)
      .in('id', segmentIds)) as { data: SegmentRow[] | null; error: PostgrestError | null };

    if (error) throw error;

    const segmentById = new Map<string, { asset: OrgMediaAsset; segment: MediaAssetSegment }>();
    for (const row of data ?? []) {
      if (!row.media_assets) continue;
      const assetRow = row.media_assets;
      const asset: OrgMediaAsset = {
        id: assetRow.id,
        org_id: assetRow.org_id,
        uploader_id: assetRow.uploader_id,
        bucket: assetRow.bucket,
        storage_path: assetRow.storage_path,
        streaming_ready: assetRow.streaming_ready,
        thumbnail_path: assetRow.thumbnail_path ?? null,
        file_size_bytes: assetRow.file_size_bytes,
        mime_type: assetRow.mime_type,
        duration_seconds: assetRow.duration_seconds,
        checksum: assetRow.checksum,
        source: assetRow.source,
        file_name: assetRow.file_name,
        title: null,
        kind: assetRow.kind,
        status: assetRow.status,
        created_at: asDate(assetRow.created_at, 'media asset creation'),
        base_org_storage_path: assetRow.base_org_storage_path,
      };

      const segment: MediaAssetSegment = {
        id: row.id,
        media_asset_id: row.media_asset_id,
        segment_index: row.segment_index,
        start_seconds: row.start_seconds,
        end_seconds: row.end_seconds,
        created_at: asDate(row.created_at, 'segment creation'),
      };

      segmentById.set(String(row.id), { asset, segment });
    }

    return orderedAssignments
      .map((assignment) => {
        const segmentId = String(assignment.segment_id ?? '');
        const entry = segmentById.get(segmentId);
        if (!entry) return null;
        return { assignment, ...entry };
      })
      .filter(Boolean) as AssignmentFeedEntry[];
  },

  async getAssignmentFeedById(options: {
    orgId: string;
    assignmentId: string;
  }): Promise<AssignmentFeedEntry[]> {
    const { orgId, assignmentId } = options;
    if (!orgId || !assignmentId) return [];

    const { data: assignmentRow, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, created_at, due_at')
      .eq('org_id', orgId)
      .eq('id', assignmentId)
      .single();

    if (assignmentError) throw assignmentError;
    if (!assignmentRow) return [];

    const { data: targetRows, error: targetError } = await supabase
      .from('assignment_targets')
      .select('target_type')
      .eq('assignment_id', assignmentId);

    if (targetError) throw targetError;

    const hasTeam = (targetRows ?? []).some((t: any) => t.target_type === 'team');
    const hasGroup = (targetRows ?? []).some((t: any) => t.target_type === 'group');
    const assignedTo: FeedAssignment['assigned_to'] = hasTeam ? 'team' : hasGroup ? 'group' : 'player';

    const { data: assignmentSegments, error: segmentsError } = await supabase
      .from('assignment_segments')
      .select('media_segment_id')
      .eq('assignment_id', assignmentId);

    if (segmentsError) throw segmentsError;

    const segmentIds = Array.from(
      new Set((assignmentSegments ?? []).map((s: any) => String(s.media_segment_id ?? '')).filter(Boolean))
    );
    if (segmentIds.length === 0) return [];

    const { data, error } = (await supabase
      .from('media_asset_segments')
      .select(
        `
        id,
        media_asset_id,
        segment_index,
        start_seconds,
        end_seconds,
        created_at,
        media_assets (
          id,
          org_id,
          uploader_id,
          bucket,
          storage_path,
          streaming_ready,
          thumbnail_path,
          file_size_bytes,
          mime_type,
          duration_seconds,
          checksum,
          source,
          file_name,
          kind,
          status,
          created_at,
          base_org_storage_path
        )
      `
      )
      .eq('media_assets.org_id', orgId)
      .in('id', segmentIds)) as { data: SegmentRow[] | null; error: PostgrestError | null };

    if (error) throw error;

    const rows = (data ?? [])
      .filter((row) => Boolean(row.media_assets))
      .map((row) => ({
        row,
        segmentIndex: row.segment_index ?? 0,
      }))
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .map(({ row }) => row);

    const baseAssignment: FeedAssignment = {
      id: assignmentRow.id,
      title: normalizeAssignmentTitle((assignmentRow as any).title),
      created_at: (assignmentRow as any).created_at,
      due_at: (assignmentRow as any).due_at ?? null,
      segment_id: null,
      thumbnail_path: null,
      assigned_to: assignedTo,
      completed: false,
      completed_at: null,
    };

    return rows.map((row) => {
      const assetRow = row.media_assets!;
      const asset: OrgMediaAsset = {
        id: assetRow.id,
        org_id: assetRow.org_id,
        uploader_id: assetRow.uploader_id,
        bucket: assetRow.bucket,
        storage_path: assetRow.storage_path,
        streaming_ready: assetRow.streaming_ready,
        thumbnail_path: assetRow.thumbnail_path ?? null,
        file_size_bytes: assetRow.file_size_bytes,
        mime_type: assetRow.mime_type,
        duration_seconds: assetRow.duration_seconds,
        checksum: assetRow.checksum,
        source: assetRow.source,
        file_name: assetRow.file_name,
        title: null,
        kind: assetRow.kind,
        status: assetRow.status,
        created_at: asDate(assetRow.created_at, 'media asset creation'),
        base_org_storage_path: assetRow.base_org_storage_path,
      };

      const segment: MediaAssetSegment = {
        id: row.id,
        media_asset_id: row.media_asset_id,
        segment_index: row.segment_index,
        start_seconds: row.start_seconds,
        end_seconds: row.end_seconds,
        created_at: asDate(row.created_at, 'segment creation'),
      };

      return {
        assignment: { ...baseAssignment, segment_id: segment.id },
        asset,
        segment,
      } satisfies AssignmentFeedEntry;
    });
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

  /**
   * Find assignments that the user is assigned to which contain the given segment.
   * Returns assignment IDs in order of creation (newest first).
   */
  async getAssignmentsForSegment(
    segmentId: string,
    userId: string,
    orgId: string
  ): Promise<string[]> {
    if (!segmentId || !userId || !orgId) return [];

    // First, find all assignments that include this segment
    const { data: assignmentSegments, error: segError } = await supabase
      .from('assignment_segments')
      .select('assignment_id')
      .eq('media_segment_id', segmentId);

    if (segError) throw segError;
    if (!assignmentSegments || assignmentSegments.length === 0) return [];

    const assignmentIds = Array.from(
      new Set(assignmentSegments.map((s: any) => String(s.assignment_id)).filter(Boolean))
    );

    // Get the assignments themselves to verify they're in the right org
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('id, created_at')
      .eq('org_id', orgId)
      .in('id', assignmentIds)
      .order('created_at', { ascending: false });

    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) return [];

    const validAssignmentIds = assignments.map((a: any) => String(a.id));

    // Now check which of these assignments are assigned to the user
    const { data: targets, error: targetError } = await supabase
      .from('assignment_targets')
      .select('assignment_id, target_type, target_id')
      .in('assignment_id', validAssignmentIds);

    if (targetError) throw targetError;

    const toUserIds = new Set<string>();
    const toTeamIds = new Set<string>();
    const toGroupIds = new Set<string>();

    for (const t of (targets ?? []) as Array<{ assignment_id: string; target_type: string; target_id: string | null }>) {
      if (t.target_type === 'player' && t.target_id === userId) {
        toUserIds.add(t.assignment_id);
      } else if (t.target_type === 'team') {
        toTeamIds.add(t.assignment_id);
      } else if (t.target_type === 'group' && t.target_id) {
        toGroupIds.add(t.target_id);
      }
    }

    // Check which groups the user belongs to
    const groupIdsToCheck = Array.from(toGroupIds);
    const userGroupIds = new Set<string>();
    if (groupIdsToCheck.length > 0) {
      const { data: groupMembers, error: gmError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('profile_id', userId)
        .in('group_id', groupIdsToCheck);

      if (gmError) throw gmError;
      for (const gm of (groupMembers ?? []) as Array<{ group_id: string }>) {
        userGroupIds.add(String(gm.group_id));
      }
    }

    // Collect assignment IDs where user is assigned (directly, via team, or via group)
    const userAssignmentIds = new Set<string>();
    
    // Add direct assignments
    for (const id of toUserIds) {
      userAssignmentIds.add(id);
    }
    
    // Add team assignments
    for (const id of toTeamIds) {
      userAssignmentIds.add(id);
    }
    
    // Add group assignments where user is a member
    for (const t of (targets ?? []) as Array<{ assignment_id: string; target_type: string; target_id: string | null }>) {
      if (t.target_type === 'group' && t.target_id && userGroupIds.has(t.target_id)) {
        userAssignmentIds.add(t.assignment_id);
      }
    }

    // Return in order (newest first)
    return assignments
      .filter((a: any) => userAssignmentIds.has(String(a.id)))
      .map((a: any) => String(a.id));
  },
};
