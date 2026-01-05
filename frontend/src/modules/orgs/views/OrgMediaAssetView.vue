<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import HlsPlayer from '@/components/HlsPlayer.vue';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { mediaService } from '@/modules/media/services/mediaService';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

const DEBUG = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  console.debug('[OrgMediaAssetView]', ...args);
}

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const { active } = storeToRefs(activeOrgStore);

const mediaId = computed(() => String(route.params.mediaId ?? ''));
const activeOrgId = computed(() => active.value?.organization?.id ?? null);

const loading = ref(true);
const error = ref<string | null>(null);
const asset = ref<OrgMediaAsset | null>(null);

const playlistObjectUrl = ref<string | null>(null);

const title = computed(() => {
  if (asset.value?.title?.trim()) return asset.value.title;
  const fileName = asset.value?.file_name ?? '';
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled clip';
});

function handlePlayerError(message: string) {
  error.value = message;
}

async function loadAsset() {
  debugLog('loadAsset(): start', {
    mediaId: mediaId.value,
    activeOrgId: activeOrgId.value,
  });
  loading.value = true;
  error.value = null;
  asset.value = null;
  playlistObjectUrl.value = null;

  try {
    if (!mediaId.value) {
      throw new Error('Missing media id.');
    }

    if (!activeOrgId.value) {
      // Org context is resolved by the router guard; wait until it's available.
      return;
    }

    const found = await mediaService.getById(activeOrgId.value, mediaId.value);
    asset.value = found;

    debugLog('loadAsset(): fetched asset', {
      id: found.id,
      bucket: found.bucket,
      storage_path: found.storage_path,
      base_org_storage_path: found.base_org_storage_path,
      hls_url: found.hls_url,
      status: found.status,
    });

    playlistObjectUrl.value = await mediaService.getPublicHlsPlaylistUrl(
      activeOrgId.value,
      found.id,
      found.bucket
    );

    // Ensure the template swaps from loading state before playback init runs in the player.
    loading.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load clip.';
    debugLog('loadAsset(): error', err);
  } finally {
    loading.value = false;
    debugLog('loadAsset(): done', { loading: loading.value, error: error.value });
  }
}

watch([mediaId, activeOrgId], () => {
  if (!mediaId.value) return;
  if (!activeOrgId.value) return;
  void loadAsset();
}, { immediate: true });
</script>

<template>
  <div class="container space-y-4 py-6 text-white pb-20">
    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading clip…
    </div>

    <div v-else-if="error" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      {{ error }}
    </div>

    <div v-else-if="asset" class="space-y-4">
      <header class="space-y-1">
        <h1 class="text-white text-2xl font-semibold">{{ title }}</h1>
        <div class="text-xs font-medium capitalize tracking-wide text-white/50">
          {{ asset.kind }}
        </div>
      </header>

      <div class="overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
        <HlsPlayer
          :src="playlistObjectUrl ?? ''"
          class="w-full h-auto"
          controls
          playsinline
          @error="handlePlayerError"
        />
      </div>
    </div>
  </div>
</template>
