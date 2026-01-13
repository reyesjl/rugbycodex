<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

import HlsSurfacePlayer from '@/modules/media/components/HlsSurfacePlayer.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import NarrationRecorder from '@/modules/narration/components/NarrationRecorder.vue';

import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import { mediaService } from '@/modules/media/services/mediaService';
import { segmentService } from '@/modules/media/services/segmentService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { toast } from '@/lib/toast';

import { useNarrationRecorder, type NarrationListItem } from '@/modules/narration/composables/useNarrationRecorder';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { Narration } from '@/modules/narrations/types/Narration';

import { formatMinutesSeconds } from '@/lib/duration';
import MediaAssetReviewTimeline from '@/modules/media/components/MediaAssetReviewTimeline.vue';
import MediaAssetReviewNarrationList from '@/modules/media/components/MediaAssetReviewNarrationList.vue';

const BUFFER_SECONDS = 5;

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const membershipRole = computed(() => (orgContext.value?.membership?.role ?? null) as any);
const isStaffOrAbove = computed(() => hasOrgAccess(membershipRole.value, 'staff'));
const currentUserId = computed(() => authStore.user?.id ?? null);

const mediaAssetId = computed(() => String(route.params.mediaAssetId ?? ''));

const loading = ref(true);
const error = ref<string | null>(null);

const asset = ref<OrgMediaAsset | null>(null);
const playlistUrl = ref<string>('');

const segments = ref<MediaAssetSegment[]>([]);
const narrations = ref<Array<Narration | NarrationListItem>>([]);

// Mobile: narrations as a bottom drawer so video stays visible.
const narrationsDrawerOpen = ref(false);
const narrationsDrawerHeightClass = computed(() => (narrationsDrawerOpen.value ? 'h-[70dvh]' : 'h-14'));
const narrationCount = computed(() => (narrations.value as any[])?.length ?? 0);

const playerRef = ref<InstanceType<typeof HlsSurfacePlayer> | null>(null);

const isBuffering = ref(false);
const suppressBufferingUntilMs = ref(0);
const suppressOverlayRevealUntilMs = ref(0);

const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);

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

// Overlay visibility (reused pattern from FeedItem)
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
  showOverlay(null);
}

function onHoverLeave(e: PointerEvent) {
  if (!isMousePointer(e)) return;
  if (isBuffering.value) return;
  showOverlay(800);
}

function onNarrationButtonHoverEnter(e: PointerEvent) {
  if (!isMousePointer(e)) return;
  hideOverlay();
}

onBeforeUnmount(() => {
  hideOverlay();
});

const progress01 = computed(() => {
  const d = duration.value;
  if (!d) return 0;
  return Math.min(1, Math.max(0, (currentTime.value ?? 0) / d));
});

const timeLabel = computed(() => {
  return `${formatMinutesSeconds(currentTime.value ?? 0)} / ${formatMinutesSeconds(duration.value ?? 0)}`;
});

const segmentsWithNarrations = computed(() => {
  const set = new Set<string>();
  for (const n of narrations.value as any[]) {
    const sid = String(n.media_asset_segment_id ?? '');
    if (sid) set.add(sid);
  }
  return set;
});

const activeSegmentId = computed(() => {
  const t = currentTime.value ?? 0;
  const found = segments.value.find((s) => t >= (s.start_seconds ?? 0) && t <= (s.end_seconds ?? 0));
  return found ? String(found.id) : null;
});

function findFocusedSegmentId(seconds: number): string | null {
  const list = segments.value;
  if (!list.length) return null;

  // Prefer a segment that contains the time.
  const inside = list.find((s) => seconds >= (s.start_seconds ?? 0) && seconds <= (s.end_seconds ?? 0));
  if (inside) return String(inside.id);

  // Otherwise choose the nearest segment start.
  let bestId: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of list) {
    const dist = Math.abs((s.start_seconds ?? 0) - seconds);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = String(s.id);
    }
  }
  return bestId;
}

const focusedSegmentId = ref<string | null>(null);

