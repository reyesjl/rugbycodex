<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { FeedItem as FeedItemType } from '@/modules/feed/types/FeedItem';
import ShakaSurfacePlayer from '@/modules/media/components/ShakaSurfacePlayer.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import FeedProgressBar from '@/modules/feed/components/FeedProgressBar.vue';
import FeedNavControls from '@/modules/feed/components/FeedNavControls.vue';
import FeedMeta from '@/modules/feed/components/FeedMeta.vue';
import FeedContent from '@/modules/feed/components/FeedContent.vue';
import NarrationRecorder from '@/modules/narrations/components/NarrationRecorder.vue';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { useNarrationRecorder, type NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import { analysisService } from '@/modules/analysis/services/analysisService';
import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';
import type { SegmentInsight } from '@/modules/analysis/types/SegmentInsight';
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
  activeIndex?: number;
  totalCount?: number;
}>();

const emit = defineEmits<{
  (e: 'next'): void;
  (e: 'prev'): void;
  (e: 'watchedHalf'): void;
  (e: 'addIdentityTag', payload: { segmentId: string }): void;
  (e: 'removeIdentityTag', payload: { segmentId: string }): void;
}>();

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id ?? null);
const currentUserName = computed(() => authStore.user?.user_metadata?.name || authStore.user?.email || 'Unknown');
const activeOrgStore = useActiveOrganizationStore();
const membershipRole = computed(() => (activeOrgStore.orgContext?.membership?.role ?? null) as any);
const canAddIdentityTag = computed(() => hasOrgAccess(membershipRole.value, 'member'));
const canGenerateSegmentInsight = computed(() => hasOrgAccess(membershipRole.value, 'member'));

const segmentTags = computed<SegmentTag[]>(() => (props.feedItem.segment?.tags ?? []) as SegmentTag[]);
const hasIdentityTag = computed(() => {
  const userId = currentUserId.value;
  if (!userId) return false;
  return segmentTags.value.some((tag) => {
    if (tag.tag_type !== 'identity') return false;
    const profileId = tag.tagged_profile_id ?? tag.created_by;
    return String(profileId) === String(userId);
  });
});

function requestIdentityTag() {
  if (!canAddIdentityTag.value) return;
  if (!currentUserId.value) return;
  if (hasIdentityTag.value) return;
  emit('addIdentityTag', { segmentId: String(props.feedItem.mediaAssetSegmentId) });
}

