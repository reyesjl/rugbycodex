<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { FeedItem as FeedItemType } from '@/modules/feed/types/FeedItem';
import HlsSurfacePlayer from '@/modules/media/components/HlsSurfacePlayer.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import FeedMeta from '@/modules/feed/components/FeedMeta.vue';
import FeedActionBar from '@/modules/feed/components/FeedActionBar.vue';
import NarrationPanel from '@/modules/narration/components/NarrationPanel.vue';
import NarrationRecorder from '@/modules/narration/components/NarrationRecorder.vue';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { useNarrationRecorder, type NarrationListItem } from '@/modules/narration/composables/useNarrationRecorder';
import { useAuthStore } from '@/auth/stores/useAuthStore';

const props = defineProps<{
  feedItem: FeedItemType;
  isActive: boolean;
  src: string;
  srcError?: string | null;
  canPrev: boolean;
  canNext: boolean;
}>();

const emit = defineEmits<{
  (e: 'next'): void;
  (e: 'prev'): void;
}>();

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id ?? null);

const playerRef = ref<InstanceType<typeof HlsSurfacePlayer> | null>(null);
const surfaceEl = ref<HTMLElement | null>(null);

const isFullscreen = ref(false);
const canFullscreen = computed(() => {
  const el = surfaceEl.value as any;
  const doc = document as any;
  if (!el) return false;
  return Boolean(
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen ||
    doc.fullscreenEnabled ||
    doc.webkitFullscreenEnabled
  );
});

function getFullscreenElement(): Element | null {
  const doc = document as any;
  return (document.fullscreenElement ?? doc.webkitFullscreenElement ?? null) as Element | null;
}

function syncFullscreenState() {
  const active = getFullscreenElement();
  isFullscreen.value = Boolean(active && surfaceEl.value && active === surfaceEl.value);
}

async function toggleFullscreen() {
  const el = surfaceEl.value as any;
  const doc = document as any;
  if (!el) return;

  try {
    if (getFullscreenElement()) {
      await Promise.resolve((document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.()) as any);
      return;
    }
    // Request fullscreen on the container so overlays remain visible.
    await Promise.resolve((el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.() ?? el.msRequestFullscreen?.()) as any);
  } catch {
    // Silent in feed; lack of fullscreen support isn't fatal.
  }
}

const isBuffering = ref(false);
const suppressBufferingUntilMs = ref(0);
const suppressOverlayRevealUntilMs = ref(0);

// Overlay visibility (YouTube-style: tap to show, auto-hide)
const overlayVisible = ref(false);
let overlayTimer: number | null = null;
function showOverlay(durationMs: number | null = 2500) {
  overlayVisible.value = true;
  if (overlayTimer !== null) window.clearTimeout(overlayTimer);
  if (durationMs === null) return;
  overlayTimer = window.setTimeout(() => {
    overlayVisible.value = false;
    overlayTimer = null;
  }, durationMs);
}

function hideOverlay() {
  overlayVisible.value = false;
  if (overlayTimer !== null) {
    window.clearTimeout(overlayTimer);
    overlayTimer = null;
  }
}

function isMousePointer(e: PointerEvent): boolean {
  return e.pointerType === 'mouse';
}

function onHoverMove(e: PointerEvent) {
  if (!isMousePointer(e)) return;
  if (isBuffering.value) return;
  if (Date.now() < suppressOverlayRevealUntilMs.value) return;
  // Any movement over the surface should reveal controls.
  showOverlay(null);
}

function onHoverLeave(e: PointerEvent) {
  if (!isMousePointer(e)) return;
  if (isBuffering.value) return;
  // When no longer hovering, auto-hide quickly.
  showOverlay(800);
}

function onNarrationButtonHoverEnter(e: PointerEvent) {
  if (!isMousePointer(e)) return;
  hideOverlay();
}

onBeforeUnmount(() => {
  hideOverlay();
  if (flashTimer !== null) {
    window.clearTimeout(flashTimer);
    flashTimer = null;
  }
  document.removeEventListener('fullscreenchange', syncFullscreenState);
  document.removeEventListener('webkitfullscreenchange' as any, syncFullscreenState);
});

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange' as any, syncFullscreenState);
  syncFullscreenState();
});

