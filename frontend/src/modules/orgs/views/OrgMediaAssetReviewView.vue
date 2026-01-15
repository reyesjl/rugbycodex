<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

import HlsSurfacePlayer from '@/modules/media/components/HlsSurfacePlayer.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import NarrationRecorder from '@/modules/narration/components/NarrationRecorder.vue';

import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import { segmentService } from '@/modules/media/services/segmentService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { toast } from '@/lib/toast';
import { computeSegmentBounds } from '@/modules/media/utils/segmentBounds';
import { useMediaAssetReview } from '@/modules/media/composables/useMediaAssetReview';
import { useVideoOverlayControls } from '@/modules/media/composables/useVideoOverlayControls';
import { useSegmentPlayback } from '@/modules/media/composables/useSegmentPlayback';

import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';
import MatchSummaryBlock from '@/modules/analysis/components/MatchSummaryBlock.vue';

import { useAudioRecording } from '@/composables/useAudioRecording';
import { transcriptionService } from '@/modules/narrations/services/transcriptionService';
import type { OptimisticNarration } from '@/modules/narration/composables/useNarrationRecorder';
import type { MediaAssetSegment, MediaAssetSegmentSourceType } from '@/modules/narrations/types/MediaAssetSegment';
import type { Narration, NarrationSourceType } from '@/modules/narrations/types/Narration';
import type { SegmentTagType } from '@/modules/media/types/SegmentTag';

import { formatMinutesSeconds } from '@/lib/duration';
import MediaAssetReviewTimeline from '@/modules/media/components/MediaAssetReviewTimeline.vue';
import MediaAssetReviewNarrationList from '@/modules/media/components/MediaAssetReviewNarrationList.vue';
import AssignSegmentModal from '@/modules/assignments/components/AssignSegmentModal.vue';

const PRE_BUFFER_SECONDS = 5;
const POST_BUFFER_SECONDS = 10;
const MERGE_BUFFER_SECONDS = 5;
const MIN_OVERLAP_SECONDS = 5;

const DEBUG = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  console.debug('[OrgMediaAssetReviewView]', ...args);
}

function computeOverlapSeconds(
  startSeconds: number,
  endSeconds: number,
  candidateStart: number,
  candidateEnd: number
): number {
  return Math.max(0, Math.min(endSeconds, candidateEnd) - Math.max(startSeconds, candidateStart));
}

function clampEndSeconds(endSeconds: number, mediaDuration: number): number {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) return endSeconds;
  return Math.min(mediaDuration, endSeconds);
}

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const membershipRole = computed(() => (orgContext.value?.membership?.role ?? null) as any);
const isStaffOrAbove = computed(() => hasOrgAccess(membershipRole.value, 'staff'));
const currentUserId = computed(() => authStore.user?.id ?? null);

const userSegmentSourceType = computed<MediaAssetSegmentSourceType>(() => {
  const raw = String(membershipRole.value ?? '').toLowerCase();

  if (raw === 'owner') return 'owner';
  if (raw === 'staff') return 'staff';
  if (raw === 'manager') return 'manager';
  if (raw === 'member') return 'member';

  // Treat any staff-like roles (admin/owner/etc) as staff for segment source.
  if (isStaffOrAbove.value) return 'staff';
  return 'member';
});

const defaultNarrationSource = computed(() => {
  const raw = String(membershipRole.value ?? '').toLowerCase();
  if (raw === 'member') return 'member';
  if (raw === 'coach') return 'all';
  if (isStaffOrAbove.value) return 'all';
  return 'member';
});

type NarrationSourceFilter = 'all' | NarrationSourceType;

function normalizeNarrationSource(value: unknown): NarrationSourceFilter {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'coach' || raw === 'staff' || raw === 'member' || raw === 'ai') {
    return raw as NarrationSourceFilter;
  }
  return 'all';
}

const narrationSourceFilter = ref<NarrationSourceFilter>('all');
const hasNarrationSourceSelection = ref(false);
const narrationVisibleSegmentIds = ref<string[]>([]);

function handleNarrationSourceFilterChange(next: NarrationSourceFilter) {
  narrationSourceFilter.value = next;
  hasNarrationSourceSelection.value = true;
}

function handleVisibleSegmentsChange(segmentIds: string[]) {
  narrationVisibleSegmentIds.value = segmentIds.map((id) => String(id));
}