async function load() {
  if (!activeOrgId.value || !mediaAssetId.value) return;
  loading.value = true;
  error.value = null;
  asset.value = null;
  playlistUrl.value = '';
  segments.value = [];
  narrations.value = [];

  try {
    const found = await mediaService.getById(activeOrgId.value, mediaAssetId.value);
    asset.value = found;

    playlistUrl.value = await mediaService.getPresignedHlsPlaylistUrl(activeOrgId.value, found.id, found.bucket);

    // Load existing segments and narrations for this asset.
    const [segList, narList] = await Promise.all([
      segmentService.listSegmentsForMediaAsset(found.id),
      narrationService.listNarrationsForMediaAsset(found.id),
    ]);

    segments.value = segList;
    narrations.value = narList;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load review.';
  } finally {
    loading.value = false;
  }
}

watch([activeOrgId, mediaAssetId], () => {
  if (!activeOrgId.value || !mediaAssetId.value) return;
  void load();
}, { immediate: true });

function handleTimeupdate(p: { currentTime: number; duration: number }) {
  currentTime.value = p.currentTime ?? 0;
  if (p.duration) duration.value = p.duration;

  // When we're essentially at the end, some browsers can briefly emit `waiting`.
  // Don't show buffering over a natural end-of-playback pause.
  const d = duration.value ?? 0;
  if (d > 0 && currentTime.value >= d - 0.05) {
    suppressBufferingUntilMs.value = Date.now() + 1000;
    isBuffering.value = false;
  }

  // Keep focused segment aligned with playback, but don't force it if unset and no segments.
  focusedSegmentId.value = findFocusedSegmentId(currentTime.value);
}

function handleLoadedMetadata(p: { duration: number }) {
  if (p.duration) duration.value = p.duration;

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
}

watch([volume01, muted], () => {
  applyVolumeToPlayer();
});

function handlePlay() {
  isPlaying.value = true;
}

function handlePause() {
  isPlaying.value = false;
  isBuffering.value = false;
}

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
  playerRef.value?.togglePlayback();
}

function scrubToSeconds(seconds: number) {
  focusedSegmentId.value = findFocusedSegmentId(seconds);
  playerRef.value?.setCurrentTime(seconds);
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
  isBuffering.value = next;
  if (next) hideOverlay();
}

// Recording (reuse useNarrationRecorder)
const recorder = useNarrationRecorder();
const recordError = ref<string | null>(null);

function getTimeSeconds(): number {
  return playerRef.value?.getCurrentTime() ?? 0;
}

async function beginRecording() {
  recordError.value = null;

  if (!activeOrgId.value || !asset.value) {
    recordError.value = 'Missing organization or media asset.';
    return;
  }

  const t = getTimeSeconds();
  const d = duration.value ?? 0;

  const startSeconds = Math.max(0, t - BUFFER_SECONDS);
  const endSeconds = d > 0 ? Math.min(d, t + BUFFER_SECONDS) : (t + BUFFER_SECONDS);

  // Create a segment FIRST so the narration has a segment to attach to.
  // Staff+ uses coach segments; members use member segments.
  const created = await (isStaffOrAbove.value
    ? segmentService.createCoachSegment({
        mediaAssetId: asset.value.id,
        startSeconds,
        endSeconds,
      })
    : segmentService.createMemberSegment({
    mediaAssetId: asset.value.id,
    startSeconds,
    endSeconds,
      }));

  // Optimistic segment insert.
  segments.value = [...segments.value, created].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));

  // Start recording with segment context.
  await recorder.startRecording({
    orgId: activeOrgId.value,
    mediaAssetId: asset.value.id,
    mediaAssetSegmentId: String(created.id),
    timeSeconds: t,
  });
}