// Playback state for overlay
const isPlaying = ref(false);
const flashIcon = ref<'play' | 'pause' | null>(null);
let flashTimer: number | null = null;

function flashPlayPause(kind: 'play' | 'pause') {
  flashIcon.value = kind;
  if (flashTimer !== null) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flashIcon.value = null;
    flashTimer = null;
  }, 350);
}
const currentTime = ref(0);
const duration = ref(0);
const hasSeekedToStart = ref(false);
const endedWithinSegment = ref(false);
const suppressEndClampUntilMs = ref(0);

// Volume (YouTube-style)
const volume01 = ref(1);
const muted = ref(false);
const volumeBeforeMute01 = ref(0.7);

function applyVolumeToPlayer() {
  playerRef.value?.setMuted?.(muted.value);
  playerRef.value?.setVolume01?.(volume01.value);
}

function toggleMute() {
  if (muted.value || volume01.value <= 0) {
    muted.value = false;
    if (volume01.value <= 0) volume01.value = volumeBeforeMute01.value || 0.7;
  } else {
    if (volume01.value > 0) volumeBeforeMute01.value = volume01.value;
    muted.value = true;
  }
  applyVolumeToPlayer();
}

function setVolume(next: number) {
  const v = Math.max(0, Math.min(1, next));
  volume01.value = v;
  muted.value = v <= 0;
  applyVolumeToPlayer();
}

const END_EPSILON_SECONDS = 0.05;

const segmentStart = computed(() => Math.max(0, props.feedItem.startSeconds ?? 0));
const segmentEnd = computed(() => Math.max(0, props.feedItem.endSeconds ?? 0));
const segmentLength = computed(() => {
  const start = segmentStart.value;
  const end = segmentEnd.value;
  if (end > start) return end - start;
  // Fallback: if segment bounds missing, fall back to full duration.
  return Math.max(0, duration.value - start);
});

const progress01 = computed(() => {
  const len = segmentLength.value;
  if (!len) return 0;

  const start = segmentStart.value;
  const end = segmentEnd.value;

  const effectiveEnd = end > start ? end : start + len;
  const t = Math.min(effectiveEnd, Math.max(start, currentTime.value));
  return Math.min(1, Math.max(0, (t - start) / len));
});

const segmentCurrentSeconds = computed(() => {
  return Math.max(0, (currentTime.value ?? 0) - segmentStart.value);
});

function togglePlay() {
  // UX: when the user presses Play, dismiss controls immediately.
  // When pausing, keep controls visible so they can act.
  const video = playerRef.value?.getVideoElement?.() ?? null;
  const willPlay = video ? video.paused : !isPlaying.value;
  if (willPlay) {
    hideOverlay();
    // After pressing play, ignore mouse-move reveal for a moment.
    suppressOverlayRevealUntilMs.value = Date.now() + 600;
  }
  else showOverlay(null);
  if (!props.src) return;
  if (endedWithinSegment.value) {
    // Replay segment.
    endedWithinSegment.value = false;
    suppressEndClampUntilMs.value = Date.now() + 1000;
    const target = segmentStart.value;
    playerRef.value?.setCurrentTime(target);
    playAfterSeek(target);
    return;
  }
  playerRef.value?.togglePlayback();
}

function playAfterSeek(targetSeconds: number) {
  const video = playerRef.value?.getVideoElement?.() ?? null;
  if (!video) {
    playerRef.value?.play();
    return;
  }

  let done = false;
  let timer: number | null = null;

  const cleanup = () => {
    if (done) return;
    done = true;
    video.removeEventListener('seeked', onSeeked);
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };

  const onSeeked = () => {
    // Extra guard: don't wait for perfect equality; just ensure we're near the target.
    const dt = Math.abs((video.currentTime ?? 0) - targetSeconds);
    cleanup();
    if (dt <= 0.5) {
      playerRef.value?.play();
    } else {
      // Best-effort play anyway; the player will no-op if src isn't ready.
      playerRef.value?.play();
    }
  };

  video.addEventListener('seeked', onSeeked);
  timer = window.setTimeout(() => {
    cleanup();
    playerRef.value?.play();
  }, 900);
}

