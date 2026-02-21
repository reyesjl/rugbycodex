<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  isPlaying: boolean;
  progress01: number; // 0..1
  canPrev: boolean;
  canNext: boolean;
  showPrevNext?: boolean;
  showCenterPlayPause?: boolean;
  showRestart?: boolean;
  canFullscreen?: boolean;
  isFullscreen?: boolean;
  showCommentsToggle?: boolean;
  commentsPanelOpen?: boolean;
  showViewModeToggle?: boolean;
  isTheatreMode?: boolean;
  /** segment-relative current time (seconds) */
  currentSeconds?: number;
  /** segment-relative duration (seconds) */
  durationSeconds?: number;
  /** 0..1 */
  volume01?: number;
  muted?: boolean;
}>(), {
  currentSeconds: 0,
  durationSeconds: 0,
  volume01: 1,
  muted: false,
  canFullscreen: false,
  isFullscreen: false,
  showCommentsToggle: false,
  commentsPanelOpen: false,
  showViewModeToggle: false,
  isTheatreMode: true,
  showPrevNext: true,
  showCenterPlayPause: true,
});

const emit = defineEmits<{
  (e: 'togglePlay'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'restart'): void;
  (e: 'scrubToSeconds', seconds: number): void;
  (e: 'scrubStart'): void;
  (e: 'scrubEnd'): void;
  (e: 'setVolume01', volume01: number): void;
  (e: 'toggleMute'): void;
  (e: 'toggleFullscreen'): void;
  (e: 'toggleCommentsPanel'): void;
  (e: 'toggleViewMode'): void;
}>();

const barEl = ref<HTMLDivElement | null>(null);
const scrubbing = ref(false);
const scrubSeconds = ref(0);
const activePointerId = ref<number | null>(null);
const hoverProgress01 = ref<number | null>(null);

const effectiveCurrent = computed(() => {
  return scrubbing.value ? scrubSeconds.value : (props.currentSeconds ?? 0);
});

const effectiveProgress01 = computed(() => {
  const d = props.durationSeconds ?? 0;
  if (scrubbing.value) {
    if (!d) return 0;
    return Math.min(1, Math.max(0, scrubSeconds.value / d));
  }
  return Math.min(1, Math.max(0, props.progress01 ?? 0));
});

const thumbLeftPct = computed(() => {
  const d = props.durationSeconds ?? 0;
  if (!d) return 0;
  return Math.min(100, Math.max(0, (effectiveCurrent.value / d) * 100));
});

const hoverPreviewSeconds = computed(() => {
  const d = props.durationSeconds ?? 0;
  const p = hoverProgress01.value;
  if (!d || p === null) return 0;
  return clamp(p, 0, 1) * d;
});

const previewBubbleLeftPct = computed(() => {
  if (scrubbing.value) return thumbLeftPct.value;
  const p = hoverProgress01.value;
  return p === null ? null : Math.min(100, Math.max(0, p * 100));
});

const previewBubbleSeconds = computed(() => {
  return scrubbing.value ? effectiveCurrent.value : hoverPreviewSeconds.value;
});

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function onVolumeInput(e: Event) {
  const el = e.target as HTMLInputElement | null;
  if (!el) return;
  const n = Number(el.value);
  if (!Number.isFinite(n)) return;
  emit('setVolume01', clamp(n, 0, 1));
}

const volumeIcon = computed(() => {
  const v = props.volume01 ?? 1;
  const muted = Boolean(props.muted);
  if (muted || v <= 0) return 'carbon:volume-mute';
  if (v < 0.5) return 'carbon:volume-down';
  return 'carbon:volume-up';
});

function pctToSeconds(pct01: number): number {
  const d = props.durationSeconds ?? 0;
  return clamp(pct01, 0, 1) * d;
}

function getProgressFromEvent(e: PointerEvent): number {
  const el = barEl.value;
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  if (!rect.width) return 0;
  const x = clamp(e.clientX - rect.left, 0, rect.width);
  return clamp(x / rect.width, 0, 1);
}

function updateFromEvent(e: PointerEvent): number {
  const pct01 = getProgressFromEvent(e);
  const seconds = pctToSeconds(pct01);
  scrubSeconds.value = seconds;
  return seconds;
}

