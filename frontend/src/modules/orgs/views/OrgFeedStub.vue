<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { segmentService, type OrgSegmentFeedItem } from '@/modules/media/services/segmentService';
import { CDN_BASE } from '@/lib/cdn';
import { formatMinutesSeconds } from '@/lib/duration';

const activeOrgStore = useActiveOrganizationStore();
const { orgContext, resolving: orgResolving } = storeToRefs(activeOrgStore);

const route = useRoute();
const router = useRouter();

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const slug = computed(() => String(route.params.slug ?? ''));

const loading = ref(true);
const error = ref<string | null>(null);
const items = ref<OrgSegmentFeedItem[]>([]);

function clipTitle(fileName: string) {
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled clip';
}

function assetTitle(item: OrgSegmentFeedItem) {
  const t = item.asset.title?.trim();
  if (t) return t;
  return clipTitle(item.asset.file_name);
}

function thumbnailUrl(item: OrgSegmentFeedItem) {
  if (!item.asset.thumbnail_path) return null;
  return `${CDN_BASE}/${item.asset.thumbnail_path}`;
}

function openSegment(segmentId: string) {
  if (!slug.value) return;
  void router.push({
    name: 'MediaAssetSegment',
    params: {
      slug: slug.value,
      segmentId,
    },
  });
}

async function loadFeed() {
  error.value = null;
  items.value = [];

  if (!activeOrgId.value) {
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    items.value = await segmentService.getRandomFeedItemsForOrg(activeOrgId.value, 3);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load feed.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadFeed();
});

watch(activeOrgId, () => {
  void loadFeed();
});
</script>

<template>
  <div class="container-lg space-y-4 py-6 text-white pb-20">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-white text-3xl">Feed</h1>
      <button
        type="button"
        class="flex gap-2 items-center rounded-lg px-2 py-1 border border-white/20 bg-white/10 hover:bg-white/20 text-xs transition"
        :disabled="loading || orgResolving"
        @click="loadFeed"
        title="Refresh"
      >
        <Icon icon="carbon:renew" width="15" height="15" />
        Refresh
      </button>
    </div>

    <div v-if="orgResolving" class="rounded-lg bg-white/5 ring-1 ring-white/10 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!orgContext" class="rounded-lg bg-white/5 ring-1 ring-white/10 p-6 text-white/70">
      No active organization.
    </div>

    <div v-else-if="loading" class="rounded-lg bg-white/5 ring-1 ring-white/10 p-6 text-white/70">
      Loading segments…
    </div>

    <div v-else-if="error" class="rounded-lg bg-white/5 ring-1 ring-white/10 p-6 text-white/70">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="rounded-lg bg-white/5 ring-1 ring-white/10 p-6 text-white/70">
      No segments available yet.
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="item in items"
        :key="item.segment.id"
        class="group overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/20 hover:cursor-pointer"
        @click="openSegment(String(item.segment.id))"
      >
        <div class="p-4 flex gap-4">
          <div class="w-32 shrink-0">
            <div class="relative overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
              <div class="relative w-full pb-[56.25%]">
                <img
                  v-if="thumbnailUrl(item)"
                  class="absolute inset-0 h-full w-full object-cover"
                  :src="thumbnailUrl(item)!"
                  :alt="assetTitle(item)"
                  loading="lazy"
                />
                <div v-else class="absolute inset-0 flex items-center justify-center">
                  <Icon icon="carbon:video" class="h-8 w-8 text-white/30" />
                </div>
              </div>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-white truncate">
              {{ assetTitle(item) }}
            </div>
            <div class="mt-1 text-xs font-medium tracking-wide text-white/50">
              Segment {{ item.segment.segment_index + 1 }} ·
              {{ formatMinutesSeconds(item.segment.start_seconds) }} -
              {{ formatMinutesSeconds(item.segment.end_seconds) }}
            </div>

            <div class="mt-3 flex items-center justify-between gap-3">
              <div class="text-xs text-white/40 truncate">
                {{ item.asset.file_name }}
              </div>
              <button
                type="button"
                class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 hover:cursor-pointer text-xs transition"
                @click.stop="openSegment(String(item.segment.id))"
              >
                <Icon icon="carbon:review" width="15" height="15" />
                Review
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