function handlePlayerTimeupdate(p: { currentTime: number; duration: number }) {
  currentTime.value = p.currentTime;
  duration.value = p.duration;

  // Segment-bounded playback (MVP): clamp/stop within start/end.
  if (!props.isActive) return;

  // After we issue a restart/seek, some browsers emit a timeupdate before the
  // seek takes effect. Avoid immediately re-triggering the "end" clamp.
  if (Date.now() < suppressEndClampUntilMs.value) {
    const start = segmentStart.value;
    if (p.currentTime <= start + 0.25) {
      suppressEndClampUntilMs.value = 0;
    }
    return;
  }

  const start = props.feedItem.startSeconds ?? 0;
  const end = props.feedItem.endSeconds ?? 0;
  const endClamped = end > 0 && p.duration > 0 ? Math.min(end, p.duration) : end;
  if (endClamped > 0 && p.currentTime >= endClamped - END_EPSILON_SECONDS) {
    // Some browsers emit `waiting`/`seeking` around this clamp; don't let that
    // hide the restart affordance.
    suppressBufferingUntilMs.value = Date.now() + 1000;
    isBuffering.value = false;
    playerRef.value?.pause();
    playerRef.value?.setCurrentTime(endClamped);
    endedWithinSegment.value = true;
    showOverlay();
  }
  if (start > 0 && !hasSeekedToStart.value && p.duration > 0) {
    // Safety net: if we missed loadedmetadata, still snap to segment start once.
    hasSeekedToStart.value = true;
    endedWithinSegment.value = false;
    suppressEndClampUntilMs.value = Date.now() + 1000;
    playerRef.value?.setCurrentTime(start);
  }
}

function handleLoadedMetadata(p: { duration: number }) {
  duration.value = p.duration;
  hasSeekedToStart.value = false;
  endedWithinSegment.value = false;

  // Sync volume state from the actual video element once it's available.
  const currentVol = playerRef.value?.getVolume01?.();
  const currentMuted = playerRef.value?.getMuted?.();
  if (typeof currentVol === 'number') {
    volume01.value = Math.max(0, Math.min(1, currentVol));
    if (volume01.value > 0) volumeBeforeMute01.value = volume01.value;
  }
  if (typeof currentMuted === 'boolean') {
    muted.value = currentMuted;
  }
  applyVolumeToPlayer();

  if (!props.isActive) return;
  const start = props.feedItem.startSeconds ?? 0;
  if (start > 0) {
    hasSeekedToStart.value = true;
    suppressEndClampUntilMs.value = Date.now() + 1000;
    playerRef.value?.setCurrentTime(start);
  }
}

watch([volume01, muted], () => {
  applyVolumeToPlayer();
});

function handlePlay() {
  isPlaying.value = true;
  flashPlayPause('play');
  // Once playing, clear ended state.
  endedWithinSegment.value = false;
}

function handlePause() {
  isPlaying.value = false;
  isBuffering.value = false;
  flashPlayPause('pause');

  // If we've paused at (or beyond) the segment end, show restart affordances.
  const end = segmentEnd.value;
  if (end > 0 && currentTime.value >= end - END_EPSILON_SECONDS) {
    endedWithinSegment.value = true;
  }
}

// Ensure only the active item plays.
watch(
  () => props.isActive,
  (active) => {
    if (!active) {
      playerRef.value?.pause();
      isPlaying.value = false;
      hideOverlay();
      return;
    }
    // When a new feed item becomes active, restart to segment start and show controls.
    endedWithinSegment.value = false;
    hasSeekedToStart.value = false;
    playerRef.value?.pause();
    suppressEndClampUntilMs.value = Date.now() + 1000;
    playerRef.value?.setCurrentTime(segmentStart.value);
    showOverlay(6000);
  },
  { immediate: true }
);

