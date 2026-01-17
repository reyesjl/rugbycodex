<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { mediaService } from '@/modules/media/services/mediaService';
import ShakaPlayer from '@/modules/media/components/ShakaPlayer.vue';
import { formatHoursMinutes } from '@/lib/duration';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

const route = useRoute();
const router = useRouter();
const { orgContext } = storeToRefs(useActiveOrganizationStore());

const orgId = computed(() => orgContext.value?.organization?.id ?? null);
const mediaAssetId = computed(() => String(route.params.mediaAssetId ?? ''));

const loading = ref(false);
const manifestUrl = ref<string | null>(null);
const asset = ref<OrgMediaAsset | null>(null);
const error = ref<string | null>(null);

let activeFetchId = 0;

function normalizeClipTitle(raw?: string | null) {
  if (!raw) return 'Untitled clip';
  const lastSegment = raw.split('/').pop() ?? raw;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  const normalized = withoutExtension.replace(/[\-_]+/g, ' ').trim();
  return normalized || 'Untitled clip';
}

const clipTitle = computed(() => {
  if (!asset.value) return 'Untitled clip';
  if (asset.value.title && asset.value.title.trim()) return asset.value.title;
  return normalizeClipTitle(asset.value.file_name);
});

const assetDurationLabel = computed(() => formatHoursMinutes(asset.value?.duration_seconds ?? 0));

const goBack = () => router.back();

watch(
  [orgId, mediaAssetId],
  async ([nextOrgId, nextAssetId]) => {
    manifestUrl.value = null;
    asset.value = null;
    error.value = null;

    if (!nextOrgId) {
      error.value = 'Unable to resolve organization.';
      return;
    }

    if (!nextAssetId) {
      error.value = 'No media asset selected.';
      return;
    }

    const fetchId = ++activeFetchId;
    loading.value = true;

    try {
      const fetchedAsset = await mediaService.getById(nextOrgId, nextAssetId);
      if (fetchId !== activeFetchId) return;
      asset.value = fetchedAsset;

      const playlistUrl = await mediaService.getPresignedHlsPlaylistUrl(
        nextOrgId,
        nextAssetId,
        fetchedAsset.bucket
      );
      if (fetchId !== activeFetchId) return;
      manifestUrl.value = playlistUrl;
    } catch (err) {
      if (fetchId !== activeFetchId) return;
      error.value = err instanceof Error ? err.message : 'Unable to load video.';
    } finally {
      if (fetchId === activeFetchId) {
        loading.value = false;
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="container-lg space-y-6 py-6 text-white">
    <div class="flex items-center justify-between gap-4">
      <button
        type="button"
        class="rounded border border-white/20 px-3 py-1.5 text-xs uppercase tracking-wide text-white/70 transition hover:border-white/60 hover:text-white"
        @click="goBack"
      >
        Back
      </button>

      <div class="space-y-1 text-right">
        <p class="text-xs uppercase tracking-wider text-white/50">Duration {{ assetDurationLabel }}</p>
        <h1 class="text-2xl font-semibold">{{ clipTitle }}</h1>
      </div>
    </div>

    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/70">
      Loading video…
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-500/60 bg-red-500/10 p-6 text-sm text-red-200"
    >
      {{ error }}
    </div>

    <div v-else-if="manifestUrl" class="rounded-lg border border-white/10 bg-black">
      <ShakaPlayer :manifest-url="manifestUrl" />
    </div>

    <div
      v-else
      class="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/60"
    >
      Video metadata loaded but playback is not yet available.
    </div>
  </div>
</template>

<style scoped>
</style>
