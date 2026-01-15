import { computed, ref, watch } from 'vue';
import { assignmentsService, type AssignmentFeedEntry, type AssignmentFeedMode } from '@/modules/assignments/services/assignmentsService';
import type { FeedItem } from '@/modules/feed/types/FeedItem';
import { segmentService } from '@/modules/media/services/segmentService';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';
import { useSegmentTags } from '@/modules/media/composables/useSegmentTags';
import { supabase } from '@/lib/supabaseClient';

type FeedDataOptions = {
  orgId: () => string | null;
  orgName: () => string | null;
  userId: () => string | null;
  source: () => string;
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
    if (!userId || markedAssignments.has(assignmentId)) return;
    markedAssignments.add(assignmentId);
    try {
      await assignmentsService.markAssignmentComplete(assignmentId, userId);
    } catch {
      // Silent tracking; playback should continue even if this fails.
    }
  }

  function handleWatchedHalf(payload: { index: number }): void {
    if (options.source() !== 'assignments') return;
    const assignmentId = assignmentIdsByIndex.value[payload.index];
    if (!assignmentId) return;
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
