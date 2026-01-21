<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { FeedItem as FeedItemType } from '@/modules/feed/types/FeedItem';
import ShakaSurfacePlayer from '@/modules/media/components/ShakaSurfacePlayer.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import FeedMeta from '@/modules/feed/components/FeedMeta.vue';
import FeedActionBar from '@/modules/feed/components/FeedActionBar.vue';
import NarrationPanel from '@/modules/narrations/components/NarrationPanel.vue';
import NarrationRecorder from '@/modules/narrations/components/NarrationRecorder.vue';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { useNarrationRecorder, type NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';
import { toast } from '@/lib/toast';
import { useVideoOverlayControls } from '@/modules/media/composables/useVideoOverlayControls';
import { useSegmentPlayback } from '@/modules/media/composables/useSegmentPlayback';

const props = defineProps<{
  feedItem: FeedItemType;
  isActive: boolean;
  src: string;
  srcError?: string | null;
  canPrev: boolean;
  canNext: boolean;
  profileNameById?: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'next'): void;
  (e: 'prev'): void;
  (e: 'watchedHalf'): void;
  (e: 'addIdentityTag', payload: { segmentId: string }): void;
}>();

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id ?? null);
const activeOrgStore = useActiveOrganizationStore();
const membershipRole = computed(() => (activeOrgStore.orgContext?.membership?.role ?? null) as any);
const canAddIdentityTag = computed(() => hasOrgAccess(membershipRole.value, 'member'));

const segmentTags = computed<SegmentTag[]>(() => (props.feedItem.segment?.tags ?? []) as SegmentTag[]);
const hasIdentityTag = computed(() => {
  const userId = currentUserId.value;
  if (!userId) return false;
  return segmentTags.value.some((tag) => tag.tag_type === 'identity' && String(tag.created_by) === String(userId));
});

function requestIdentityTag() {
  if (!canAddIdentityTag.value) return;
  if (!currentUserId.value) return;
  if (hasIdentityTag.value) return;
  emit('addIdentityTag', { segmentId: String(props.feedItem.mediaAssetSegmentId) });
}

const playerRef = ref<InstanceType<typeof ShakaSurfacePlayer> | null>(null);
const surfaceEl = ref<HTMLElement | null>(null);

const videoEl = computed(() => (playerRef.value?.getVideoElement?.() ?? null) as HTMLVideoElement | null);

const isPlaying = ref(false);

// Moved segment-bounded playback + progress logic out of FeedItem.
const segmentPlayback = useSegmentPlayback({
  getPlayer: () => playerRef.value,
  segmentStartSeconds: computed(() => Math.max(0, props.feedItem.startSeconds ?? 0)),
  segmentEndSeconds: computed(() => Math.max(0, props.feedItem.endSeconds ?? 0)),
  isActive: computed(() => props.isActive),
  isPlaying,
  enableWatchedHalf: true,
  onWatchedHalf: () => emit('watchedHalf'),
});

const {
  segmentLength,
  progress01,
  segmentCurrentSeconds,
  endedWithinSegment,
  suppressBufferingUntilMs,
  resetWatchTracking,
  resetForActiveItem,
  handleTimeupdate: handleSegmentTimeupdate,
  handleLoadedMetadata: handleSegmentLoadedMetadata,
  seekRelative,
  restartSegment: restartSegmentInternal,
  scrubToSegmentSeconds: scrubToSegmentSecondsInternal,
  clearEndedWithinSegment,
  updateEndedWithinSegmentOnPause,
  resetOnSourceChange,
} = segmentPlayback;

function handleTogglePlayRequest() {
  if (!props.src) return;
  if (endedWithinSegment.value) {
    // Replay segment.
    restartSegmentInternal();
    return;
  }
  playerRef.value?.togglePlayback();
}

// Moved overlay + gesture + fullscreen controls out of FeedItem.
const overlayControls = useVideoOverlayControls({
  getVideoEl: () => videoEl.value,
  getSurfaceEl: () => surfaceEl.value,
  getPlayer: () => playerRef.value,
  isPlaying,
  onTogglePlay: handleTogglePlayRequest,
  onSeekRelative: (deltaSeconds) => seekRelative(deltaSeconds),
  suppressBufferingUntilMs,
  shouldIgnoreBuffering: (next) => next && endedWithinSegment.value,
  requireElementForFullscreen: false,
});

const {
  overlayVisible,
  isBuffering,
  flashIcon,
  volume01,
  muted,
  isFullscreen,
  canFullscreen,
  showOverlay,
  hideOverlay,
  requestTogglePlay,
  flashPlayPause,
  flashSeek,
  onHoverMove,
  onHoverLeave,
  onNarrationButtonHoverEnter,
  onTap,
  handleBuffering,
  applyVolumeToPlayer,
  syncVolumeFromPlayer,
  toggleMute,
  setVolume,
  toggleFullscreen,
} = overlayControls;

const togglePlay = requestTogglePlay;

const mutedBeforeRecording = ref<boolean | null>(null);

function muteVideoForRecording() {
  if (mutedBeforeRecording.value !== null) return;
  mutedBeforeRecording.value = muted.value;
  muted.value = true;
  applyVolumeToPlayer();
}

function restoreVideoMuteAfterRecording() {
  if (mutedBeforeRecording.value === null) return;
  muted.value = mutedBeforeRecording.value;
  mutedBeforeRecording.value = null;
  applyVolumeToPlayer();
}

