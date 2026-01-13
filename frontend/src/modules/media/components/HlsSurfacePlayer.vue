<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import HlsPlayer from '@/components/HlsPlayer.vue';

/**
 * Surface-only HLS player.
 *
 * Responsibilities:
 * - Render video only (no native controls)
 * - Expose imperative playback APIs for external overlay UI
 *
 * Non-goals:
 * - Gesture handling (handled by FeedGestureLayer)
 * - Business logic (feed/narration handled elsewhere)
 */

const props = withDefaults(
  defineProps<{
    src: string;
    autoplay?: boolean;
  }>(),
  {
    autoplay: false,
  }
);

const emit = defineEmits<{
  (e: 'error', message: string): void;
  (e: 'timeupdate', payload: { currentTime: number; duration: number }): void;
  (e: 'play'): void;
  (e: 'pause'): void;
  (e: 'loadedmetadata', payload: { duration: number }): void;
  (e: 'buffering', isBuffering: boolean): void;
}>();

const playerRef = ref<InstanceType<typeof HlsPlayer> | null>(null);

const videoEl = computed(() => playerRef.value?.getVideoElement() ?? null);

const isBuffering = ref(false);

let bufferingTimer: number | null = null;
let lastTimeUpdateSeconds = 0;

function cancelBufferingTimer() {
  if (bufferingTimer === null) return;
  window.clearTimeout(bufferingTimer);
  bufferingTimer = null;
}

function setBuffering(next: boolean) {
  if (isBuffering.value === next) return;
  isBuffering.value = next;
  emit('buffering', next);
}

function requestBuffering() {
  // Some browsers fire transient `waiting`/`stalled` even while playback
  // continues smoothly. Debounce so we only show buffering if it persists.
  if (bufferingTimer !== null) return;
  bufferingTimer = window.setTimeout(() => {
    bufferingTimer = null;
    const video = videoEl.value;
    if (!video) return;
    if (video.paused || video.ended) return;
    // HAVE_FUTURE_DATA (3) means enough buffered to keep playing.
    if ((video.readyState ?? 0) >= 3) return;
    setBuffering(true);
  }, 200);
}

let pendingSeekSeconds: number | null = null;

function safePlay(video: HTMLVideoElement) {
  // Avoid "Uncaught (in promise) NotSupportedError" spam.
  const p = video.play();
  if (p && typeof (p as Promise<void>).catch === 'function') {
    (p as Promise<void>).catch(() => {
      // If playback is not possible yet (src not ready / iOS gesture requirement), let the overlay handle it.
    });
  }
}

function play(): void {
  const video = videoEl.value;
  if (!video) return;
  // If the element has no source yet, do not attempt to play.
  const hasSrc = Boolean(video.currentSrc || video.src);
  if (!hasSrc) return;
  safePlay(video);
}

function pause(): void {
  const video = videoEl.value;
  if (!video) return;
  video.pause();
}

function togglePlayback(): void {
  const video = videoEl.value;
  if (!video) return;
  if (video.paused) {
    const hasSrc = Boolean(video.currentSrc || video.src);
    if (!hasSrc) return;
    safePlay(video);
  } else {
    video.pause();
  }
}

function getCurrentTime(): number {
  return videoEl.value?.currentTime ?? 0;
}

function getDuration(): number {
  return videoEl.value?.duration ?? 0;
}

function setCurrentTime(seconds: number): void {
  const video = videoEl.value;
  if (!video) return;
  const clamped = Math.max(0, seconds);

  // If metadata isn't loaded yet, queue the seek until we have duration/timebase.
  if (video.readyState < 1) {
    pendingSeekSeconds = clamped;
    return;
  }

  video.currentTime = clamped;
}

function onTimeUpdate() {
  const video = videoEl.value;
  if (!video) return;
  // If time is still advancing, we are not buffering.
  if (isBuffering.value) {
    const t = video.currentTime || 0;
    if (t > lastTimeUpdateSeconds + 0.02) {
      cancelBufferingTimer();
      setBuffering(false);
    }
  }
  lastTimeUpdateSeconds = video.currentTime || 0;
  emit('timeupdate', { currentTime: video.currentTime || 0, duration: video.duration || 0 });
}

function onLoadedMetadata() {
  const video = videoEl.value;
  if (!video) return;

  if (pendingSeekSeconds !== null) {
    const seek = pendingSeekSeconds;
    pendingSeekSeconds = null;
    try {
      video.currentTime = Math.max(0, seek);
    } catch {
      // ignore
    }
  }

  emit('loadedmetadata', { duration: video.duration || 0 });
}

function onPlay() {
  emit('play');
}

function onPause() {
  emit('pause');
  cancelBufferingTimer();
  setBuffering(false);
}

function onWaiting() {
  // `waiting` fires when playback has stopped because data is not available.
  // Show a simple spinner overlay so the user understands what's happening.
  requestBuffering();
}

function onStalled() {
  // Network stall; show buffering until we can play again.
  requestBuffering();
}

function onSeeking() {
  // Seeking often causes a brief rebuffer; treat it as buffering.
  requestBuffering();
}

function onCanPlay() {
  // Enough data to play.
  cancelBufferingTimer();
  setBuffering(false);
}

function onPlaying() {
  cancelBufferingTimer();
  setBuffering(false);
}

function onEnded() {
  cancelBufferingTimer();
  setBuffering(false);
}

function bindVideoListeners(video: HTMLVideoElement | null, previous: HTMLVideoElement | null) {
  if (previous) {
    previous.removeEventListener('timeupdate', onTimeUpdate);
    previous.removeEventListener('loadedmetadata', onLoadedMetadata);
    previous.removeEventListener('play', onPlay);
    previous.removeEventListener('pause', onPause);
    previous.removeEventListener('waiting', onWaiting);
    previous.removeEventListener('stalled', onStalled);
    previous.removeEventListener('seeking', onSeeking);
    previous.removeEventListener('canplay', onCanPlay);
    previous.removeEventListener('playing', onPlaying);
    previous.removeEventListener('ended', onEnded);
  }

  if (!video) return;
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('stalled', onStalled);
  video.addEventListener('seeking', onSeeking);
  video.addEventListener('canplay', onCanPlay);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('ended', onEnded);
}

watch(videoEl, (video, prev) => {
  bindVideoListeners(video ?? null, prev ?? null);
}, { immediate: true });

watch(
  () => props.autoplay,
  (autoplay) => {
    if (!autoplay) return;
    // Best-effort; iOS may require a user gesture.
    play();
  }
);

watch(
  () => props.src,
  () => {
    pendingSeekSeconds = null;
    cancelBufferingTimer();
    lastTimeUpdateSeconds = 0;
    setBuffering(false);
  }
);

onBeforeUnmount(() => {
  cancelBufferingTimer();
  bindVideoListeners(null, videoEl.value);
});

defineExpose({
  play,
  pause,
  togglePlayback,
  getCurrentTime,
  getDuration,
  setCurrentTime,
  getVideoElement: () => videoEl.value,
});
</script>

<template>
  <HlsPlayer
    ref="playerRef"
    :src="src"
    :controls="false"
    playsinline
    webkit-playsinline
    preload="metadata"
    class="h-full w-full"
    @error="(m) => emit('error', m)"
  />
</template>