function onPointerDown(e: PointerEvent) {
  if ((props.durationSeconds ?? 0) <= 0) return;
  scrubbing.value = true;
  activePointerId.value = e.pointerId;
  emit('scrubStart');
  (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  updateFromEvent(e);
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'mouse') {
    hoverProgress01.value = getProgressFromEvent(e);
  }
  if (!scrubbing.value) return;
  if (activePointerId.value !== null && e.pointerId !== activePointerId.value) return;
  // If the mouse button is no longer pressed, don't keep scrubbing.
  if (e.pointerType === 'mouse' && (e.buttons ?? 0) === 0) {
    endScrub(e);
    return;
  }
  updateFromEvent(e);
}

function endScrub(e: PointerEvent) {
  if (!scrubbing.value) return;
  const shouldCommitFromPointer = e.type === 'pointerup';
  const seconds = shouldCommitFromPointer ? updateFromEvent(e) : scrubSeconds.value;
  scrubbing.value = false;
  activePointerId.value = null;
  (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
  emit('scrubToSeconds', seconds);
  emit('scrubEnd');
}

function onPointerLeaveBar() {
  hoverProgress01.value = null;
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="visible" class="absolute inset-0"> 
      <!-- Center cluster (prev / play-pause / next) -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex items-center gap-6 sm:gap-10">
          <button
            v-if="showPrevNext"
            type="button"
            class="rounded-full bg-black/30 p-2.5 text-white ring-1 ring-white/10 hover:bg-black/40 disabled:opacity-40 sm:p-3"
            :disabled="!canPrev"
            @click.stop="emit('prev')"
            title="Previous clip"
          >
            <Icon icon="carbon:chevron-left" width="22" height="22" class="sm:hidden" />
            <Icon icon="carbon:chevron-left" width="26" height="26" class="hidden sm:inline" />
          </button>

          <button
            v-if="showCenterPlayPause"
            type="button"
            class="p-0 text-white transition-opacity hover:opacity-80"
            @click.stop="emit('togglePlay')"
            :title="isPlaying ? 'Pause' : (showRestart ? 'Restart' : 'Play')"
            aria-label="Play / pause"
          >
            <Icon
              :icon="isPlaying ? 'carbon:pause-filled' : (showRestart ? 'carbon:restart' : 'carbon:play-filled-alt')"
              width="52"
              height="52"
              class="drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
            />
          </button>

          <button
            v-if="showPrevNext"
            type="button"
            class="rounded-full bg-black/30 p-2.5 text-white ring-1 ring-white/10 hover:bg-black/40 disabled:opacity-40 sm:p-3"
            :disabled="!canNext"
            @click.stop="emit('next')"
            title="Next clip"
          >
            <Icon icon="carbon:chevron-right" width="22" height="22" class="sm:hidden" />
            <Icon icon="carbon:chevron-right" width="26" height="26" class="hidden sm:inline" />
          </button>
        </div>
      </div>

      <!-- Bottom controls (YouTube-style) -->
      <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <button
            type="button"
            class="rounded-full bg-black/35 p-1.5 text-white ring-1 ring-white/10 hover:bg-black/45"
            @click.stop="emit('togglePlay')"
            :title="isPlaying ? 'Pause' : (showRestart ? 'Restart' : 'Play')"
          >
            <Icon :icon="isPlaying ? 'carbon:pause-filled' : (showRestart ? 'carbon:restart' : 'carbon:play-filled-alt')" width="22" height="22" />
          </button>

          <div class="group ml-2 flex items-center rounded-full bg-black/25 px-1.5 py-0.5 ring-1 ring-white/10">
            <button
              type="button"
              class="rounded-full p-1.5 text-white/90 hover:bg-black/35"
              @click.stop="emit('toggleMute')"
              :title="(muted || (volume01 ?? 0) <= 0) ? 'Unmute' : 'Mute'"
            >
              <Icon :icon="volumeIcon" width="18" height="18" />
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="volume-slider hidden h-0.5 w-0 cursor-pointer border-0 bg-transparent opacity-0 outline-none transition-all duration-150 sm:block group-hover:ml-1 group-hover:w-16 group-hover:opacity-100 group-focus-within:ml-1 group-focus-within:w-16 group-focus-within:opacity-100"
              :value="(muted ? 0 : (volume01 ?? 1))"
              @input.stop="onVolumeInput"
            />
          </div>

          <div class="ml-2 inline-flex items-center rounded-full bg-black/25 px-2 py-3 text-xs leading-none text-white/85 tabular-nums ring-1 ring-white/10">
            {{ formatTime(effectiveCurrent) }} / {{ formatTime(durationSeconds ?? 0) }}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="showCommentsToggle"
            type="button"
            class="hidden rounded-full p-1.5 text-white ring-1 ring-white/10 hover:bg-black/45 md:inline-flex"
            :class="commentsPanelOpen ? 'bg-white/20' : 'bg-black/35'"
            @click.stop="emit('toggleCommentsPanel')"
            :title="commentsPanelOpen ? 'Hide narrations' : 'Show narrations'"
          >
            <Icon icon="carbon:add-comment" width="22" height="22" />
          </button>
          <button
            v-if="showViewModeToggle"
            type="button"
            class="hidden rounded-full p-1.5 text-white ring-1 ring-white/10 hover:bg-black/45 md:inline-flex"
            :class="isTheatreMode ? 'bg-white/20' : 'bg-black/35'"
            @click.stop="emit('toggleViewMode')"
            :title="isTheatreMode ? 'Switch to normal mode' : 'Switch to theatre mode'"
          >
            <Icon :icon="isTheatreMode ? 'carbon:side-panel-close-filled' : 'carbon:side-panel-open-filled'" width="22" height="22" />
          </button>
          <button
            v-if="canFullscreen"
            type="button"
            class="rounded-full bg-black/35 p-1.5 text-white ring-1 ring-white/10 hover:bg-black/45"
            @click.stop="emit('toggleFullscreen')"
            :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
          >
            <Icon :icon="isFullscreen ? 'ri:fullscreen-exit-fill' : 'carbon:fit-to-screen'" width="22" height="22" />
          </button>
        </div>
      </div>

      <!-- Progress (scrubbable, segment-relative) ABOVE the control row -->
      <div class="absolute bottom-12 left-3 right-3">
        <div
          ref="barEl"
          class="relative flex h-8 cursor-pointer select-none items-center"
          style="touch-action: none"
          @dragstart.prevent
          @pointerdown.stop="onPointerDown"
          @pointermove.stop="onPointerMove"
          @pointerleave.stop="onPointerLeaveBar"
          @pointerup.stop="endScrub"
          @pointercancel.stop="endScrub"
          @lostpointercapture.stop="endScrub"
        >
          <!-- Track -->
          <div class="relative h-1 w-full rounded-full bg-white/25">
            <div
              v-if="hoverProgress01 !== null"
              class="absolute inset-y-0 left-0 rounded-full bg-white/45"
              :style="{ width: `${Math.min(100, Math.max(0, hoverProgress01 * 100))}%` }"
            />
            <div
              class="absolute inset-y-0 left-0 rounded-full bg-red-500"
              :style="{ width: `${Math.min(100, Math.max(0, effectiveProgress01 * 100))}%` }"
            />
          </div>

          <!-- Thumb / dot (always visible when overlay visible) -->
          <div
            class="absolute top-1/2 -translate-y-1/2"
            :style="{ left: `${thumbLeftPct}%` }"
          >
            <div class="h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 shadow ring-1 ring-black/20" />

          </div>

          <!-- Time bubble while scrubbing or hover previewing -->
          <div
            v-if="scrubbing || previewBubbleLeftPct !== null"
            class="absolute bottom-full mb-2 -translate-x-1/2 inline-flex w-max items-center whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-[11px] leading-none text-white ring-1 ring-white/10"
            :style="{ left: `${previewBubbleLeftPct ?? 0}%` }"
          >
            {{ formatTime(previewBubbleSeconds) }}
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.volume-slider {
  appearance: none;
}

.volume-slider::-webkit-slider-runnable-track {
  height: 3px;
  border: 0;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.72);
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -3.5px;
  border: 0;
  border-radius: 9999px;
  background: #fff;
}

.volume-slider::-moz-range-track {
  height: 3px;
  border: 0;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.72);
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 0;
  border-radius: 9999px;
  background: #fff;
}
</style>
