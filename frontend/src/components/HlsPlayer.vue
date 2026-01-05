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

type VideoElement = InstanceType<typeof globalThis.HTMLVideoElement>;

const videoEl = ref<VideoElement | null>(null);
let hls: Hls | null = null;
let refreshVersion = 0;
let lastGestureAt = 0;

const isIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/i.test(ua);
  const iPadOS13Plus = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return iOSDevice || iPadOS13Plus;
})();

function isTruthyAttr(value: unknown): boolean {
  // Vue may pass boolean attrs as "" or true.
  return value === '' || value === true || value === 'true';
}

function getAutoplayRequested(): boolean {
  const anyAttrs = attrs as Record<string, unknown>;
  return isTruthyAttr(anyAttrs.autoplay) || isTruthyAttr(anyAttrs.autoPlay);
}

function configureVideoElement(video: VideoElement) {
  // Requirements: must be present at render time (template enforces), but also
  // enforce runtime properties for iOS/WebKit edge cases.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'metadata';

  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('preload', 'metadata');
}

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
    // Keep the element interactable; only reset media bindings.
    video.removeAttribute('src');
    video.load();
  }
}

function attemptAutoplayIfAllowed(video: VideoElement) {
  // Do not rely on programmatic .play() until after a user gesture on iOS.
  if (isIOS) return;
  if (!getAutoplayRequested()) return;

  // Requirement: autoplay only if muted (+ playsinline is already enforced).
  if (!video.muted) return;

  const playResult = video.play();
  if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
    (playResult as Promise<void>).catch((err) => {
      debugLog('autoplay blocked', err);
      // Graceful fallback: user can tap the video to start playback.
    });
  }
}

async function initPlayerWithoutDestroy(version: number) {
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

  configureVideoElement(video);

  // Native HLS (Safari)
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    debugLog('initPlayer(): using native HLS');
    video.src = url;
    video.load();

    // Ensure src is attached before any autoplay attempt.
    const onLoadedMetadata = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (version !== refreshVersion) return;
      attemptAutoplayIfAllowed(video);
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
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

    // Ensure the <video> exists and is configured before attaching HLS.
    hls.attachMedia(video);
    hls.loadSource(url);

    // Only attempt autoplay after the source is attached and parsed.
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      if (version !== refreshVersion) return;
      attemptAutoplayIfAllowed(video);
    });
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
  refreshVersion += 1;
  const version = refreshVersion;

  destroyPlayer();

  await nextTick();
  if (!videoEl.value) {
    await nextTick();
  }

  debugLog('loadAsset(): after nextTick', { hasVideoEl: Boolean(videoEl.value) });

  if (version !== refreshVersion) return;

  await initPlayerWithoutDestroy(version);
}

function onUserGesture() {
  const now = Date.now();
  // Guard against duplicate pointer/click events.
  if (now - lastGestureAt < 250) return;
  lastGestureAt = now;

  const video = videoEl.value;
  if (!video) return;

  configureVideoElement(video);

  // If a user taps quickly during async init, ensure we at least bind the native src.
  // (We must not await here; iOS requires play() to be called synchronously in the gesture handler.)
  if (!hls && !video.getAttribute('src') && props.src && video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = props.src;
  }

  // Requirement: ensure a source is attached before attempting playback.
  // If init is still in-flight, kick a refresh and let the user tap again.
  if (!hls && !video.getAttribute('src')) {
    void refreshPlayer();
    return;
  }

  // If playback is already in progress, no-op.
  if (!video.paused) return;

  const playResult = video.play();
  if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
    (playResult as Promise<void>).catch((err) => {
      debugLog('user-gesture play blocked', err);
      // Leave the element in a tap-to-play state.
    });
  }
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
  <video
    ref="videoEl"
    v-bind="attrs"
    muted
    playsinline
    webkit-playsinline
    preload="metadata"
    @pointerup="onUserGesture"
    @click="onUserGesture"
  />
</template>
