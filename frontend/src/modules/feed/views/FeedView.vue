<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import FeedContainer from '@/modules/feed/components/FeedContainer.vue';
import type { FeedItem } from '@/modules/feed/types/FeedItem';
import { segmentService } from '@/modules/media/services/segmentService';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';

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

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const activeOrgName = computed(() => orgContext.value?.organization?.name ?? null);

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<FeedItem[]>([]);

async function loadFeed() {
  if (!activeOrgId.value) return;
  loading.value = true;
  error.value = null;

  try {
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

watch(activeOrgId, () => {
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

    <FeedContainer v-else :items="items" />
  </div>
</template>