function endRecordingNonBlocking() {
  const result = recorder.stopRecording();
  if (!result) return;

  // optimistic insert into the overall narrations list
  narrations.value = [...narrations.value, result.optimistic as any];

  result.promise
    .then((saved) => {
      narrations.value = (narrations.value as any[]).map((n) => (n.id === result.optimistic.id ? saved : n));
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to process narration.';
      narrations.value = (narrations.value as any[]).map((n) => {
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

async function toggleRecord() {
  showOverlay(null);
  if (recorder.isRecording.value) {
    endRecordingNonBlocking();
  } else {
    try {
      await beginRecording();
    } catch (err) {
      recordError.value = err instanceof Error ? err.message : 'Failed to start recording.';
    }
  }
}

function jumpToSegment(seg: MediaAssetSegment) {
  focusedSegmentId.value = String(seg.id);
  scrubToSeconds(seg.start_seconds ?? 0);
  showOverlay();
}

async function handleEditNarration(narrationId: string, transcriptRaw: string) {
  const existing = (narrations.value as any[]).find((n) => String(n?.id) === narrationId) as Narration | undefined;
  if (!isStaffOrAbove.value) {
    const authorId = existing?.author_id ?? null;
    if (!authorId || !currentUserId.value || authorId !== currentUserId.value) {
      toast({ message: 'You can only edit your own narrations.', variant: 'info', durationMs: 2500 });
      return;
    }
  }
  try {
    const updated = await narrationService.updateNarrationText(narrationId, transcriptRaw);
    narrations.value = (narrations.value as any[]).map((n) => (String(n.id) === narrationId ? updated : n));
    toast({ message: 'Narration updated.', variant: 'success', durationMs: 1500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update narration.';
    toast({ message, variant: 'error' });
  }
}

async function handleDeleteNarration(narrationId: string) {
  const existing = (narrations.value as any[]).find((n) => String(n?.id) === narrationId) as Narration | undefined;
  if (!isStaffOrAbove.value) {
    const authorId = existing?.author_id ?? null;
    if (!authorId || !currentUserId.value || authorId !== currentUserId.value) {
      toast({ message: 'You can only delete your own narrations.', variant: 'info', durationMs: 2500 });
      return;
    }
  }
  try {
    await narrationService.deleteNarration(narrationId);
    narrations.value = (narrations.value as any[]).filter((n) => String(n.id) !== narrationId);
    toast({ message: 'Narration deleted.', variant: 'success', durationMs: 1500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete narration.';
    toast({ message, variant: 'error' });
  }
}
</script>

<template>
  <div
    class="w-full bg-black
           h-[calc(100dvh-var(--main-nav-height))] overflow-hidden
           md:h-auto md:overflow-visible md:min-h-[calc(100dvh-var(--main-nav-height))]"
  >
    <div class="container-lg pb-16 md:pb-20 text-white space-y-4 h-full">
      <!-- <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-2xl font-semibold">Review</div>
          <div class="mt-1 text-sm text-white/60">
            Full-match review
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs text-white/50">Time</div>
          <div class="text-sm tabular-nums">{{ timeLabel }}</div>
        </div>
      </div> -->

      <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        Loading media…
      </div>

      <div v-else-if="error" class="rounded-lg border border-white/10 bg-white/5 p-6 text-rose-200">
        {{ error }}
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-5">
        <!-- Player column -->
        <div class="md:col-span-3 space-y-3">
          <!-- Mobile: full-bleed video surface (like Feed); md+: rounded container -->
          <div class="-mx-4 md:mx-0">
            <div class="overflow-hidden bg-black ring-1 ring-white/10 md:rounded-xl md:bg-white/5">
              <div
                class="relative aspect-video bg-black"
                @pointermove="onHoverMove"
                @pointerleave="onHoverLeave"
              >
              <HlsSurfacePlayer
                ref="playerRef"
                :src="playlistUrl"
                :autoplay="false"
                class="h-full w-full"
                @timeupdate="handleTimeupdate"
                @loadedmetadata="handleLoadedMetadata"
                @play="handlePlay"
                @pause="handlePause"
                @error="(m) => (error = m)"
                @buffering="handleBuffering"
              />

              <FeedGestureLayer @tap="onTap" @swipeDown="() => {}" @swipeUp="() => {}">
                <!-- Reuse feed overlay controls as a minimal transport + scrubber -->
                <FeedOverlayControls
                  :visible="overlayVisible && !isBuffering"
                  :is-playing="isPlaying"
                  :progress01="progress01"
                  :can-prev="false"
                  :can-next="false"
                  :show-restart="false"
                  :current-seconds="currentTime"
                  :duration-seconds="duration"
                  :volume01="volume01"
                  :muted="muted"
                  @togglePlay="togglePlay"
                  @prev="() => {}"
                  @next="() => {}"
                  @restart="() => scrubToSeconds(0)"
                  @cc="() => {}"
                  @settings="() => {}"
                  @scrubToSeconds="scrubToSeconds"
                  @scrubStart="() => showOverlay(null)"
                  @scrubEnd="() => showOverlay(1500)"
                  @setVolume01="setVolume"
                  @toggleMute="toggleMute"
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
            </div>
          </div>

          <MediaAssetReviewTimeline
            :duration-seconds="duration"
            :current-seconds="currentTime"
            :segments="segments"
            :segments-with-narrations="segmentsWithNarrations"
            @seek="scrubToSeconds"
          />

          <div class="md:hidden text-xs text-white/50 tabular-nums">
            {{ timeLabel }}
          </div>

          <div v-if="recordError" class="text-xs text-rose-200">
            {{ recordError }}
          </div>
          <div v-else-if="recorder.lastError.value" class="text-xs text-rose-200">
            {{ recorder.lastError.value }}
          </div>

          <div class="text-xs text-white/40 space-y-1">
            <div>
              Desktop: click video to play/pause. Touch: tap video to show controls, then tap play/pause.
            </div>
            <div>
              Seek: drag the scrubber controls or drag the timeline. Zoom: scroll/pinch the timeline; while zoomed you can drag past the ends to keep scrubbing.
            </div>
            <div>
              Narration: use the mic button to start/stop recording a voice note tied to the current moment.
            </div>
          </div>
        </div>

        <!-- Right column: segments + narrations -->
        <div class="hidden md:block md:col-span-2">
          <div
            class="-mx-4 px-4 md:mx-0 md:px-4 bg-black md:rounded-xl md:border md:border-white/10 md:bg-white/5 md:p-4 md:sticky md:top-6 md:max-h-[calc(100dvh-var(--main-nav-height)-3rem)] md:overflow-y-auto overscroll-contain"
          >
            <MediaAssetReviewNarrationList
              :segments="segments"
              :narrations="(narrations as any)"
              :active-segment-id="activeSegmentId"
              :focused-segment-id="focusedSegmentId"
              :default-source-type="isStaffOrAbove ? 'coach' : 'member'"
              :can-moderate-narrations="isStaffOrAbove"
              :current-user-id="currentUserId"
              @jumpToSegment="jumpToSegment"
              @editNarration="handleEditNarration"
              @deleteNarration="handleDeleteNarration"
            />
          </div>
        </div>
      </div>

      <!-- Mobile-only narrations drawer -->
      <div
        class="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-black/95 backdrop-blur border-t border-white/10 transition-[height] duration-200 ease-out"
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

        <div
          v-show="narrationsDrawerOpen"
          class="h-[calc(70dvh-3.5rem)] overflow-y-auto overscroll-contain px-4 pb-6"
        >
          <MediaAssetReviewNarrationList
            :segments="segments"
            :narrations="(narrations as any)"
            :active-segment-id="activeSegmentId"
            :focused-segment-id="focusedSegmentId"
            :default-source-type="isStaffOrAbove ? 'coach' : 'member'"
            :can-moderate-narrations="isStaffOrAbove"
            :current-user-id="currentUserId"
            @jumpToSegment="(seg) => { jumpToSegment(seg); narrationsDrawerOpen = false; }"
            @editNarration="handleEditNarration"
            @deleteNarration="handleDeleteNarration"
          />
        </div>
      </div>
    </div>
  </div>
</template>
