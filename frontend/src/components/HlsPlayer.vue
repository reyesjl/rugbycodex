<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useAttrs, watch } from 'vue';
import Hls from 'hls.js';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  src: string;
}>();

const emit = defineEmits<{
  (e: 'error', message: string): void;
}>();

const attrs = useAttrs();

const DEBUG = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  // Preserve existing log prefix/messages from OrgMediaAssetView playback logic.
  console.debug('[OrgMediaAssetView]', ...args);
}

const videoEl = ref<HTMLVideoElement | null>(null);
let hls: Hls | null = null;

function emitError(message: string) {
  emit('error', message);
}

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

async function initPlayerWithoutDestroy() {
  const url = props.src;
  const video = videoEl.value;

  debugLog('initPlayer()', {
    url,
    hasVideoEl: Boolean(video),
    canPlayNativeHls: video ? video.canPlayType('application/vnd.apple.mpegurl') : null,
    hlsJsSupported: Hls.isSupported(),
  });

  if (!url || !video) {
    emitError('Unable to load the stream for this clip.');
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
        emitError('Unable to play this clip right now.');
        destroyPlayer();
      }
    });

    hls.loadSource(url);
    hls.attachMedia(video);
    return;
  }

  emitError('HLS playback is not supported in this browser.');
}

async function refreshPlayer() {
  // Mirror the previous view logic ordering:
  // - tear down any existing player
  // - wait for DOM refs
  // - log "after nextTick"
  // - init the player
  destroyPlayer();

  await nextTick();
  if (!videoEl.value) {
    await nextTick();
  }

  debugLog('loadAsset(): after nextTick', { hasVideoEl: Boolean(videoEl.value) });

  await initPlayerWithoutDestroy();
}

watch(
  () => props.src,
  () => {
    void refreshPlayer();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  destroyPlayer();
});
</script>

<template>
  <video ref="videoEl" v-bind="attrs" />
</template>