watch(
  defaultNarrationSource,
  (next) => {
    if (hasNarrationSourceSelection.value) return;
    narrationSourceFilter.value = normalizeNarrationSource(next);
  },
  { immediate: true }
);

const mediaAssetId = computed(() => String(route.params.mediaAssetId ?? ''));

const canGenerateMatchSummary = computed(() => {
  const raw = String(membershipRole.value ?? '').toLowerCase();
  return raw === 'owner' || raw === 'manager' || raw === 'staff';
});

const mediaReview = useMediaAssetReview({
  orgId: () => activeOrgId.value,
  mediaAssetId: () => mediaAssetId.value,
  canGenerateMatchSummary: () => canGenerateMatchSummary.value,
});

const {
  loading,
  error,
  asset,
  playlistUrl,
  segments,
  narrations,
  matchSummary,
  matchSummaryLoading,
  matchSummaryError,
  addSegmentTag,
  removeSegmentTag,
  generateMatchSummary,
} = mediaReview;

const narrationTargetSegmentId = ref<string | null>(null);

const activeOrgIdOrEmpty = computed(() => activeOrgId.value ?? '');
const assigningSegment = ref<MediaAssetSegment | null>(null);

watch(
  [activeOrgId, mediaAssetId],
  () => {
    narrationTargetSegmentId.value = null;
    narrationVisibleSegmentIds.value = [];
  },
  { immediate: true }
);

function upsertSegment(next: MediaAssetSegment): void {
  const nextId = String(next.id);
  const existing = segments.value.find((seg) => String(seg.id) === nextId);
  const merged: MediaAssetSegment = existing
    ? { ...existing, ...next, tags: existing.tags ?? next.tags }
    : { ...next, tags: next.tags ?? [] };

  const updated = existing
    ? segments.value.map((seg) => (String(seg.id) === nextId ? merged : seg))
    : [...segments.value, merged];

  segments.value = updated.sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
}

async function handleAddSegmentTag(payload: { segmentId: string; tagKey: string; tagType: SegmentTagType }) {
  if (!payload.segmentId) return;
  try {
    const tag = await addSegmentTag({
      segmentId: String(payload.segmentId),
      tagKey: payload.tagKey,
      tagType: payload.tagType,
    });
    if (!tag) return;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to add tag.';
    toast({ message, variant: 'error', durationMs: 2600 });
  }
}

async function handleRemoveSegmentTag(payload: { segmentId: string; tagId: string }) {
  if (!payload.segmentId || !payload.tagId) return;
  try {
    const removed = await removeSegmentTag({
      segmentId: String(payload.segmentId),
      tagId: String(payload.tagId),
    });
    if (!removed) return;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to remove tag.';
    toast({ message, variant: 'error', durationMs: 2600 });
  }
}

function labelForSegment(seg: MediaAssetSegment): string {
  const start = formatMinutesSeconds(seg.start_seconds ?? 0);
  const end = formatMinutesSeconds(seg.end_seconds ?? 0);
  const kind = seg.source_type ? String(seg.source_type).toUpperCase() : 'SEG';
  return `${kind} • ${start}–${end}`;
}

function openAssignSegment(seg: MediaAssetSegment) {
  if (!isStaffOrAbove.value) return;
  assigningSegment.value = seg;
}

function closeAssignSegment() {
  assigningSegment.value = null;
}

// Mobile: narrations as a bottom drawer so video stays visible.
const narrationsDrawerOpen = ref(false);
const narrationsDrawerHeightClass = computed(() => (narrationsDrawerOpen.value ? 'h-[70dvh]' : 'h-14'));
const narrationCount = computed(() => (narrations.value as any[])?.length ?? 0);

const matchSummaryState = computed<MatchSummaryState>(() => {
  return matchSummary.value?.state ?? 'empty';
});

const matchSummaryBullets = computed(() => {
  if (matchSummaryState.value !== 'normal') return [];
  if (matchSummary.value?.state !== 'normal') return [];
  return (matchSummary.value?.bullets ?? []).filter(Boolean);
});

const playerRef = ref<InstanceType<typeof HlsSurfacePlayer> | null>(null);
const surfaceEl = ref<HTMLElement | null>(null);

const videoEl = computed(() => (playerRef.value?.getVideoElement?.() ?? null) as HTMLVideoElement | null);

const isPlaying = ref(false);

