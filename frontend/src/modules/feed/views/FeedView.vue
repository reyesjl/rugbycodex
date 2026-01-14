<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import FeedContainer from '@/modules/feed/components/FeedContainer.vue';
import type { FeedItem } from '@/modules/feed/types/FeedItem';
import { segmentService } from '@/modules/media/services/segmentService';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { assignmentsService, type AssignmentFeedEntry, type AssignmentFeedMode } from '@/modules/assignments/services/assignmentsService';

/**
 * Route-level view.
 *
 * Responsibility:
 * - Fetch feed items and pass them to FeedContainer.
 *
 * Non-goals:
 * - Navigation logic
 * - Media/narration business logic
 */

const route = useRoute();
const authStore = useAuthStore();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const activeOrgName = computed(() => orgContext.value?.organization?.name ?? null);
const userId = computed(() => authStore.user?.id ?? null);

const source = computed(() => String(route.query.source ?? ''));
const assignmentId = computed(() => String(route.query.assignmentId ?? ''));
const assignmentMode = computed<AssignmentFeedMode | null>(() => {
  const mode = String(route.query.mode ?? '');
  if (mode === 'assigned_to_you' || mode === 'assigned_to_team' || mode === 'group') {
    return mode;
  }
  return null;
});
const groupId = computed(() => String(route.query.groupId ?? ''));
const startAssignmentId = computed(() => String(route.query.startAssignmentId ?? ''));

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<FeedItem[]>([]);
const assignmentIdsByIndex = ref<string[]>([]);
const markedAssignments = new Set<string>();

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
    orgId: activeOrgId.value!,
    orgName: activeOrgName.value,
    mediaAssetId: entry.segment.media_asset_id,
    bucket: entry.asset.bucket,
    mediaAssetSegmentId: entry.segment.id,
    segmentIndex: entry.segment.segment_index,
    startSeconds: entry.segment.start_seconds,
    endSeconds: entry.segment.end_seconds,
    title,
    metaLine: assignmentMetaLine(entry, createdAt),
    createdAt,
  };
}

async function markAssignmentComplete(assignmentId: string) {
  if (!userId.value || markedAssignments.has(assignmentId)) return;
  markedAssignments.add(assignmentId);
  try {
    await assignmentsService.markAssignmentComplete(assignmentId, userId.value);
  } catch {
    // Silent tracking; playback should continue even if this fails.
  }
}

function handleWatchedHalf(payload: { index: number }) {
  if (source.value !== 'assignments') return;
  const assignmentId = assignmentIdsByIndex.value[payload.index];
  if (!assignmentId) return;
  void markAssignmentComplete(assignmentId);
}

async function loadFeed() {
  if (!activeOrgId.value) return;
  loading.value = true;
  error.value = null;
  items.value = [];
  assignmentIdsByIndex.value = [];
  markedAssignments.clear();

  try {
    if (source.value === 'assignments') {
      if (!userId.value) {
        error.value = 'Sign in to view assignments.';
        return;
      }
      if (assignmentId.value) {
        const feedRows = await assignmentsService.getAssignmentFeedById({
          orgId: activeOrgId.value,
          assignmentId: assignmentId.value,
        });

        assignmentIdsByIndex.value = feedRows.map(() => assignmentId.value);
        items.value = feedRows.map((entry) => toFeedItem(entry));
        return;
      }
      if (!assignmentMode.value) {
        error.value = 'Missing assignment feed mode.';
        return;
      }
      if (assignmentMode.value === 'group' && !groupId.value) {
        error.value = 'Missing group for assignment feed.';
        return;
      }

      const feedRows = await assignmentsService.getAssignmentFeed({
        orgId: activeOrgId.value,
        userId: userId.value,
        mode: assignmentMode.value,
        groupId: assignmentMode.value === 'group' ? groupId.value : undefined,
        startAssignmentId: startAssignmentId.value || undefined,
      });

      assignmentIdsByIndex.value = feedRows.map((entry) => entry.assignment.id);
      items.value = feedRows.map((entry) => toFeedItem(entry));
      return;
    }

    // const feedRows = await segmentService.listFeedItemsForOrg(activeOrgId.value, { maxRows: 50 });
    const feedRows = await segmentService.getRandomFeedItemsForOrg(activeOrgId.value);

    items.value = feedRows.map(({ asset, segment }) => {
      const createdAt = segment.created_at instanceof Date ? segment.created_at : new Date(segment.created_at);
      const title = asset.title || asset.file_name || 'Untitled clip';
      const metaLine = `${activeOrgName.value ?? 'Organization'} • Segment ${segment.segment_index + 1} • ${createdAt.toLocaleDateString()}`;

      return {
        id: segment.id,
        orgId: activeOrgId.value!,
        orgName: activeOrgName.value,
        mediaAssetId: asset.id,
        bucket: asset.bucket,
        mediaAssetSegmentId: segment.id,
        segmentIndex: segment.segment_index,
        startSeconds: segment.start_seconds,
        endSeconds: segment.end_seconds,
        title,
        metaLine,
        createdAt,
      } satisfies FeedItem;
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load feed.';
  } finally {
    loading.value = false;
  }
}

watch([activeOrgId, source, assignmentMode, groupId, startAssignmentId, assignmentId, userId], () => {
  void loadFeed();
}, { immediate: true });
</script>

<template>
  <!--
    Feed should consume the remaining viewport height below the fixed MainNav.
    AppLayout offsets content with padding-top: var(--main-nav-height), so we
    subtract the same value here to avoid creating a second (page-level) scroll.
  -->
  <div
    class="w-full bg-black
           h-[calc(100dvh-var(--main-nav-height))] overflow-hidden
           md:h-auto md:overflow-visible md:min-h-[calc(100dvh-var(--main-nav-height))]"
  >
    <div v-if="!activeOrgId" class="h-full w-full flex items-center justify-center text-white/60">
      Select an organization to view the feed.
    </div>

    <div v-else-if="loading" class="h-full w-full flex items-center justify-center text-white/60">
      Loading feed…
    </div>

    <div v-else-if="error" class="h-full w-full flex items-center justify-center px-6 text-red-200">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="h-full w-full flex items-center justify-center text-white/60">
      No clips yet.
    </div>

    <FeedContainer v-else :items="items" @watchedHalf="handleWatchedHalf" />
  </div>
</template>
