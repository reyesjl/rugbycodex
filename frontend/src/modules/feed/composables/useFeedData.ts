import { computed, ref, watch } from 'vue';
import { assignmentsService, type AssignmentFeedEntry, type AssignmentFeedMode } from '@/modules/assignments/services/assignmentsService';
import type { FeedItem } from '@/modules/feed/types/FeedItem';
import { segmentService } from '@/modules/media/services/segmentService';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';
import { useSegmentTags } from '@/modules/media/composables/useSegmentTags';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/lib/toast';

type FeedDataOptions = {
  orgId: () => string | null;
  orgName: () => string | null;
  userId: () => string | null;
  source: () => string;
  segmentId: () => string;
  assignmentId: () => string;
  assignmentMode: () => AssignmentFeedMode | null;
  groupId: () => string;
  startAssignmentId: () => string;
};

export function useFeedData(options: FeedDataOptions) {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const items = ref<FeedItem[]>([]);
  const assignmentIdsByIndex = ref<string[]>([]);
  const profileNameById = ref<Record<string, string>>({});
  const markedAssignments = new Set<string>();
  let requestId = 0;

  const assignmentLabelByType: Record<'player' | 'team' | 'group', string> = {
    player: 'Assigned to you',
    team: 'Assigned to team',
    group: 'Assigned to group',
  };

  function assignmentMetaLine(entry: AssignmentFeedEntry, createdAt: Date): string {
    const label = assignmentLabelByType[entry.assignment.assigned_to] ?? 'Assignment';
    const dateLabel = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleDateString();
    return dateLabel ? `${label} • ${dateLabel}` : label;
  }

  function toFeedItem(entry: AssignmentFeedEntry): FeedItem {
    const createdAt = new Date(entry.assignment.created_at);
    const title = entry.assignment.title || 'Clip review';
    return {
      id: entry.segment.id,
      orgId: options.orgId()!,
      orgName: options.orgName(),
      mediaAssetId: entry.segment.media_asset_id,
      bucket: entry.asset.bucket,
      mediaAssetSegmentId: entry.segment.id,
      segmentIndex: entry.segment.segment_index,
      startSeconds: entry.segment.start_seconds,
      endSeconds: entry.segment.end_seconds,
      title,
      metaLine: assignmentMetaLine(entry, createdAt),
      createdAt,
      segment: { ...entry.segment, tags: entry.segment.tags ?? [] },
    };
  }

  const segmentIds = computed(() => {
    return items.value.map((item) => String(item.mediaAssetSegmentId)).filter(Boolean);
  });

  const segmentTags = useSegmentTags({ segmentIds: () => segmentIds.value });

  // Moved from FeedView.hydrateFeedItemTags.
  function applyTagsToItems(tagsBySegmentId: Record<string, SegmentTag[]>): void {
    if (Object.keys(tagsBySegmentId).length === 0) return;

    items.value = items.value.map((item) => {
      const segmentId = String(item.mediaAssetSegmentId);
      if (!(segmentId in tagsBySegmentId)) return item;
      const tags = tagsBySegmentId[segmentId] ?? [];
      const segment = item.segment ?? {
        id: item.mediaAssetSegmentId,
        media_asset_id: item.mediaAssetId,
        segment_index: item.segmentIndex,
        start_seconds: item.startSeconds,
        end_seconds: item.endSeconds,
        created_at: item.createdAt,
      };
      return { ...item, segment: { ...segment, tags } };
    });
  }

  // Moved from FeedView.hydrateIdentityProfiles.
  async function hydrateIdentityProfiles(feedItems: FeedItem[], activeRequestId: number): Promise<void> {
    const ids = new Set<string>();
    for (const item of feedItems) {
      const tags = item.segment?.tags ?? [];
      for (const tag of tags) {
        if (tag.tag_type !== 'identity') continue;
        if (!tag.created_by) continue;
        ids.add(String(tag.created_by));
      }
    }

    const missing = [...ids].filter((id) => !profileNameById.value[id]);
    if (!missing.length) return;

    const { data, error: loadError } = await supabase
      .from('public_profiles')
      .select('id, name, username')
      .in('id', missing);

    if (activeRequestId !== requestId) return;
    if (loadError) return;

    const next = { ...profileNameById.value };
    for (const row of data ?? []) {
      const name = row.name || row.username || '';
      if (!name) continue;
      next[String(row.id)] = name;
    }
    profileNameById.value = next;
  }

  watch(
    () => segmentTags.tagsBySegmentId.value,
    (next) => {
      applyTagsToItems(next);
      void hydrateIdentityProfiles(items.value, requestId);
    },
    { deep: true }
  );

  async function markAssignmentComplete(assignmentId: string): Promise<void> {
    const userId = options.userId();
    if (!userId) {
      console.log(JSON.stringify({
        event: 'assignment_completion_skipped',
        reason: 'no_user_id',
        assignmentId,
      }));
      return;
    }
    
    if (markedAssignments.has(assignmentId)) {
      console.log(JSON.stringify({
        event: 'assignment_completion_skipped',
        reason: 'already_marked',
        assignmentId,
        userId,
      }));
      return;
    }
    
    markedAssignments.add(assignmentId);
    
    console.log(JSON.stringify({
      event: 'assignment_completion_attempt',
      assignmentId,
      userId,
      source: options.source(),
    }));
    
    try {
      await assignmentsService.markAssignmentComplete(assignmentId, userId);
      console.log(JSON.stringify({
        event: 'assignment_completion_success',
        assignmentId,
        userId,
      }));
      toast({ 
        message: 'Assignment marked complete!', 
        variant: 'success', 
        durationMs: 2500 
      });
    } catch (err) {
      console.log(JSON.stringify({
        event: 'assignment_completion_error',
        assignmentId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      }));
      
      // Remove from marked set so user can retry
      markedAssignments.delete(assignmentId);
      
      const message = err instanceof Error ? err.message : 'Failed to mark assignment complete';
      toast({ 
        message, 
        variant: 'error', 
        durationMs: 3500 
      });
    }
  }

  function handleWatchedHalf(payload: { index: number }): void {
    // Check if we have an assignment ID for this index
    const assignmentId = assignmentIdsByIndex.value[payload.index];
    if (!assignmentId) {
      console.log(JSON.stringify({
        event: 'watched_half_no_assignment',
        index: payload.index,
        source: options.source(),
      }));
      return;
    }
    
    console.log(JSON.stringify({
      event: 'watched_half',
      index: payload.index,
      assignmentId,
      source: options.source(),
    }));
    
    void markAssignmentComplete(assignmentId);
  }

  // Moved from FeedView.loadFeed.
  async function loadFeed(): Promise<void> {
    const activeRequestId = ++requestId;
    const orgId = options.orgId();
    if (!orgId) return;

    loading.value = true;
    error.value = null;
    items.value = [];
    assignmentIdsByIndex.value = [];
    markedAssignments.clear();
    profileNameById.value = {};

    try {
      if (options.source() === 'segment') {
        const segmentId = options.segmentId();
        if (!segmentId) {
          if (activeRequestId === requestId) {
            error.value = 'Missing segment id.';
          }
          return;
        }

        const feedItem = await segmentService.getFeedItemForSegment(segmentId);
        if (activeRequestId !== requestId) return;
        if (!feedItem) {
          error.value = 'Segment not found.';
          return;
        }
        if (feedItem.asset.org_id !== orgId) {
          error.value = 'Segment is not available for this organization.';
          return;
        }

        const createdAt =
          feedItem.segment.created_at instanceof Date
            ? feedItem.segment.created_at
            : new Date(feedItem.segment.created_at);
        const title = feedItem.asset.title || feedItem.asset.file_name || 'Untitled clip';
        const metaLine = `${options.orgName() ?? 'Organization'} • Segment ${feedItem.segment.segment_index + 1} • ${createdAt.toLocaleDateString()}`;

        items.value = [
          {
            id: feedItem.segment.id,
            orgId,
            orgName: options.orgName(),
            mediaAssetId: feedItem.asset.id,
            bucket: feedItem.asset.bucket,
            mediaAssetSegmentId: feedItem.segment.id,
            segmentIndex: feedItem.segment.segment_index,
            startSeconds: feedItem.segment.start_seconds,
            endSeconds: feedItem.segment.end_seconds,
            title,
            metaLine,
            createdAt,
            segment: { ...feedItem.segment, tags: feedItem.segment.tags ?? [] },
          } satisfies FeedItem,
        ];

        // Check if this segment is part of any assignments for the current user
        const userId = options.userId();
        if (userId) {
          try {
            const userAssignmentIds = await assignmentsService.getAssignmentsForSegment(
              segmentId,
              userId,
              orgId
            );
            if (activeRequestId !== requestId) return;
            
            // If the segment is part of assignments, use the first one (newest)
            if (userAssignmentIds.length > 0) {
              assignmentIdsByIndex.value = [userAssignmentIds[0]];
              console.log(JSON.stringify({
                event: 'segment_assignment_context_loaded',
                segmentId,
                assignmentId: userAssignmentIds[0],
                totalAssignments: userAssignmentIds.length,
              }));
            } else {
              console.log(JSON.stringify({
                event: 'segment_no_assignment_context',
                segmentId,
              }));
            }
          } catch (err) {
            console.log(JSON.stringify({
              event: 'segment_assignment_context_error',
              segmentId,
              error: err instanceof Error ? err.message : String(err),
            }));
            // Non-fatal: continue without assignment context
          }
        }
        
        return;
      }

      if (options.source() === 'assignments') {
        const userId = options.userId();
        if (!userId) {
          if (activeRequestId === requestId) {
            error.value = 'Sign in to view assignments.';
          }
          return;
        }
        if (options.assignmentId()) {
          const feedRows = await assignmentsService.getAssignmentFeedById({
            orgId,
            assignmentId: options.assignmentId(),
          });

          if (activeRequestId !== requestId) return;
          assignmentIdsByIndex.value = feedRows.map(() => options.assignmentId());
          items.value = feedRows.map((entry) => toFeedItem(entry));
          return;
        }
        if (!options.assignmentMode()) {
          if (activeRequestId === requestId) {
            error.value = 'Missing assignment feed mode.';
          }
          return;
        }
        if (options.assignmentMode() === 'group' && !options.groupId()) {
          if (activeRequestId === requestId) {
            error.value = 'Missing group for assignment feed.';
          }
          return;
        }

        const feedRows = await assignmentsService.getAssignmentFeed({
          orgId,
          userId,
          mode: options.assignmentMode()!,
          groupId: options.assignmentMode() === 'group' ? options.groupId() : undefined,
          startAssignmentId: options.startAssignmentId() || undefined,
        });

        if (activeRequestId !== requestId) return;
        assignmentIdsByIndex.value = feedRows.map((entry) => entry.assignment.id);
        items.value = feedRows.map((entry) => toFeedItem(entry));
        return;
      }

      // const feedRows = await segmentService.listFeedItemsForOrg(orgId, { maxRows: 50 });
      const feedRows = await segmentService.getRandomFeedItemsForOrg(orgId);

      if (activeRequestId !== requestId) return;
      items.value = feedRows.map(({ asset, segment }) => {
        const createdAt = segment.created_at instanceof Date ? segment.created_at : new Date(segment.created_at);
        const title = asset.title || asset.file_name || 'Untitled clip';
        const metaLine = `${options.orgName() ?? 'Organization'} • Segment ${segment.segment_index + 1} • ${createdAt.toLocaleDateString()}`;

        return {
          id: segment.id,
          orgId,
          orgName: options.orgName(),
          mediaAssetId: asset.id,
          bucket: asset.bucket,
          mediaAssetSegmentId: segment.id,
          segmentIndex: segment.segment_index,
          startSeconds: segment.start_seconds,
          endSeconds: segment.end_seconds,
          title,
          metaLine,
          createdAt,
          segment: { ...segment, tags: segment.tags ?? [] },
        } satisfies FeedItem;
      });

      // Check if any of these segments are part of assignments for the current user
      const userId = options.userId();
      if (userId && feedRows.length > 0) {
        try {
          const segmentIds = feedRows.map(({ segment }) => segment.id);
          
          // Bulk query: find assignments for all segments
          const { data: assignmentSegments, error: asError } = await supabase
            .from('assignment_segments')
            .select('media_segment_id, assignment_id')
            .in('media_segment_id', segmentIds);

          if (asError) throw asError;

          if (assignmentSegments && assignmentSegments.length > 0) {
            const assignmentIds = Array.from(
              new Set(assignmentSegments.map((s: any) => String(s.assignment_id)).filter(Boolean))
            );

            // Check which assignments are relevant to this user
            const { data: targets, error: tError } = await supabase
              .from('assignment_targets')
              .select('assignment_id, target_type, target_id')
              .in('assignment_id', assignmentIds);

            if (tError) throw tError;

            // Get user's groups
            const { data: groupMembers, error: gmError } = await supabase
              .from('group_members')
              .select('group_id')
              .eq('profile_id', userId);

            if (gmError) throw gmError;

            const userGroupIds = new Set(
              (groupMembers ?? []).map((gm: any) => String(gm.group_id)).filter(Boolean)
            );

            // Build map of assignment IDs that are relevant to the user
            const userRelevantAssignments = new Set<string>();
            for (const t of (targets ?? []) as Array<{ assignment_id: string; target_type: string; target_id: string | null }>) {
              if (t.target_type === 'player' && t.target_id === userId) {
                userRelevantAssignments.add(t.assignment_id);
              } else if (t.target_type === 'team') {
                userRelevantAssignments.add(t.assignment_id);
              } else if (t.target_type === 'group' && t.target_id && userGroupIds.has(t.target_id)) {
                userRelevantAssignments.add(t.assignment_id);
              }
            }

            // Build map: segmentId -> assignmentId
            const segmentToAssignment = new Map<string, string>();
            for (const as of assignmentSegments as Array<{ media_segment_id: string; assignment_id: string }>) {
              const segId = String(as.media_segment_id);
              const assId = String(as.assignment_id);
              if (userRelevantAssignments.has(assId) && !segmentToAssignment.has(segId)) {
                segmentToAssignment.set(segId, assId);
              }
            }

            // Populate assignmentIdsByIndex for each feed item
            assignmentIdsByIndex.value = feedRows.map(({ segment }) => 
              segmentToAssignment.get(segment.id) ?? ''
            );

            const assignmentCount = assignmentIdsByIndex.value.filter(Boolean).length;
            if (assignmentCount > 0) {
              console.log(JSON.stringify({
                event: 'random_feed_assignment_context_loaded',
                totalSegments: feedRows.length,
                segmentsWithAssignments: assignmentCount,
              }));
            }
          }
        } catch (err) {
          console.log(JSON.stringify({
            event: 'random_feed_assignment_context_error',
            error: err instanceof Error ? err.message : String(err),
          }));
          // Non-fatal: continue without assignment context
        }
      }
    } catch (err) {
      if (activeRequestId !== requestId) return;
      error.value = err instanceof Error ? err.message : 'Failed to load feed.';
    } finally {
      if (activeRequestId === requestId) {
        loading.value = false;
      }
    }
  }

  watch(
    [
      () => options.orgId(),
      () => options.source(),
      () => options.assignmentMode(),
      () => options.groupId(),
      () => options.startAssignmentId(),
      () => options.assignmentId(),
      () => options.userId(),
    ],
    () => {
      void loadFeed();
    },
    { immediate: true }
  );

  return {
    items,
    loading,
    error,
    profileNameById,
    assignmentIdsByIndex,
    segmentTags,
    handleWatchedHalf,
    reload: loadFeed,
  };
}
