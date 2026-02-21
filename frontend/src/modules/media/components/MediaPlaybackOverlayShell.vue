<script setup lang="ts">
import { Icon } from '@iconify/vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import NarrationRecorder from '@/modules/narrations/components/NarrationRecorder.vue';

withDefaults(
  defineProps<{
    overlayVisible: boolean;
    isBuffering: boolean;
    flashIcon: 'play' | 'pause' | 'rew5' | 'rew10' | 'ff5' | 'ff10' | null;
    isPlaying: boolean;
    progress01: number;
    currentSeconds: number;
    durationSeconds: number;
    volume01: number;
    muted: boolean;
    canFullscreen: boolean;
    isFullscreen: boolean;
    showCommentsToggle?: boolean;
    commentsPanelOpen?: boolean;
    showViewModeToggle?: boolean;
    isTheatreMode?: boolean;
    canPrev?: boolean;
    canNext?: boolean;
    showPrevNext?: boolean;
    showCenterPlayPause?: boolean;
    showRestart?: boolean;
    showSkipControls?: boolean;
    showNarrationRecorder?: boolean;
    narrationIsRecording?: boolean;
    narrationAudioLevel01?: number;
    narrationDurationMs?: number;
    liveTranscriptText?: string | null;
  }>(),
  {
    canPrev: false,
    canNext: false,
    showPrevNext: false,
    showCenterPlayPause: false,
    showRestart: false,
    showSkipControls: false,
    showNarrationRecorder: false,
    narrationIsRecording: false,
    narrationAudioLevel01: 0,
    narrationDurationMs: 0,
    liveTranscriptText: null,
    showCommentsToggle: false,
    commentsPanelOpen: false,
    showViewModeToggle: false,
    isTheatreMode: true,
  }
);

const emit = defineEmits<{
  (e: 'tap', payload: { pointerType: PointerEvent['pointerType']; xPct: number; yPct: number }): void;
  (e: 'swipe-down'): void;
  (e: 'swipe-up'): void;
  (e: 'toggle-play'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'restart'): void;
  (e: 'scrub-to-seconds', seconds: number): void;
  (e: 'scrub-start'): void;
  (e: 'scrub-end'): void;
  (e: 'set-volume01', volume01: number): void;
  (e: 'toggle-mute'): void;
  (e: 'toggle-fullscreen'): void;
  (e: 'toggle-comments-panel'): void;
  (e: 'toggle-view-mode'): void;
  (e: 'aux-hover-enter', event: PointerEvent): void;
  (e: 'rewind-10'): void;
  (e: 'forward-10'): void;
  (e: 'toggle-narration'): void;
}>();
</script>

<template>
  <FeedGestureLayer @tap="(payload) => emit('tap', payload)" @swipe-down="emit('swipe-down')" @swipe-up="emit('swipe-up')">
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
        <div class="rounded-full bg-black/40 p-3">
          <Icon
            :icon="flashIcon === 'play'
              ? 'carbon:play-filled-alt'
              : flashIcon === 'pause'
                ? 'carbon:pause-filled'
                : flashIcon === 'rew5'
                  ? 'carbon:rewind-5'
                  : flashIcon === 'rew10'
                    ? 'carbon:rewind-10'
                    : flashIcon === 'ff5'
                      ? 'carbon:forward-5'
                      : 'carbon:forward-10'"
            width="52"
            height="52"
            class="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
          />
        </div>
      </div>
    </Transition>

    <FeedOverlayControls
      :visible="overlayVisible && !isBuffering"
      :is-playing="isPlaying"
      :progress01="progress01"
      :can-prev="canPrev"
      :can-next="canNext"
      :show-prev-next="showPrevNext"
      :show-center-play-pause="showCenterPlayPause"
      :show-restart="showRestart"
      :can-fullscreen="canFullscreen"
      :is-fullscreen="isFullscreen"
      :show-comments-toggle="showCommentsToggle"
      :comments-panel-open="commentsPanelOpen"
      :show-view-mode-toggle="showViewModeToggle"
      :is-theatre-mode="isTheatreMode"
      :current-seconds="currentSeconds"
      :duration-seconds="durationSeconds"
      :volume01="volume01"
      :muted="muted"
      @toggle-play="emit('toggle-play')"
      @prev="emit('prev')"
      @next="emit('next')"
      @restart="emit('restart')"
      @scrub-to-seconds="(seconds) => emit('scrub-to-seconds', seconds)"
      @scrub-start="emit('scrub-start')"
      @scrub-end="emit('scrub-end')"
      @set-volume01="(next) => emit('set-volume01', next)"
      @toggle-mute="emit('toggle-mute')"
      @toggle-fullscreen="emit('toggle-fullscreen')"
      @toggle-comments-panel="emit('toggle-comments-panel')"
      @toggle-view-mode="emit('toggle-view-mode')"
    />

    <div
      v-show="!isBuffering"
      data-gesture-ignore
      @pointerenter.stop="(event) => emit('aux-hover-enter', event)"
      @pointermove.stop
      @pointerleave.stop
    >
      <div
        v-if="liveTranscriptText"
        class="absolute bottom-20 left-4 right-4 z-40 pointer-events-none"
      >
        <p class="text-base font-medium text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {{ liveTranscriptText }}
        </p>
      </div>

      <NarrationRecorder
        v-if="showNarrationRecorder"
        :is-recording="narrationIsRecording"
        :audio-level01="narrationAudioLevel01"
        :duration-ms="narrationDurationMs"
        @toggle="emit('toggle-narration')"
      >
        <template #auxControls>
          <div
            v-if="showSkipControls"
            class="flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 ring-1 ring-white/10 backdrop-blur"
          >
            <button
              type="button"
              class="rounded-full p-1.5 text-white/80 hover:bg-black/45 hover:text-white"
              title="Rewind 10s"
              aria-label="Rewind 10 seconds"
              @click.stop="emit('rewind-10')"
            >
              <Icon icon="carbon:rewind-10" width="18" height="18" />
            </button>
            <button
              type="button"
              class="rounded-full p-1.5 text-white/80 hover:bg-black/45 hover:text-white"
              title="Forward 10s"
              aria-label="Forward 10 seconds"
              @click.stop="emit('forward-10')"
            >
              <Icon icon="carbon:forward-10" width="18" height="18" />
            </button>
          </div>
        </template>
      </NarrationRecorder>

      <div
        v-else-if="showSkipControls"
        class="absolute right-3 top-1/2 -translate-y-1/2 z-40"
      >
        <div class="flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 ring-1 ring-white/10 backdrop-blur">
          <button
            type="button"
            class="rounded-full p-1.5 text-white/80 hover:bg-black/45 hover:text-white"
            title="Rewind 10s"
            aria-label="Rewind 10 seconds"
            @click.stop="emit('rewind-10')"
          >
            <Icon icon="carbon:rewind-10" width="18" height="18" />
          </button>
          <button
            type="button"
            class="rounded-full p-1.5 text-white/80 hover:bg-black/45 hover:text-white"
            title="Forward 10s"
            aria-label="Forward 10 seconds"
            @click.stop="emit('forward-10')"
          >
            <Icon icon="carbon:forward-10" width="18" height="18" />
          </button>
        </div>
      </div>
    </div>
  </FeedGestureLayer>

  <div
    v-show="isBuffering"
    class="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-black/40"
    aria-label="Buffering"
  >
    <div class="h-12 w-12 rounded-full border-2 border-white/25 border-t-white/95 animate-spin" />
  </div>
</template>