watch(
  () => props.src,
  () => {
    // New clip source -> re-seek to segment start on next metadata.
    hasSeekedToStart.value = false;
    endedWithinSegment.value = false;
    currentTime.value = 0;
    duration.value = 0;
  }
);

function restartSegment() {
  if (!props.src) return;
  endedWithinSegment.value = false;
  suppressEndClampUntilMs.value = Date.now() + 1200;
  const target = segmentStart.value;
  playerRef.value?.setCurrentTime(target);
  playAfterSeek(target);
  showOverlay();
}

function scrubToSegmentSeconds(seconds: number) {
  const len = segmentLength.value;
  if (!len) return;
  const t = segmentStart.value + Math.max(0, Math.min(len, seconds));
  endedWithinSegment.value = false;
  suppressEndClampUntilMs.value = Date.now() + 1000;
  playerRef.value?.setCurrentTime(t);
  showOverlay(5000);
}

function onScrubStart() {
  // Keep overlay visible during scrubbing.
  showOverlay(null);
}

function onScrubEnd() {
  // Give the user a moment to see the result.
  showOverlay(2500);
}

// Narrations
const narrations = ref<NarrationListItem[]>([]);
const loadingNarrations = ref(false);
const submittingText = ref(false);
const submitTextError = ref<string | null>(null);

// Mobile-only: show narrations as a bottom drawer (keeps video visible).
const narrationsDrawerOpen = ref(false);
const narrationsDrawerHeightClass = computed(() => (narrationsDrawerOpen.value ? 'h-[65dvh]' : 'h-14'));
const narrationCount = computed(() => narrations.value.length);

async function refreshNarrations() {
  loadingNarrations.value = true;
  try {
    const list = await narrationService.listNarrationsForSegment(props.feedItem.mediaAssetSegmentId);
    narrations.value = list;
  } finally {
    loadingNarrations.value = false;
  }
}

watch(
  () => props.feedItem.mediaAssetSegmentId,
  () => {
    void refreshNarrations();
  },
  { immediate: true }
);

// Recording
const recorder = useNarrationRecorder();

function getTimeSeconds(): number {
  return playerRef.value?.getCurrentTime() ?? 0;
}

async function beginRecording() {
  await recorder.startRecording({
    orgId: props.feedItem.orgId,
    mediaAssetId: props.feedItem.mediaAssetId,
    mediaAssetSegmentId: props.feedItem.mediaAssetSegmentId,
    timeSeconds: getTimeSeconds(),
  });
  showOverlay();
}

function endRecordingNonBlocking() {
  const result = recorder.stopRecording();
  if (!result) return;

  // optimistic insert
  narrations.value = [...narrations.value, result.optimistic];

  // async resolve/replace
  result.promise
    .then((saved) => {
      narrations.value = narrations.value.map((n) => (n.id === result.optimistic.id ? saved : n));
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to process narration.';
      narrations.value = narrations.value.map((n) => {
        if (n.id !== result.optimistic.id) return n;
        return {
          ...result.optimistic,
          status: 'error',
          transcript_raw: 'Upload failed',
          errorMessage: message,
        };
      });
    });
}