// Moved shared playback/progress tracking out of OrgMediaAssetReviewView.
const segmentPlayback = useSegmentPlayback({
  getPlayer: () => playerRef.value,
  segmentStartSeconds: computed(() => 0),
  segmentEndSeconds: computed(() => 0),
  isActive: computed(() => true),
  isPlaying,
  enableWatchedHalf: false,
});

const {
  currentTime,
  duration,
  progress01,
  suppressBufferingUntilMs,
  handleTimeupdate: handleSegmentTimeupdate,
  handleLoadedMetadata: handleSegmentLoadedMetadata,
  seekRelative: seekRelativeInternal,
  scrubToSegmentSeconds: scrubToSecondsInternal,
} = segmentPlayback;

// Moved overlay + gesture + fullscreen controls out of OrgMediaAssetReviewView.
const overlayControls = useVideoOverlayControls({
  getVideoEl: () => videoEl.value,
  getSurfaceEl: () => surfaceEl.value,
  getPlayer: () => playerRef.value,
  isPlaying,
  onTogglePlay: () => playerRef.value?.togglePlayback(),
  onSeekRelative: (deltaSeconds) => seekRelative(deltaSeconds),
  suppressBufferingUntilMs,
  requireElementForFullscreen: true,
  onFullscreenError: () => {
    toast({ message: 'Fullscreen is not available in this browser.', variant: 'info', durationMs: 2500 });
  },
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
  requestTogglePlay,
  flashPlayPause,
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

function seekRelative(deltaSeconds: number) {
  seekRelativeInternal(deltaSeconds);
  suppressBufferingUntilMs.value = Date.now() + 500;
  isBuffering.value = false;
}

function handleTimeupdate(p: { currentTime: number; duration: number }) {
  const previousDuration = duration.value;
  handleSegmentTimeupdate(p);
  if (!p.duration && previousDuration) {
    duration.value = previousDuration;
  }

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
  handleSegmentLoadedMetadata(p);

  // Sync volume state from the actual video element once it's available.
  syncVolumeFromPlayer();
  applyVolumeToPlayer();
}

function handlePlay() {
  isPlaying.value = true;
  flashPlayPause('play');
}

function handlePause() {
  isPlaying.value = false;
  isBuffering.value = false;
  flashPlayPause('pause');
}

function scrubToSeconds(seconds: number) {
  focusedSegmentId.value = findFocusedSegmentId(seconds);
  if (!duration.value) {
    playerRef.value?.setCurrentTime(seconds);
    return;
  }
  scrubToSecondsInternal(seconds);
}

onBeforeUnmount(() => {
  restoreVideoMuteAfterRecording();
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

// Recording (segment created when narration saves)
const recorder = useAudioRecording();
const recordError = ref<string | null>(null);
const recordingUploadError = ref<string | null>(null);
const recordStartVideoTime = ref<number | null>(null);
const recordStartWallClockMs = ref<number | null>(null);

const mutedBeforeRecording = ref<boolean | null>(null);

async function handleAddNarrationForSegment(seg: MediaAssetSegment) {
  narrationTargetSegmentId.value = String(seg.id);
  focusedSegmentId.value = String(seg.id);

  if (recorder.isRecording.value) return;

  try {
    await beginRecording();
  } catch (err) {
    narrationTargetSegmentId.value = null;
    recordError.value = err instanceof Error ? err.message : 'Failed to start recording.';
    return;
  }

  if (!recorder.isRecording.value) {
    narrationTargetSegmentId.value = null;
  }
}

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

function getTimeSeconds(): number {
  return playerRef.value?.getCurrentTime() ?? 0;
}

async function beginRecording() {
  recordError.value = null;
  recordingUploadError.value = null;

  if (!activeOrgId.value || !asset.value) {
    recordError.value = 'Missing organization or media asset.';
    return;
  }

  if (membershipRole.value === null || membershipRole.value === undefined) {
    recordError.value = 'Missing membership role. Please reload and try again.';
    return;
  }

  if (!recorder.isRecording.value && recorder.hasRecording.value) {
    recorder.resetRecording();
  }

  // Start recording.
  // Mute the video before recording to avoid bleeding audio into the mic capture.
  muteVideoForRecording();
  try {
    await recorder.startRecording();
    if (!recorder.isRecording.value) {
      throw new Error(recorder.error.value ?? 'Failed to start recording.');
    }

    const recordStartSeconds = getTimeSeconds();
    recordStartVideoTime.value = recordStartSeconds;
    recordStartWallClockMs.value = Date.now();
    debugLog('recording started', {
      recordStartVideoTime: recordStartSeconds,
      wallClockStartMs: recordStartWallClockMs.value,
    });
  } catch (err) {
    recordStartVideoTime.value = null;
    recordStartWallClockMs.value = null;
    restoreVideoMuteAfterRecording();
    throw err;
  }
}

async function endRecordingNonBlocking() {
  if (!recorder.isRecording.value) return;

  recordingUploadError.value = null;
  const startVideoTime = recordStartVideoTime.value;
  const startWallClockMs = recordStartWallClockMs.value;
  recordStartVideoTime.value = null;
  recordStartWallClockMs.value = null;

  const wallClockEndMs = Date.now();
  const recordingDurationSeconds =
    startWallClockMs !== null ? Math.max(0, (wallClockEndMs - startWallClockMs) / 1000) : 0;

  let blobPromise: Promise<Blob>;
  try {
    blobPromise = recorder.stopRecordingAndGetBlob();
  } catch (err) {
    recordError.value = err instanceof Error ? err.message : 'Failed to stop recording.';
    return;
  }

  // Stop recording first, then restore the user's prior mute state.
  restoreVideoMuteAfterRecording();

  if (!activeOrgId.value || !asset.value) {
    recordingUploadError.value = 'Missing organization or media asset.';
    void blobPromise.catch(() => {});
    return;
  }

  const orgId = activeOrgId.value;
  if (!orgId) {
    recordingUploadError.value = 'Missing organization.';
    void blobPromise.catch(() => {});
    return;
  }
  const mediaAssetId = asset.value.id;

  if (startVideoTime === null || startWallClockMs === null) {
    recordingUploadError.value = 'Missing recording start time.';
    void blobPromise.catch(() => {});
    return;
  }

  debugLog('recording stopped', {
    wallClockEndMs,
    recordingDurationSeconds,
  });

  const mediaDuration = duration.value ?? 0;
  const recordingEndSeconds = startVideoTime + recordingDurationSeconds;
  const bounds = computeSegmentBounds(
    startVideoTime,
    recordingDurationSeconds,
    mediaDuration,
    PRE_BUFFER_SECONDS,
    POST_BUFFER_SECONDS
  );
  const extendSeconds = Math.max(0, recordingDurationSeconds) + MERGE_BUFFER_SECONDS;
  debugLog('segment bounds computed', {
    recordStartVideoTime: startVideoTime,
    recordingDurationSeconds,
    mediaDuration,
    ...bounds,
  });

  const explicitSegmentId = narrationTargetSegmentId.value ? String(narrationTargetSegmentId.value) : null;
  if (explicitSegmentId) narrationTargetSegmentId.value = null;

  let targetSegment: MediaAssetSegment | null = null;
  let createdSegment: MediaAssetSegment | null = null;

  if (explicitSegmentId) {
    const existing = segments.value.find((seg) => String(seg.id) === explicitSegmentId) ?? null;
    if (!existing) {
      recordingUploadError.value = 'Selected segment no longer exists.';
      void blobPromise.catch(() => {});
      return;
    }
    let resolved = existing;
    const desiredEndSeconds = clampEndSeconds((resolved.end_seconds ?? 0) + extendSeconds, mediaDuration);
    if (desiredEndSeconds > (resolved.end_seconds ?? 0)) {
      try {
        resolved = await segmentService.updateSegmentBounds({
          segmentId: String(resolved.id),
          startSeconds: resolved.start_seconds ?? 0,
          endSeconds: desiredEndSeconds,
        });
      } catch (err) {
        debugLog('segment bounds update failed', err);
      }
    }
    targetSegment = resolved;
    upsertSegment(resolved);
  } else {
    try {
      const overlapStartSeconds = startVideoTime;
      const overlapEndSeconds = recordingEndSeconds;
      const overlapping = await segmentService.findBestOverlappingSegment({
        mediaAssetId,
        startSeconds: overlapStartSeconds,
        endSeconds: overlapEndSeconds,
      });

      let resolvedOverlap = overlapping;
      if (resolvedOverlap) {
        const overlapSeconds = computeOverlapSeconds(
          overlapStartSeconds,
          overlapEndSeconds,
          resolvedOverlap.start_seconds ?? 0,
          resolvedOverlap.end_seconds ?? 0
        );
        if (overlapSeconds < MIN_OVERLAP_SECONDS) {
          resolvedOverlap = null;
        }
      }

      if (resolvedOverlap) {
        let resolved = resolvedOverlap;
        const desiredEndSeconds = clampEndSeconds((resolved.end_seconds ?? 0) + extendSeconds, mediaDuration);
        if (desiredEndSeconds > (resolved.end_seconds ?? 0)) {
          try {
            resolved = await segmentService.updateSegmentBounds({
              segmentId: String(resolved.id),
              startSeconds: resolved.start_seconds ?? 0,
              endSeconds: desiredEndSeconds,
            });
          } catch (err) {
            debugLog('segment bounds update failed', err);
          }
        }

        targetSegment = resolved;
        upsertSegment(resolved);
        debugLog('segment matched', { segmentId: resolved.id });
      } else {
        createdSegment = await segmentService.createSegment({
          mediaAssetId,
          startSeconds: bounds.startSeconds,
          endSeconds: bounds.endSeconds,
          sourceType: userSegmentSourceType.value,
        });
        targetSegment = createdSegment;
        upsertSegment(createdSegment);
        debugLog('segment inserted', { segmentId: createdSegment.id });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create segment.';
      recordingUploadError.value = message;
      void blobPromise.catch(() => {});
      return;
    }
  }

  if (!targetSegment) {
    recordingUploadError.value = 'Missing target segment.';
    void blobPromise.catch(() => {});
    return;
  }

  const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const optimistic: OptimisticNarration = {
    id: optimisticId,
    org_id: orgId,
    media_asset_id: mediaAssetId,
    media_asset_segment_id: String(targetSegment.id),
    author_id: null,
    audio_storage_path: null,
    created_at: new Date(),
    transcript_raw: 'Uploading…',
    status: 'uploading',
  };

  // optimistic insert into the overall narrations list
  narrations.value = [...narrations.value, optimistic];

  Promise.resolve()
    .then(async () => {
      const audioBlob = await blobPromise;
      const { text } = await transcriptionService.transcribeAudio(audioBlob);
      return narrationService.createNarration({
        orgId,
        mediaAssetId,
        mediaAssetSegmentId: String(targetSegment.id),
        transcriptRaw: text?.trim() ? text.trim() : '(No transcript)',
      });
    })
    .then((saved) => {
      narrations.value = (narrations.value as any[]).map((n) => (n.id === optimisticId ? saved : n));
      toast({ message: 'Narration added.', variant: 'success', durationMs: 2000 });
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to process narration.';
      recordingUploadError.value = message;
      narrations.value = (narrations.value as any[]).map((n) => {
        if (n.id !== optimisticId) return n;
        return {
          ...optimistic,
          status: 'error',
          transcript_raw: 'Upload failed',
          errorMessage: message,
        };
      });
      if (createdSegment) {
        void segmentService
          .deleteSegment(String(createdSegment.id))
          .then(() => {
            segments.value = segments.value.filter((seg) => String(seg.id) !== String(createdSegment.id));
          })
          .catch((cleanupErr) => {
            debugLog('segment cleanup failed', cleanupErr);
          });
      }
    });
}

async function toggleRecord() {
  showOverlay(null);
  if (recorder.isRecording.value) {
    void endRecordingNonBlocking();
  } else {
    try {
      await beginRecording();
    } catch (err) {
      recordError.value = err instanceof Error ? err.message : 'Failed to start recording.';
    }
  }
}

watch(
  () => recorder.isRecording.value,
  (isRec) => {
    if (isRec) muteVideoForRecording();
    else restoreVideoMuteAfterRecording();
  }
);

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
                ref="surfaceEl"
                class="relative bg-black"
                :class="isFullscreen ? 'h-full w-full' : 'aspect-video'"
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

                <!-- Reuse feed overlay controls as a minimal transport + scrubber -->
                <FeedOverlayControls
                  :visible="overlayVisible && !isBuffering"
                  :is-playing="isPlaying"
                  :progress01="progress01"
                  :can-prev="false"
                  :can-next="false"
                  :show-prev-next="false"
                  :show-restart="false"
                  :can-fullscreen="canFullscreen"
                  :is-fullscreen="isFullscreen"
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
            </div>
          </div>

          <MediaAssetReviewTimeline
            :duration-seconds="duration"
            :current-seconds="currentTime"
            :segments="segments"
            :segments-with-narrations="segmentsWithNarrations"
            :visible-segment-ids="narrationVisibleSegmentIds"
            :active-segment-id="activeSegmentId"
            :focused-segment-id="focusedSegmentId"
            :only-narrated-markers="true"
            @seek="scrubToSeconds"
            @jumpToSegment="jumpToSegment"
          />

          <div class="md:hidden text-xs text-white/50 tabular-nums">
            {{ timeLabel }}
          </div>

          <div v-if="recordError" class="text-xs text-rose-200">
            {{ recordError }}
          </div>
          <div v-else-if="recordingUploadError" class="text-xs text-rose-200">
            {{ recordingUploadError }}
          </div>
          <div v-else-if="recorder.error.value" class="text-xs text-rose-200">
            {{ recorder.error.value }}
          </div>
        </div>

        <!-- Right column: segments + narrations -->
        <div class="hidden md:block md:col-span-2">
          <div
            class="-mx-4 px-4 md:mx-0 md:px-4 bg-black md:rounded-xl md:border md:border-white/10 md:bg-white/5 md:p-4 md:sticky md:top-6 md:max-h-[calc(100dvh-var(--main-nav-height)-3rem)] md:overflow-y-auto overscroll-contain"
          >
            <div
              v-if="canGenerateMatchSummary"
              class="mb-3"
            >
              <MatchSummaryBlock
                :state="matchSummaryState"
                :bullets="matchSummaryBullets"
                :loading="matchSummaryLoading"
                :error="matchSummaryError"
                :can-generate="canGenerateMatchSummary"
                :has-generated="Boolean(matchSummaryBullets.length)"
                @generate="generateMatchSummary({ forceRefresh: true })"
              />
            </div>

            <MediaAssetReviewNarrationList
              :segments="segments"
              :narrations="(narrations as any)"
              :active-segment-id="activeSegmentId"
              :focused-segment-id="focusedSegmentId"
              :default-source="defaultNarrationSource"
              :source-filter="narrationSourceFilter"
              :can-moderate-narrations="isStaffOrAbove"
              :current-user-id="currentUserId"
              @jumpToSegment="jumpToSegment"
              @addNarration="handleAddNarrationForSegment"
              @assignSegment="openAssignSegment"
              @editNarration="handleEditNarration"
              @deleteNarration="handleDeleteNarration"
              @addTag="handleAddSegmentTag"
              @removeTag="handleRemoveSegmentTag"
              @update:sourceFilter="handleNarrationSourceFilterChange"
              @visibleSegmentsChange="handleVisibleSegmentsChange"
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
          <div
            v-if="canGenerateMatchSummary"
            class="mt-3 mb-3"
          >
            <MatchSummaryBlock
              :state="matchSummaryState"
              :bullets="matchSummaryBullets"
              :loading="matchSummaryLoading"
              :error="matchSummaryError"
              :can-generate="canGenerateMatchSummary"
              :has-generated="Boolean(matchSummaryBullets.length)"
              @generate="generateMatchSummary({ forceRefresh: true })"
            />
          </div>

          <MediaAssetReviewNarrationList
            :segments="segments"
            :narrations="(narrations as any)"
            :active-segment-id="activeSegmentId"
            :focused-segment-id="focusedSegmentId"
            :default-source="defaultNarrationSource"
            :source-filter="narrationSourceFilter"
            :can-moderate-narrations="isStaffOrAbove"
            :current-user-id="currentUserId"
            @jumpToSegment="(seg) => { jumpToSegment(seg); narrationsDrawerOpen = false; }"
            @addNarration="handleAddNarrationForSegment"
            @assignSegment="openAssignSegment"
            @editNarration="handleEditNarration"
            @deleteNarration="handleDeleteNarration"
            @addTag="handleAddSegmentTag"
            @removeTag="handleRemoveSegmentTag"
            @update:sourceFilter="handleNarrationSourceFilterChange"
            @visibleSegmentsChange="handleVisibleSegmentsChange"
          />
        </div>
      </div>

      <AssignSegmentModal
        v-if="assigningSegment && activeOrgIdOrEmpty"
        :org-id="activeOrgIdOrEmpty"
        :segment-id="String(assigningSegment.id)"
        :segment-label="labelForSegment(assigningSegment)"
        :on-close="closeAssignSegment"
        :on-assigned="closeAssignSegment"
      />
    </div>
  </div>
</template>
