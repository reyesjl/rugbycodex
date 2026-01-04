<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Hls from 'hls.js';
import { storeToRefs } from 'pinia';
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

// eslint-disable-next-line no-undef
const videoEl = ref<HTMLVideoElement | null>(null);
let hls: Hls | null = null;

const playlistObjectUrl = ref<string | null>(null);

const title = computed(() => {
  if (asset.value?.title?.trim()) return asset.value.title;
  const fileName = asset.value?.file_name ?? '';
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled clip';
});

function destroyPlayer() {
  debugLog('destroyPlayer()', { hasHls: Boolean(hls), hasVideo: Boolean(videoEl.value) });
  if (hls) {
    hls.destroy();
    hls = null;
  }

  const video = videoEl.value;
  if (video) {
    video.removeAttribute('src');
    video.load();
  }
}

function revokePlaylistUrl() {
  const url = playlistObjectUrl.value;
  if (!url) return;
  URL.revokeObjectURL(url);
  playlistObjectUrl.value = null;
}

async function initPlayer() {
  destroyPlayer();

  const nextAsset = asset.value;
  if (!nextAsset) return;

  const url = playlistObjectUrl.value;
  const video = videoEl.value;
  debugLog('initPlayer()', {
    url,
    hasVideoEl: Boolean(video),
    canPlayNativeHls: video ? video.canPlayType('application/vnd.apple.mpegurl') : null,
    hlsJsSupported: Hls.isSupported(),
  });

  if (!url || !video) {
    error.value = 'Unable to load the stream for this clip.';
    debugLog('initPlayer(): aborting due to missing url or video element', { url, videoEl: video });
    return;
  }

  // Native HLS (Safari)
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    debugLog('initPlayer(): using native HLS');
    video.src = url;
    return;
  }

  // hls.js fallback
  if (Hls.isSupported()) {
    debugLog('initPlayer(): using hls.js');
    hls = new Hls({
      enableWorker: true,
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      debugLog('hls.js error event', data);
      if (data?.fatal) {
        error.value = 'Unable to play this clip right now.';
        destroyPlayer();
      }
    });

    hls.loadSource(url);
    hls.attachMedia(video);
    return;
  }

  error.value = 'HLS playback is not supported in this browser.';
}

async function loadAsset() {
  debugLog('loadAsset(): start', {
    mediaId: mediaId.value,
    activeOrgId: activeOrgId.value,
  });
  loading.value = true;
  error.value = null;
  asset.value = null;
  destroyPlayer();
  revokePlaylistUrl();

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

    try {
      playlistObjectUrl.value = await mediaService.getSignedHlsPlaylistObjectUrl(found.id);
    } catch (err) {
      if (err instanceof Error && 'cause' in err && err.cause) {
        debugLog('fetchPlaybackPlaylistObjectUrl(): function error', err.cause);
      }
      throw err;
    }

    // Ensure the template swaps from loading state before we attempt to resolve refs.
    loading.value = false;

    await nextTick();
    if (!videoEl.value) {
      await nextTick();
    }

    debugLog('loadAsset(): after nextTick', { hasVideoEl: Boolean(videoEl.value) });

    if (!videoEl.value) {
      error.value = 'Unable to load the stream for this clip.';
      debugLog('initPlayer(): aborting due to missing url or video element', {
        url: playlistObjectUrl.value,
        videoEl: videoEl.value,
      });
      return;
    }

    await initPlayer();
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

onBeforeUnmount(() => {
  destroyPlayer();
  revokePlaylistUrl();
});
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
        <video
          ref="videoEl"
          class="w-full h-auto"
          controls
          playsinline
        />
      </div>
    </div>
  </div>
</template>