async function submitTypedNarration(text: string) {
  if (!text.trim()) return;
  submitTextError.value = null;
  submittingText.value = true;

  const optimisticId = `optimistic-text-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const optimistic: NarrationListItem = {
    id: optimisticId,
    created_at: new Date(),
    transcript_raw: text.trim(),
    status: 'uploading',
  } as any;

  narrations.value = [...narrations.value, optimistic];

  try {
    const saved = await narrationService.createNarration({
      orgId: props.feedItem.orgId,
      mediaAssetId: props.feedItem.mediaAssetId,
      mediaAssetSegmentId: props.feedItem.mediaAssetSegmentId,
      transcriptRaw: text.trim(),
    });

    narrations.value = narrations.value.map((n) => (n.id === optimisticId ? saved : n));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save narration.';
    submitTextError.value = message;
    narrations.value = narrations.value.map((n) => {
      if (n.id !== optimisticId) return n;
      return {
        ...(n as any),
        status: 'error',
        errorMessage: message,
      };
    });
  } finally {
    submittingText.value = false;
  }
}

async function toggleRecord() {
  showOverlay();
  if (recorder.isRecording.value) {
    endRecordingNonBlocking();
  } else {
    await beginRecording();
  }
}

async function onDeleteNarration(id: string) {
  const before = narrations.value;
  // Optimistically remove it from the list.
  narrations.value = narrations.value.filter((n) => n.id !== id);
  try {
    await narrationService.deleteNarration(id);
  } catch (err) {
    narrations.value = before;
    const message = err instanceof Error ? err.message : 'Failed to delete narration.';
    submitTextError.value = message;
  }
}

async function onUpdateNarrationText(payload: { id: string; transcriptRaw: string }) {
  const { id, transcriptRaw } = payload;
  const before = narrations.value;
  // Optimistic UI update.
  narrations.value = narrations.value.map((n) => {
    if (n.id !== id) return n;
    if ((n as any).status) return n;
    return {
      ...(n as any),
      transcript_raw: transcriptRaw,
    };
  });

  try {
    const updated = await narrationService.updateNarrationText(id, transcriptRaw);
    narrations.value = narrations.value.map((n) => (n.id === id ? (updated as any) : n));
  } catch (err) {
    narrations.value = before;
    const message = err instanceof Error ? err.message : 'Failed to update narration.';
    submitTextError.value = message;
  }
}

function onTap(payload: { pointerType: PointerEvent['pointerType'] }) {
  if (isBuffering.value) return;
  // Desktop: click toggles play/pause.
  // Mobile: tap toggles controls visibility (only way to show controls).
  if (payload.pointerType === 'mouse') {
    togglePlay();
    return;
  }

  if (overlayVisible.value) hideOverlay();
  else showOverlay();
}

function handleBuffering(next: boolean) {
  if (Date.now() < suppressBufferingUntilMs.value) return;
  if (next && endedWithinSegment.value) return;
  isBuffering.value = next;
  if (next) hideOverlay();
}
</script>

<template>
  <div class="relative w-full bg-black text-white flex flex-col overflow-hidden h-full md:h-auto md:overflow-visible">
    <!-- Video surface (16:9) -->
    <div class="px-0 pt-0 shrink-0 md:px-6 md:pt-6">
      <div class="relative w-full bg-black md:mx-auto md:max-w-5xl">
        <div
          ref="surfaceEl"
          class="relative w-full overflow-hidden bg-black ring-1 ring-white/10 md:rounded-xl"
          :class="isFullscreen ? 'h-full w-full' : 'aspect-video'"
          @pointermove="onHoverMove"
          @pointerleave="onHoverLeave"
        >
          <HlsSurfacePlayer
            ref="playerRef"
            :src="src"
            :autoplay="false"
            class="h-full w-full"
            @timeupdate="handlePlayerTimeupdate"
            @loadedmetadata="handleLoadedMetadata"
            @play="handlePlay"
            @pause="handlePause"
            @buffering="handleBuffering"
          />

          <!-- Gesture + overlays live above the video -->
          <FeedGestureLayer
            @tap="onTap"
            @swipeUp="emit('next')"
            @swipeDown="emit('prev')"
          >
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-90"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="flashIcon && !isBuffering"
                class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
                aria-hidden="true"
              >
                <div class="rounded-full bg-black/45 backdrop-blur px-5 py-4 ring-1 ring-white/15">
                  <Icon :icon="flashIcon === 'play' ? 'carbon:play' : 'carbon:pause'" width="44" height="44" class="text-white" />
                </div>
              </div>
            </Transition>

            <FeedOverlayControls
              :visible="overlayVisible && !isBuffering"
              :is-playing="isPlaying"
              :progress01="progress01"
              :current-seconds="segmentCurrentSeconds"
              :duration-seconds="segmentLength"
              :can-prev="canPrev"
              :can-next="canNext"
              :show-restart="endedWithinSegment"
              :can-fullscreen="canFullscreen"
              :is-fullscreen="isFullscreen"
              :volume01="volume01"
              :muted="muted"
              @togglePlay="togglePlay"
              @prev="emit('prev')"
              @next="emit('next')"
              @restart="restartSegment"
              @scrubStart="onScrubStart"
              @scrubEnd="onScrubEnd"
              @scrubToSeconds="scrubToSegmentSeconds"
              @setVolume01="setVolume"
              @toggleMute="toggleMute"
              @toggleFullscreen="toggleFullscreen"
            />

            <div
              v-show="!isBuffering"
              data-gesture-ignore
              @pointerenter.stop="onNarrationButtonHoverEnter"
              @pointermove.stop
              @pointerleave.stop
            >
              <NarrationRecorder
                :is-recording="recorder.isRecording.value"
                :audio-level01="recorder.audioLevel.value"
                @toggle="toggleRecord"
              />
            </div>
          </FeedGestureLayer>

          <!-- Buffering overlay: sits above ALL controls -->
          <div
            v-show="isBuffering"
            class="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-black/40"
            aria-label="Buffering"
          >
            <div class="h-12 w-12 rounded-full border-2 border-white/25 border-t-white/95 animate-spin" />
          </div>
        </div>

        <div v-if="srcError" class="px-4 py-3 text-sm text-red-200 bg-red-500/10 ring-1 ring-red-300/20">
          {{ srcError }}
        </div>
      </div>
    </div>

    <!-- Below-video stack: on desktop, let the whole page scroll (no inner scroller). -->
    <div class="flex-1 min-h-0 flex flex-col md:flex-none md:px-6 pb-14 md:pb-0">
      <div class="shrink-0 md:mx-auto md:w-full md:max-w-5xl">
        <FeedMeta :title="feedItem.title" :meta-line="feedItem.metaLine" />
        <FeedActionBar />
      </div>

      <div class="hidden md:block flex-1 min-h-0 overflow-y-auto md:overflow-visible md:flex-none md:mx-auto md:w-full md:max-w-5xl">
        <div v-if="loadingNarrations" class="px-4 pt-3 text-sm text-white/50">Loading narrations…</div>
        <NarrationPanel
          :narrations="narrations"
          :submitting="submittingText"
          :submit-error="submitTextError"
          :current-user-id="currentUserId"
          @refresh="refreshNarrations"
          @submitText="submitTypedNarration"
          @delete="onDeleteNarration"
          @updateText="onUpdateNarrationText"
        />
      </div>
    </div>

    <!-- Mobile-only narrations drawer (absolute so it works with the feed paging transform) -->
    <div
      class="md:hidden absolute left-0 right-0 bottom-0 z-30 bg-black/95 backdrop-blur border-t border-white/10 transition-[height] duration-200 ease-out"
      :class="narrationsDrawerHeightClass"
    >
      <button
        type="button"
        class="w-full px-4 h-14 flex items-center justify-between text-left"
        @click="narrationsDrawerOpen = !narrationsDrawerOpen"
        :aria-expanded="narrationsDrawerOpen ? 'true' : 'false'"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="h-1 w-8 rounded-full bg-white/20" aria-hidden="true" />
          <div class="text-sm font-semibold text-white truncate">Narrations</div>
          <div class="text-xs text-white/50">({{ narrationCount }})</div>
        </div>
        <div class="text-xs text-white/60">
          {{ narrationsDrawerOpen ? 'Close' : 'Open' }}
        </div>
      </button>

      <div v-show="narrationsDrawerOpen" class="h-[calc(65dvh-3.5rem)] overflow-y-auto overscroll-contain">
        <div v-if="loadingNarrations" class="px-4 pt-3 text-sm text-white/50">Loading narrations…</div>
        <NarrationPanel
          :narrations="narrations"
          :submitting="submittingText"
          :submit-error="submitTextError"
          :current-user-id="currentUserId"
          @refresh="refreshNarrations"
          @submitText="submitTypedNarration"
          @delete="onDeleteNarration"
          @updateText="onUpdateNarrationText"
          @selectNarration="() => { narrationsDrawerOpen = false; }"
        />
      </div>
    </div>
  </div>
</template>
