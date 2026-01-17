<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ShakaPlayer from '@/modules/media/components/ShakaPlayer.vue';

const props = withDefaults(
  defineProps<{
    manifestUrl: string;
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

const playerRef = ref<InstanceType<typeof ShakaPlayer> | null>(null);
const videoEl = computed(() => playerRef.value?.getVideoElement?.() ?? null);

const isBuffering = ref(false);
let bufferingTimer: number | null = null;
let lastTimeUpdateSeconds = 0;
let pendingSeekSeconds: number | null = null;

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
  if (bufferingTimer !== null) return;
  bufferingTimer = window.setTimeout(() => {
    bufferingTimer = null;
    const video = videoEl.value;
    if (!video) return;
    if (video.paused || video.ended) return;
    if ((video.readyState ?? 0) >= 3) return;
    setBuffering(true);
  }, 200);
}

function safePlay(video: HTMLVideoElement) {
  const p = video.play();
  if (p && typeof (p as Promise<void>).catch === 'function') {
    (p as Promise<void>).catch(() => {
      // allow overlay to handle user gesture requirement
    });
  }
}

function play(): void {
  const video = videoEl.value;
  if (!video) return;
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
  if (video.readyState < 1) {
    pendingSeekSeconds = clamped;
    return;
  }
  video.currentTime = clamped;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getVolume01(): number {
  const video = videoEl.value;
  return video?.volume ?? 1;
}

function setVolume01(volume: number): void {
  const video = videoEl.value;
  if (!video) return;
  try {
    video.volume = clamp(volume, 0, 1);
  } catch {
    // ignore
  }
}

function getMuted(): boolean {
  const video = videoEl.value;
  return video?.muted ?? false;
}

function setMuted(muted: boolean): void {
  const video = videoEl.value;
  if (!video) return;
  try {
    video.muted = Boolean(muted);
  } catch {
    // ignore
  }
}

function onTimeUpdate() {
  const video = videoEl.value;
  if (!video) return;
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
  requestBuffering();
}

function onStalled() {
  requestBuffering();
}

function onSeeking() {
  requestBuffering();
}

function onCanPlay() {
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

watch(
  videoEl,
  (video, prev) => {
    bindVideoListeners(video ?? null, prev ?? null);
  },
  { immediate: true }
);

watch(
  () => props.autoplay,
  (autoplay) => {
    if (!autoplay) return;
    play();
  }
);

watch(
  () => props.manifestUrl,
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
  getVolume01,
  setVolume01,
  getMuted,
  setMuted,
  getVideoElement: () => videoEl.value,
});
</script>

<template>
  <ShakaPlayer
    ref="playerRef"
    :manifest-url="manifestUrl"
    class="h-full w-full"
    @error="(message) => emit('error', message)"
  />
</template>