function handlePlayerTimeupdate(p: { currentTime: number; duration: number }) {
  const { didClampEnd } = handleSegmentTimeupdate(p);
  if (didClampEnd) {
    // Some browsers emit `waiting`/`seeking` around this clamp; don't let that
    // hide the restart affordance.
    isBuffering.value = false;
    showOverlay();
  }
}

function handleLoadedMetadata(p: { duration: number }) {
  // Sync volume state from the actual video element once it's available.
  syncVolumeFromPlayer();
  applyVolumeToPlayer();
  handleSegmentLoadedMetadata(p);
}

function handlePlay() {
  isPlaying.value = true;
  flashPlayPause('play');
  // Once playing, clear ended state.
  clearEndedWithinSegment();
}

function handlePause() {
  isPlaying.value = false;
  isBuffering.value = false;
  flashPlayPause('pause');
  // If we've paused at (or beyond) the segment end, show restart affordances.
  updateEndedWithinSegmentOnPause();
}

function restartSegment() {
  if (!props.src) return;
  restartSegmentInternal();
  showOverlay();
}

function scrubToSegmentSeconds(seconds: number) {
  scrubToSegmentSecondsInternal(seconds);
  showOverlay(5000);
}

function seekRelativeWithFeedback(deltaSeconds: number) {
  if (!props.src) return;
  seekRelative(deltaSeconds);
  flashSeek(deltaSeconds < 0 ? 'rew' : 'ff', Math.abs(deltaSeconds));
  showOverlay(2500);
}

function onScrubStart() {
  // Keep overlay visible during scrubbing.
  showOverlay(null);
}

function onScrubEnd() {
  // Give the user a moment to see the result.
  showOverlay(2500);
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
    resetForActiveItem();
    showOverlay(6000);
  },
  { immediate: true }
);

watch(
  () => props.feedItem.mediaAssetSegmentId,
  (next, prev) => {
    if (!next || next === prev) return;
    resetWatchTracking();
    if (!props.isActive) return;
    // Desktop view reuses a single FeedItem instance; re-seek when the item changes.
    resetForActiveItem();
    showOverlay(6000);
  }
);

watch(
  () => props.src,
  () => {
    // New clip source -> re-seek to segment start on next metadata.
    resetOnSourceChange();
  }
);

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
  // Mute the video before recording to avoid bleeding audio into the mic capture.
  muteVideoForRecording();
  try {
    await recorder.startRecording({
      orgId: props.feedItem.orgId,
      mediaAssetId: props.feedItem.mediaAssetId,
      mediaAssetSegmentId: props.feedItem.mediaAssetSegmentId,
      timeSeconds: getTimeSeconds(),
    });
  } catch (err) {
    restoreVideoMuteAfterRecording();
    throw err;
  }
  showOverlay();
}

function endRecordingNonBlocking() {
  const result = recorder.stopRecording();
  if (!result) return;

  restoreVideoMuteAfterRecording();

  // optimistic insert
  narrations.value = [...narrations.value, result.optimistic];

  // async resolve/replace
  result.promise
    .then((saved) => {
      narrations.value = narrations.value.map((n) => (n.id === result.optimistic.id ? saved : n));
      toast({ message: 'Narration added.', variant: 'success', durationMs: 2000 });
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
      toast({ message, variant: 'error', durationMs: 2500 });
    });
}

watch(
  () => recorder.isRecording.value,
  (isRec) => {
    if (isRec) muteVideoForRecording();
    else restoreVideoMuteAfterRecording();
  }
);

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
    toast({ message: 'Narration added.', variant: 'success', durationMs: 2000 });
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
    toast({ message, variant: 'error', durationMs: 2500 });
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

onBeforeUnmount(() => {
  restoreVideoMuteAfterRecording();
});
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
          <ShakaSurfacePlayer
            ref="playerRef"
            :manifest-url="src"
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
              >
                <template #auxControls>
                  <div class="flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 ring-1 ring-white/10 backdrop-blur">
                    <button
                      type="button"
                      class="rounded-full p-1.5 text-white/80 hover:bg-black/45 hover:text-white"
                      title="Rewind 10s"
                      aria-label="Rewind 10 seconds"
                      @click.stop="seekRelativeWithFeedback(-10)"
                    >
                      <Icon icon="carbon:rewind-10" width="18" height="18" />
                    </button>
                    <button
                      type="button"
                      class="rounded-full p-1.5 text-white/80 hover:bg-black/45 hover:text-white"
                      title="Forward 10s"
                      aria-label="Forward 10 seconds"
                      @click.stop="seekRelativeWithFeedback(10)"
                    >
                      <Icon icon="carbon:forward-10" width="18" height="18" />
                    </button>
                  </div>
                </template>
              </NarrationRecorder>
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
        <FeedActionBar
          :tags="segmentTags"
          :current-user-id="currentUserId"
          :can-add-identity="canAddIdentityTag && Boolean(currentUserId)"
          :has-identity-tag="hasIdentityTag"
          :profile-name-by-id="props.profileNameById"
          @addIdentityTag="requestIdentityTag"
        />
      </div>

      <div class="hidden md:block flex-1 min-h-0 overflow-y-auto md:overflow-visible md:flex-none md:mx-auto md:w-full md:max-w-5xl">
        <div v-if="loadingNarrations" class="px-4 pt-3 text-sm text-white/50">Loading narrations…</div>
        <NarrationPanel
          :key="feedItem.mediaAssetSegmentId"
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
          :key="feedItem.mediaAssetSegmentId"
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