function requestRemoveIdentityTag() {
  if (!canAddIdentityTag.value) return;
  if (!currentUserId.value) return;
  if (!hasIdentityTag.value) return;
  emit('removeIdentityTag', { segmentId: String(props.feedItem.mediaAssetSegmentId) });
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
const segmentInsight = ref<SegmentInsight | null>(null);
const segmentInsightLoading = ref(false);
const segmentInsightRefreshing = ref(false);
const segmentInsightError = ref<string | null>(null);
let segmentInsightRequestId = 0;
const segmentInsightNarrationsNeeded = 1;
const coachAudioUrl = ref<string | null>(null);
const coachAudioLoading = ref(false);
const coachAudioError = ref<string | null>(null);
const coachAudioPlaying = ref(false);
const coachAudioElement = ref<HTMLAudioElement | null>(null);

const segmentNarrationCount = computed(() => narrations.value.length);
const segmentInsightState = computed<MatchSummaryState>(() => {
  return segmentNarrationCount.value >= segmentInsightNarrationsNeeded ? 'normal' : 'empty';
});

const insightHeadline = computed(() => segmentInsight.value?.insight_headline ?? null);
const insightSentence = computed(() => segmentInsight.value?.insight_sentence ?? null);
const insightCoachScript = computed(() => segmentInsight.value?.coach_script ?? null);
const coachAudioAvailable = computed(() => Boolean(insightCoachScript.value));

const hasSegmentInsightContent = computed(() => Boolean(insightSentence.value));
const insightPlaceholder = computed(() => {
  if (segmentNarrationCount.value < segmentInsightNarrationsNeeded) {
    return 'Add 1+ narrations to generate insight.';
  }
  if (!hasSegmentInsightContent.value) {
    return 'Generate an insight to see the summary.';
  }
  return '';
});

function resetSegmentInsight() {
  segmentInsightRequestId += 1;
  segmentInsight.value = null;
  segmentInsightError.value = null;
  segmentInsightLoading.value = false;
  segmentInsightRefreshing.value = false;
}

function resetCoachAudio() {
  coachAudioUrl.value = null;
  coachAudioError.value = null;
  coachAudioLoading.value = false;
  coachAudioPlaying.value = false;
  if (coachAudioElement.value) {
    coachAudioElement.value.pause();
    coachAudioElement.value.currentTime = 0;
  }
}

function hasInsightPayload(next: SegmentInsight | null): boolean {
  if (!next || next.state !== 'normal') return false;
  return Boolean(next.insight_headline || next.insight_sentence || next.coach_script);
}

async function refreshNarrations() {
  loadingNarrations.value = true;
  try {
    const list = await narrationService.listNarrationsWithAuthors(props.feedItem.mediaAssetSegmentId);
    narrations.value = list;
  } finally {
    loadingNarrations.value = false;
  }
}

watch(
  () => props.feedItem.mediaAssetSegmentId,
  () => {
    resetSegmentInsight();
    resetCoachAudio();
    void refreshNarrations();
    void loadStoredSegmentInsight();
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
      // Add current user's author info
      const savedWithAuthor: NarrationListItem = {
        ...saved,
        author_name: currentUserName.value,
        author_username: null,
      };
      narrations.value = narrations.value.map((n) => (n.id === result.optimistic.id ? savedWithAuthor : n));
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

    // Add current user's author info since createNarration returns Narration, not NarrationWithAuthor
    const savedWithAuthor: NarrationListItem = {
      ...saved,
      author_name: currentUserName.value,
      author_username: null,
    };

    narrations.value = narrations.value.map((n) => (n.id === optimisticId ? savedWithAuthor : n));
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

async function generateSegmentInsight(params?: { forceRefresh?: boolean }) {
  if (!props.feedItem.mediaAssetSegmentId) return;
  if (!canGenerateSegmentInsight.value) return;
  
  if (segmentInsightState.value !== 'normal') {
    segmentInsight.value = { state: segmentInsightState.value };
    return;
  }
  
  const summaryRequestId = ++segmentInsightRequestId;
  segmentInsightError.value = null;
  segmentInsightLoading.value = true;
  try {
    const next = await analysisService.getSegmentSummary(props.feedItem.mediaAssetSegmentId, {
      forceRefresh: Boolean(params?.forceRefresh),
    });
    if (summaryRequestId !== segmentInsightRequestId) return;
    segmentInsight.value = next;
    resetCoachAudio();
  } catch (err) {
    if (summaryRequestId !== segmentInsightRequestId) return;
    segmentInsightError.value = err instanceof Error ? err.message : 'Unable to generate insight.';
  } finally {
    if (summaryRequestId === segmentInsightRequestId) {
      segmentInsightLoading.value = false;
    }
  }
}

async function refreshStaleSegmentInsight() {
  if (!props.feedItem.mediaAssetSegmentId) return;
  if (!canGenerateSegmentInsight.value) return;
  const summaryRequestId = ++segmentInsightRequestId;
  segmentInsightRefreshing.value = true;
  try {
    const next = await analysisService.getSegmentSummary(props.feedItem.mediaAssetSegmentId, {
      forceRefresh: true,
      skipCache: true,
    });
    if (summaryRequestId !== segmentInsightRequestId) return;
    if (hasInsightPayload(next)) {
      segmentInsight.value = next;
      resetCoachAudio();
    }
  } catch (err) {
    if (summaryRequestId !== segmentInsightRequestId) return;
    segmentInsightError.value = err instanceof Error ? err.message : 'Unable to refresh insight.';
  } finally {
    if (summaryRequestId === segmentInsightRequestId) {
      segmentInsightRefreshing.value = false;
    }
  }
}

async function loadStoredSegmentInsight() {
  if (!props.feedItem.mediaAssetSegmentId) return;
  if (!canGenerateSegmentInsight.value) return;
  
  const summaryRequestId = ++segmentInsightRequestId;
  segmentInsightError.value = null;
  segmentInsightLoading.value = true;
  try {
    const next = await analysisService.getSegmentSummary(props.feedItem.mediaAssetSegmentId, {
      forceRefresh: false,
      skipCache: true,
    });
    if (summaryRequestId !== segmentInsightRequestId) return;
    if (hasInsightPayload(next)) {
      segmentInsight.value = next;
      if (next.is_stale) {
        void refreshStaleSegmentInsight();
      }
    }
  } catch (err) {
    if (summaryRequestId !== segmentInsightRequestId) return;
    segmentInsightError.value = err instanceof Error ? err.message : 'Unable to load insight.';
  } finally {
    if (summaryRequestId === segmentInsightRequestId) {
      segmentInsightLoading.value = false;
    }
  }
}

function handleCoachAudioEnded() {
  coachAudioPlaying.value = false;
  if (coachAudioElement.value) {
    coachAudioElement.value.currentTime = 0;
  }
}

function handleCoachAudioPause() {
  coachAudioPlaying.value = false;
}

function handleCoachAudioPlay() {
  coachAudioPlaying.value = true;
}

async function toggleCoachAudio() {
  if (!coachAudioAvailable.value) return;
  if (coachAudioLoading.value) return;
  coachAudioError.value = null;

  const audioEl = coachAudioElement.value;
  if (coachAudioPlaying.value && audioEl) {
    audioEl.pause();
    return;
  }

  if (!coachAudioUrl.value) {
    coachAudioLoading.value = true;
    try {
      const response = await analysisService.getSegmentCoachAudio(props.feedItem.mediaAssetSegmentId, {
        forceRefresh: false,
      });
      coachAudioUrl.value = response.coach_audio_url;
    } catch (err) {
      coachAudioError.value = err instanceof Error ? err.message : 'Unable to load coach audio.';
      return;
    } finally {
      coachAudioLoading.value = false;
    }
  }

  await nextTick();
  if (!coachAudioElement.value) return;
  try {
    await coachAudioElement.value.play();
  } catch (err) {
    coachAudioError.value = err instanceof Error ? err.message : 'Unable to play coach audio.';
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

// Hide overlay when switching to a new video
watch(() => props.isActive, (newIsActive) => {
  if (newIsActive) {
    overlayControls.hideOverlay();
  }
});

onBeforeUnmount(() => {
  restoreVideoMuteAfterRecording();
  resetCoachAudio();
});
</script>

<template>
  <div class="relative w-full bg-black text-white flex flex-col md:overflow-visible">
    <!-- Progress Bar (Mobile Only) -->
    <FeedProgressBar
      v-if="activeIndex !== undefined && totalCount !== undefined"
      :active-index="activeIndex"
      :total-count="totalCount"
      class="md:hidden absolute top-0 left-0 right-0 z-50"
    />

    <!-- Navigation Controls (Desktop Only) -->
    <FeedNavControls
      v-if="activeIndex !== undefined && totalCount !== undefined"
      :can-prev="canPrev"
      :can-next="canNext"
      :current-index="activeIndex"
      :total-count="totalCount"
      @prev="emit('prev')"
      @next="emit('next')"
    />
    
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
            :autoplay="isActive"
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
              :visible="overlayVisible && !isBuffering && !flashIcon"
              :is-playing="isPlaying"
              :progress01="progress01"
              :current-seconds="segmentCurrentSeconds"
              :duration-seconds="segmentLength"
              :can-prev="canPrev"
              :can-next="canNext"
              :show-prev-next="false"
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
              <!-- Live transcript overlay (Web Speech API) - No background, just amber text -->
              <div 
                v-if="recorder.isRecording.value && recorder.liveTranscript.value"
                class="absolute bottom-20 left-4 right-4 z-40 pointer-events-none"
              >
                <p class="text-base font-medium text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {{ recorder.liveTranscript.value }}
                </p>
              </div>

              <NarrationRecorder
                :is-recording="recorder.isRecording.value"
                :audio-level01="recorder.audioLevel.value"
                :duration-ms="recorder.duration.value"
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
    <div class="flex-1 min-h-0 flex flex-col md:flex-none md:px-6 md:pb-0">
      <div class="shrink-0 md:mx-auto md:w-full md:max-w-5xl">
        <FeedMeta 
          :title="feedItem.title" 
          :meta-line="feedItem.metaLine" 
          :created-at="feedItem.createdAt"
          :can-add-identity="canAddIdentityTag && Boolean(currentUserId)"
          :has-identity-tag="hasIdentityTag"
          @requestIdentityTag="requestIdentityTag"
          @removeIdentityTag="requestRemoveIdentityTag"
        />
      </div>

      <div class="flex-1 min-h-0 md:overflow-visible md:flex-none md:mx-auto md:w-full md:max-w-5xl">
        <FeedContent
          :tags="segmentTags"
          :current-user-id="currentUserId"
          :profile-name-by-id="props.profileNameById"
          :narrations="narrations"
          :loading-narrations="loadingNarrations"
          :submitting-narration="submittingText"
          :submit-error="submitTextError"
          :current-user-role="membershipRole"
          :insight-headline="insightHeadline"
          :insight-sentence="insightSentence"
          :insight-coach-script="insightCoachScript"
          :insight-placeholder="insightPlaceholder"
          :insight-loading="segmentInsightLoading"
          :insight-refreshing="segmentInsightRefreshing"
          :insight-error="segmentInsightError"
          :insight-can-generate="canGenerateSegmentInsight"
          :insight-has-generated="hasSegmentInsightContent"
          :insight-narration-count="segmentNarrationCount"
          :coach-audio-loading="coachAudioLoading"
          :coach-audio-playing="coachAudioPlaying"
          :coach-audio-error="coachAudioError"
          :coach-audio-available="coachAudioAvailable"
          @submitText="submitTypedNarration"
          @updateText="onUpdateNarrationText"
          @delete="onDeleteNarration"
          @generateInsight="generateSegmentInsight({ forceRefresh: true })"
          @toggleCoachAudio="toggleCoachAudio"
          @selectNarration="() => {}"
        />
        <audio
          ref="coachAudioElement"
          class="hidden"
          :src="coachAudioUrl ?? undefined"
          @ended="handleCoachAudioEnded"
          @pause="handleCoachAudioPause"
          @play="handleCoachAudioPlay"
        />

        <!-- Ad Space Promotion Card (Desktop Only) -->
        <div class="hidden md:block px-4 py-6">
          <a
            href="https://rugbycodex.com/advertise"
            target="_blank"
            rel="noopener noreferrer"
            class="block group"
          >
            <div class="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-6 border border-white/20 hover:border-white/30 transition-all duration-200">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-2">
                  <h3 class="text-lg font-semibold text-white">
                    Advertise Here
                  </h3>
                  <p class="text-sm text-white/70">
                    Reach rugby coaches and players actively using video analysis. Premium ad placements available.
                  </p>
                </div>
                <div class="shrink-0">
                  <Icon 
                    icon="carbon:arrow-up-right" 
                    class="h-6 w-6 text-white/60 group-hover:text-white transition-colors"
                  />
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
