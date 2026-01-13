<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  isPlaying: boolean;
  progress01: number; // 0..1
  canPrev: boolean;
  canNext: boolean;
  showRestart?: boolean;
  canFullscreen?: boolean;
  isFullscreen?: boolean;
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
});

const emit = defineEmits<{
  (e: 'togglePlay'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'restart'): void;
  (e: 'cc'): void;
  (e: 'settings'): void;
  (e: 'scrubToSeconds', seconds: number): void;
  (e: 'scrubStart'): void;
  (e: 'scrubEnd'): void;
  (e: 'setVolume01', volume01: number): void;
  (e: 'toggleMute'): void;
  (e: 'toggleFullscreen'): void;
}>();

const barEl = ref<HTMLDivElement | null>(null);
const scrubbing = ref(false);
const scrubSeconds = ref(0);
const activePointerId = ref<number | null>(null);

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

function updateFromEvent(e: PointerEvent): number {
  const el = barEl.value;
  if (!el) return scrubSeconds.value;
  const rect = el.getBoundingClientRect();
  if (!rect.width) return scrubSeconds.value;
  const x = clamp(e.clientX - rect.left, 0, rect.width);
  const pct01 = x / rect.width;
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
  const seconds = updateFromEvent(e);
  scrubbing.value = false;
  activePointerId.value = null;
  (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
  emit('scrubToSeconds', seconds);
  emit('scrubEnd');
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
    <div v-if="visible" class="absolute inset-0 bg-black/25 backdrop-blur-[1px]">
      <!-- Top-right icons (placeholders) -->
      <div class="absolute right-3 top-3 flex items-center gap-2">
        <button
          type="button"
          class="rounded-full bg-black/25 p-1.5 text-white/90 ring-1 ring-white/10 hover:bg-black/35"
          @click.stop="emit('cc')"
          title="Captions (placeholder)"
        >
          <Icon icon="carbon:closed-caption" width="18" height="18" />
        </button>
        <button
          type="button"
          class="rounded-full bg-black/25 p-1.5 text-white/90 ring-1 ring-white/10 hover:bg-black/35"
          @click.stop="emit('settings')"
          title="Settings (placeholder)"
        >
          <Icon icon="carbon:settings" width="18" height="18" />
        </button>
      </div>

      <!-- Center cluster (prev / next) -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex items-center gap-8">
          <button
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
            <Icon :icon="isPlaying ? 'carbon:pause' : (showRestart ? 'carbon:restart' : 'carbon:play')" width="22" height="22" />
          </button>

          <div class="ml-2 flex items-center rounded-full bg-black/25 px-1.5 py-0.5 ring-1 ring-white/10">
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
              class="hidden sm:block w-24 h-1 accent-white"
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
          class="relative h-8 flex items-center"
          :class="scrubbing ? 'cursor-grabbing' : 'cursor-grab'"
          style="touch-action: none"
          @pointerdown.stop="onPointerDown"
          @pointermove.stop="onPointerMove"
          @pointerup.stop="endScrub"
          @pointercancel.stop="endScrub"
          @lostpointercapture.stop="endScrub"
        >
          <!-- Track -->
          <div class="h-1 w-full rounded-full bg-white/25">
            <div
              class="h-full rounded-full bg-white/80"
              :style="{ width: `${Math.min(100, Math.max(0, effectiveProgress01 * 100))}%` }"
            />
          </div>

          <!-- Thumb / dot (always visible when overlay visible) -->
          <div
            class="absolute top-1/2 -translate-y-1/2"
            :style="{ left: `${thumbLeftPct}%` }"
          >
            <div class="h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow ring-1 ring-black/20" />

            <!-- Time bubble while scrubbing -->
            <div
              v-if="scrubbing"
              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 inline-flex w-max items-center whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-[11px] leading-none text-white ring-1 ring-white/10"
            >
              {{ formatTime(effectiveCurrent) }} / {{ formatTime(durationSeconds ?? 0) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
