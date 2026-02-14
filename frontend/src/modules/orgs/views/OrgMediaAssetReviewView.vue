<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

import ShakaSurfacePlayer from '@/modules/media/components/ShakaSurfacePlayer.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedOverlayControls from '@/modules/feed/components/FeedOverlayControls.vue';
import NarrationRecorder from '@/modules/narrations/components/NarrationRecorder.vue';
import MediaProcessingStatusBanner from '@/modules/media/components/MediaProcessingStatusBanner.vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';

import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import { segmentService } from '@/modules/media/services/segmentService';
import { segmentAutoTagService } from '@/modules/media/services/segmentAutoTagService';
import { segmentIdentityTagService } from '@/modules/media/services/segmentIdentityTagService';
import { segmentTagSuggestionService } from '@/modules/media/services/segmentTagSuggestionService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { toast } from '@/lib/toast';
import { computeSegmentBounds } from '@/modules/media/utils/segmentBounds';
import { useMediaAssetReview } from '@/modules/media/composables/useMediaAssetReview';
import { useSegmentTagSuggestions } from '@/modules/media/composables/useSegmentTagSuggestions';
import { useSegmentInsights } from '@/modules/analysis/composables/useSegmentInsights';
import { useVideoOverlayControls } from '@/modules/media/composables/useVideoOverlayControls';
import { useSegmentPlayback } from '@/modules/media/composables/useSegmentPlayback';
import { useMediaProcessingStatus } from '@/modules/media/composables/useMediaProcessingStatus';

import { useAudioRecording } from '@/composables/useAudioRecording';
import { transcriptionService } from '@/modules/narrations/services/transcriptionService';
import type { OptimisticNarration } from '@/modules/narrations/composables/useNarrationRecorder';
import type { MediaAssetSegment, MediaAssetSegmentSourceType } from '@/modules/narrations/types/MediaAssetSegment';
import type { NarrationSourceType } from '@/modules/narrations/types/Narration';
import type { SegmentTagType } from '@/modules/media/types/SegmentTag';
import { analysisService } from '@/modules/analysis/services/analysisService';

import { formatMinutesSeconds } from '@/lib/duration';
import MediaAssetReviewTimeline from '@/modules/media/components/MediaAssetReviewTimeline.vue';
import MediaAssetReviewNarrationList from '@/modules/media/components/MediaAssetReviewNarrationList.vue';
import AssignSegmentModal from '@/modules/assignments/components/AssignSegmentModal.vue';
import AddToPlaylistModal from '@/modules/playlists/components/AddToPlaylistModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

const PRE_BUFFER_SECONDS = 3;
const POST_BUFFER_SECONDS = 5;
const MAX_EXTENSION_SECONDS = 6;
const MIN_OVERLAP_PERCENTAGE = 0.5; // 50% of recording duration
const MIN_OVERLAP_ABSOLUTE_SECONDS = 2; // Absolute minimum to prevent noise
const MIN_RECORDING_DURATION_SECONDS = 0.5;
const FRAGMENTATION_OVERLAP_THRESHOLD = 0.8; // 80% overlap = potential fragmentation

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

/**
 * Computes the minimum overlap required for a recording to attach to an existing segment.
 * Rule: At least 50% of EITHER the recording OR the segment must overlap, with a minimum of 2 seconds.
 * This dual threshold handles both long recordings on short segments and short recordings on long segments.
 */
function computeMinimumOverlap(recordingDurationSeconds: number, segmentDurationSeconds: number): number {
  const overlapFromRecording = recordingDurationSeconds * MIN_OVERLAP_PERCENTAGE;
  const overlapFromSegment = segmentDurationSeconds * MIN_OVERLAP_PERCENTAGE;
  
  // Take the SMALLER of the two percentages to ensure it's achievable
  // (e.g., 20s recording on 10s segment: need 5s not 10s)
  const percentageBased = Math.min(overlapFromRecording, overlapFromSegment);
  
  return Math.max(MIN_OVERLAP_ABSOLUTE_SECONDS, percentageBased);
}

function findSegmentContainingTime(list: MediaAssetSegment[], seconds: number): MediaAssetSegment | null {
  let best: MediaAssetSegment | null = null;
  let bestStart = Number.NEGATIVE_INFINITY;

  for (const seg of list) {
    const start = seg.start_seconds ?? 0;
    const end = seg.end_seconds ?? 0;
    if (seconds >= start && seconds <= end) {
      if (best === null || start >= bestStart) {
        best = seg;
        bestStart = start;
      }
    }
  }

  return best;
}

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const membershipRole = computed(() => (orgContext.value?.membership?.role ?? null) as any);
const isStaffOrAbove = computed(() => hasOrgAccess(membershipRole.value, 'staff'));
const currentUserId = computed(() => authStore.user?.id ?? null);

const canAssignSegments = computed(() => isStaffOrAbove.value);
const canTagSegments = computed(() => isStaffOrAbove.value);
const canModerateNarrations = computed(() => isStaffOrAbove.value);
const canTagPlayers = computed(() => authStore.isAdmin || isStaffOrAbove.value);
const canAutoTagSegments = computed(() => authStore.isAdmin || isStaffOrAbove.value);
const canGenerateSegmentInsights = computed(() => authStore.isAdmin || isStaffOrAbove.value);
// Allow all org members to edit/delete narrations (role-based filtering in component)
const canEditNarrations = computed(() => !!currentUserId.value && !!membershipRole.value);
const canDeleteNarrations = computed(() => !!currentUserId.value && !!membershipRole.value);
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
  if (raw === 'coach' || raw === 'staff' || raw === 'member') {
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

const mediaReview = useMediaAssetReview({
  orgId: () => activeOrgId.value,
  mediaAssetId: () => mediaAssetId.value,
  canGenerateMatchSummary: () => false,
});

const {
  loading,
  error,
  asset,
  playlistUrl,
  segments,
  narrations,
  addSegmentTag,
  removeSegmentTag,
  reloadSegmentTags,
} = mediaReview;

const segmentIds = computed(() => segments.value.map((seg) => String(seg.id)).filter(Boolean));
const segmentTagSuggestions = useSegmentTagSuggestions({ segmentIds: () => segmentIds.value });
const { suggestionsBySegmentId, reload: reloadSegmentTagSuggestions } = segmentTagSuggestions;
const segmentInsights = useSegmentInsights({ segmentIds: () => segmentIds.value });
const { insightsBySegmentId, reload: reloadSegmentInsights } = segmentInsights;

// Processing status composable
const mediaAssetRef = computed(() => asset.value);
const { processingStatus } = useMediaProcessingStatus(mediaAssetRef);

const narrationTargetSegmentId = ref<string | null>(null);

// Recording (segment created when narration saves)
const recorder = useAudioRecording();
const recordError = ref<string | null>(null);
const recordingUploadError = ref<string | null>(null);
const recordStartVideoTime = ref<number | null>(null);
const recordStartWallClockMs = ref<number | null>(null);
const mutedBeforeRecording = ref<boolean | null>(null);

// Recording context: captured at start, used when stopping to avoid race conditions
type RecordingContext = {
  targetSegmentId: string | null;
  orgId: string;
  mediaAssetId: string;
  membershipRole: string;
  focusAtStart: string | null;
};
const recordingContext = ref<RecordingContext | null>(null);

// Track active optimistic narrations to avoid duplicates and enable cleanup
const activeOptimisticIds = ref<Set<string>>(new Set());

// Track narrations that are processing embeddings (5-second safety window)
const processingNarrationIds = ref<Map<string, number>>(new Map());

const activeOrgIdOrEmpty = computed(() => activeOrgId.value ?? '');
const assigningSegment = ref<MediaAssetSegment | null>(null);
const playlistSegment = ref<MediaAssetSegment | null>(null);
const pendingEmptySegmentIds = ref<string[]>([]);
const showDeleteEmptySegmentsModal = ref(false);
const deleteEmptySegmentsError = ref<string | null>(null);
const deleteEmptySegmentsProcessing = ref(false);
const autoTaggingSegmentIds = ref<Set<string>>(new Set());
const autoTaggingSegmentIdList = computed(() => Array.from(autoTaggingSegmentIds.value));
const insightGeneratingSegmentIds = ref<Set<string>>(new Set());
const insightGeneratingSegmentIdList = computed(() => Array.from(insightGeneratingSegmentIds.value));

function shouldRefreshInsight(narrationCount: number, generatedCount: number | null | undefined): boolean {
  const base = Number.isFinite(Number(generatedCount)) ? Math.max(0, Number(generatedCount)) : 0;
  const threshold = Math.max(1, Math.ceil(base * 0.4));
  return Math.abs(narrationCount - base) >= threshold;
}

watch(
  [activeOrgId, mediaAssetId],
  () => {
    // Stop any active recording when navigating to different asset
    if (recorder.isRecording.value) {
      debugLog('route change detected, stopping active recording');
      recorder.stopRecordingAndGetBlob().catch(() => {});
    }
    narrationTargetSegmentId.value = null;
    recordingContext.value = null;
    activeOptimisticIds.value.clear();
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

async function handleAddSegmentTag(payload: { segmentId: string; tagKey: string; tagType: SegmentTagType; taggedProfileId?: string }) {
  const allowIdentity = payload.tagType === 'identity' && canTagPlayers.value;
  if (!canTagSegments.value && !allowIdentity) {
    toast({ message: 'You do not have permission to modify tags.', variant: 'info', durationMs: 2500 });
    return;
  }
  if (!payload.segmentId) return;
  try {
    if (payload.tagType === 'identity' && payload.taggedProfileId) {
      await segmentIdentityTagService.addIdentityTag({
        segmentId: String(payload.segmentId),
        tagKey: payload.tagKey,
        taggedProfileId: payload.taggedProfileId,
      });
      await reloadSegmentTags();
      return;
    }

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
  if (!canTagSegments.value) {
    toast({ message: 'You do not have permission to modify tags.', variant: 'info', durationMs: 2500 });
    return;
  }
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

async function runAutoTagging(options: {
  narrationId?: string;
  segmentId?: string;
  showSuccess?: boolean;
  force?: boolean;
}) {
  if (!canAutoTagSegments.value) return;
  const segmentId = String(options.segmentId ?? '').trim();
  if (!segmentId) return;
  if (autoTaggingSegmentIds.value.has(segmentId)) return;

  autoTaggingSegmentIds.value = new Set([...autoTaggingSegmentIds.value, segmentId]);
  try {
    const result = await segmentAutoTagService.autoTagSegment({
      narrationId: options.narrationId,
      segmentId,
      force: options.force,
    });
    await reloadSegmentTagSuggestions();
    const suggestedCount = result.suggested_tags?.length ?? 0;
    if (options.showSuccess) {
      toast({
        message: suggestedCount
          ? `Suggested ${suggestedCount} tag${suggestedCount === 1 ? '' : 's'}.`
          : 'No new tag suggestions.',
        variant: suggestedCount ? 'success' : 'info',
        durationMs: 2200,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to auto-tag segment.';
    toast({ message, variant: 'error', durationMs: 2600 });
  } finally {
    const next = new Set(autoTaggingSegmentIds.value);
    next.delete(segmentId);
    autoTaggingSegmentIds.value = next;
  }
}

function handleAutoTagSegment(seg: MediaAssetSegment) {
  if (!canAutoTagSegments.value) {
    toast({ message: 'You do not have permission to auto-tag.', variant: 'info', durationMs: 2400 });
    return;
  }
  void runAutoTagging({ segmentId: String(seg.id), showSuccess: true, force: true });
}

async function handleApplySuggestedTags(payload: {
  segmentId: string;
  suggestionIds?: string[];
  applyAll?: boolean;
}) {
  if (!canAutoTagSegments.value) {
    toast({ message: 'You do not have permission to apply tags.', variant: 'info', durationMs: 2400 });
    return;
  }
  const segmentId = String(payload.segmentId ?? '').trim();
  if (!segmentId) return;
  try {
    const result = await segmentTagSuggestionService.applySuggestions({
      segmentId,
      suggestionIds: payload.suggestionIds,
      applyAll: payload.applyAll,
    });
    await Promise.all([reloadSegmentTags(), reloadSegmentTagSuggestions()]);
    const appliedCount = result.applied_tags?.length ?? 0;
    toast({
      message: appliedCount
        ? `Applied ${appliedCount} tag${appliedCount === 1 ? '' : 's'}.`
        : 'No new tags applied.',
      variant: appliedCount ? 'success' : 'info',
      durationMs: 2200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to apply tag suggestions.';
    toast({ message, variant: 'error', durationMs: 2600 });
  }
}

async function handleRejectSuggestedTag(payload: { segmentId: string; suggestionId: string }) {
  if (!canAutoTagSegments.value) {
    toast({ message: 'You do not have permission to review tags.', variant: 'info', durationMs: 2400 });
    return;
  }
  const segmentId = String(payload.segmentId ?? '').trim();
  const suggestionId = String(payload.suggestionId ?? '').trim();
  if (!segmentId || !suggestionId) return;
  try {
    await segmentTagSuggestionService.rejectSuggestion({ segmentId, suggestionId });
    await reloadSegmentTagSuggestions();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to reject tag suggestion.';
    toast({ message, variant: 'error', durationMs: 2600 });
  }
}

async function handleGenerateSegmentInsight(payload: { segmentId: string }) {
  if (!canGenerateSegmentInsights.value) {
    toast({ message: 'You do not have permission to summarize segments.', variant: 'info', durationMs: 2400 });
    return;
  }
  const segmentId = String(payload.segmentId ?? '').trim();
  if (!segmentId) return;
  if (insightGeneratingSegmentIds.value.has(segmentId)) return;

  insightGeneratingSegmentIds.value = new Set([...insightGeneratingSegmentIds.value, segmentId]);
  try {
    await analysisService.getSegmentSummary(segmentId, { forceRefresh: true, skipCache: true });
    await reloadSegmentInsights();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to generate segment insight.';
    toast({ message, variant: 'error', durationMs: 2600 });
  } finally {
    const next = new Set(insightGeneratingSegmentIds.value);
    next.delete(segmentId);
    insightGeneratingSegmentIds.value = next;
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

function openAddToPlaylist(seg: MediaAssetSegment) {
  if (!isStaffOrAbove.value) return;
  playlistSegment.value = seg;
}

function closeAddToPlaylist() {
  playlistSegment.value = null;
}

function requestDeleteEmptySegments(segmentIds: string[]) {
  if (!isStaffOrAbove.value) {
    toast({ message: 'You do not have permission to delete segments.', variant: 'error', durationMs: 2500 });
    return;
  }
  pendingEmptySegmentIds.value = segmentIds.map((id) => String(id));
  deleteEmptySegmentsError.value = null;
  showDeleteEmptySegmentsModal.value = true;
}

function closeDeleteEmptySegmentsModal(force = false) {
  if (deleteEmptySegmentsProcessing.value && !force) return;
  showDeleteEmptySegmentsModal.value = false;
  deleteEmptySegmentsError.value = null;
  pendingEmptySegmentIds.value = [];
}

async function confirmDeleteEmptySegments() {
  if (!pendingEmptySegmentIds.value.length) {
    closeDeleteEmptySegmentsModal();
    return;
  }

  deleteEmptySegmentsProcessing.value = true;
  deleteEmptySegmentsError.value = null;

  try {
    // Fix #11: Include optimistic narrations when checking for empty segments
    const narrationsSet = new Set(
      (narrations.value as any[])
        .map((n) => String(n?.media_asset_segment_id ?? ''))
        .filter((id) => id)
    );

    const deletableIds = pendingEmptySegmentIds.value.filter((id) => !narrationsSet.has(String(id)));
    if (!deletableIds.length) {
      closeDeleteEmptySegmentsModal(true);
      return;
    }

    await Promise.all(deletableIds.map((id) => segmentService.deleteSegment(String(id))));
    segments.value = segments.value.filter((seg) => !deletableIds.includes(String(seg.id)));

    toast({
      message: `Deleted ${deletableIds.length} empty segment${deletableIds.length === 1 ? '' : 's'}.`,
      variant: 'success',
      durationMs: 2200,
    });
    closeDeleteEmptySegmentsModal(true);
  } catch (err) {
    deleteEmptySegmentsError.value = err instanceof Error ? err.message : 'Failed to delete empty segments.';
  } finally {
    deleteEmptySegmentsProcessing.value = false;
  }
}

const playerRef = ref<InstanceType<typeof ShakaSurfacePlayer> | null>(null);
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

function seekRelative(deltaSeconds: number) {
  seekRelativeInternal(deltaSeconds);
  suppressBufferingUntilMs.value = Date.now() + 500;
  isBuffering.value = false;

  console.log(JSON.stringify({
    severity: 'info',
    event_type: 'segment_seek',
    org_id: activeOrgId.value ?? null,
    media_id: asset.value?.id ?? null,
    delta_seconds: deltaSeconds,
    current_time: currentTime.value ?? null,
  }));
}

function seekRelativeWithFeedback(deltaSeconds: number) {
  seekRelative(deltaSeconds);
  flashSeek(deltaSeconds < 0 ? 'rew' : 'ff', Math.abs(deltaSeconds));
  showOverlay(2500);
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
  // Fix #12: Don't update focus during recording to avoid segment target confusion
  if (!recorder.isRecording.value) {
    focusedSegmentId.value = findFocusedSegmentId(currentTime.value);
  }
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

  console.log(JSON.stringify({
    severity: 'info',
    event_type: 'segment_play',
    org_id: activeOrgId.value ?? null,
    media_id: asset.value?.id ?? null,
    segment_id: activeSegmentId.value ?? null,
    current_time: currentTime.value ?? null,
  }));
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
  // Stop active recording and clean up state
  if (recorder.isRecording.value) {
    debugLog('component unmounting, stopping active recording');
    recorder.stopRecordingAndGetBlob().catch(() => {});
    recordingContext.value = null;
  }
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
  const found = findSegmentContainingTime(segments.value, t);
  return found ? String(found.id) : null;
});

function findFocusedSegmentId(seconds: number): string | null {
  const list = segments.value;
  if (!list.length) return null;

  // Prefer a segment that contains the time.
  const inside = findSegmentContainingTime(list, seconds);
  if (inside) return String(inside.id);

  const earliestStart = list.reduce((min, seg) => Math.min(min, seg.start_seconds ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
  if (seconds < earliestStart) return null;

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

// Helper to check if narration is still processing (embedding generation)
function isNarrationProcessing(narrationId: string): boolean {
  const startTime = processingNarrationIds.value.get(narrationId);
  if (!startTime) return false;
  
  const elapsed = Date.now() - startTime;
  const PROCESSING_WINDOW_MS = 5000; // 5 seconds
  
  if (elapsed > PROCESSING_WINDOW_MS) {
    // Auto-cleanup expired entries
    processingNarrationIds.value.delete(narrationId);
    return false;
  }
  
  return true;
}

async function handleAddNarrationForSegment(seg: MediaAssetSegment) {
  narrationTargetSegmentId.value = String(seg.id);
  focusedSegmentId.value = String(seg.id);

  // Prevent starting new recording if already recording
  if (recorder.isRecording.value) {
    toast({ message: 'Please stop current recording first.', variant: 'info', durationMs: 2000 });
    return;
  }

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

  // Clean up any previous optimistic narrations that failed or are still uploading
  // This prevents duplicate "Uploading..." entries on rapid re-recording
  if (activeOptimisticIds.value.size > 0) {
    debugLog('cleaning up previous optimistic narrations', Array.from(activeOptimisticIds.value));
    narrations.value = (narrations.value as any[]).filter((n) => !activeOptimisticIds.value.has(String(n.id)));
    activeOptimisticIds.value.clear();
  }

  if (!recorder.isRecording.value && recorder.hasRecording.value) {
    recorder.resetRecording();
  }

  // Capture recording context NOW to avoid race conditions with segment changes
  recordingContext.value = {
    targetSegmentId: narrationTargetSegmentId.value,
    orgId: activeOrgId.value,
    mediaAssetId: asset.value.id,
    membershipRole: String(membershipRole.value),
    focusAtStart: focusedSegmentId.value,
  };

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
      context: recordingContext.value,
    });
  } catch (err) {
    recordStartVideoTime.value = null;
    recordStartWallClockMs.value = null;
    recordingContext.value = null;
    restoreVideoMuteAfterRecording();
    throw err;
  }
}

function checkSegmentFragmentation(newSegment: MediaAssetSegment): void {
  // Check if newly created segment significantly overlaps with existing segments
  // This helps detect rapid recordings creating fragmented segments
  
  const newStart = newSegment.start_seconds ?? 0;
  const newEnd = newSegment.end_seconds ?? 0;
  const newDuration = newEnd - newStart;
  
  if (newDuration === 0) return;
  
  for (const existing of segments.value) {
    if (String(existing.id) === String(newSegment.id)) continue;
    
    // Only check segments of same source type
    if (existing.source_type !== newSegment.source_type) continue;
    
    const overlap = computeOverlapSeconds(
      newStart,
      newEnd,
      existing.start_seconds ?? 0,
      existing.end_seconds ?? 0
    );
    
    const overlapPercentage = overlap / newDuration;
    
    if (overlapPercentage >= FRAGMENTATION_OVERLAP_THRESHOLD) {
      debugLog('fragmentation detected', {
        newSegmentId: newSegment.id,
        existingSegmentId: existing.id,
        overlapPercentage,
        overlap,
      });
      
      // Suggest using existing segment instead
      toast({
        message: `This moment overlaps ${Math.round(overlapPercentage * 100)}% with an existing segment. Consider adding narrations to existing moments instead.`,
        variant: 'info',
        durationMs: 4000,
      });
      
      // Only show one warning
      break;
    }
  }
}

async function endRecordingNonBlocking() {
  if (!recorder.isRecording.value) return;

  // Capture recording context before clearing (Fix #2: segment target race)
  const ctx = recordingContext.value;
  if (!ctx) {
    recordError.value = 'Missing recording context.';
    return;
  }

  recordingUploadError.value = null;
  const startVideoTime = recordStartVideoTime.value;
  const startWallClockMs = recordStartWallClockMs.value;
  recordStartVideoTime.value = null;
  recordStartWallClockMs.value = null;
  recordingContext.value = null;

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

  // Use captured context instead of current state (Fix #2)
  const orgId = ctx.orgId;
  const mediaAssetId = ctx.mediaAssetId;

  if (!orgId) {
    recordingUploadError.value = 'Missing organization.';
    void blobPromise.catch(() => {});
    return;
  }

  if (startVideoTime === null || startWallClockMs === null) {
    recordingUploadError.value = 'Missing recording start time.';
    void blobPromise.catch(() => {});
    return;
  }

  // Check minimum recording duration to prevent empty narrations
  if (recordingDurationSeconds < MIN_RECORDING_DURATION_SECONDS) {
    recordingUploadError.value = 'Recording too short. Please speak for at least half a second.';
    void blobPromise.catch(() => {});
    toast({ 
      message: 'Recording too short. Please try again.', 
      variant: 'info', 
      durationMs: 2500 
    });
    return;
  }

  debugLog('recording stopped', {
    wallClockEndMs,
    recordingDurationSeconds,
    context: ctx,
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
  debugLog('segment bounds computed', {
    recordStartVideoTime: startVideoTime,
    recordingDurationSeconds,
    mediaDuration,
    ...bounds,
  });

  // Use captured target from context (Fix #2)
  const explicitSegmentId = ctx.targetSegmentId ? String(ctx.targetSegmentId) : null;
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
    const overflowSeconds = recordingEndSeconds - (resolved.end_seconds ?? 0);
    const extendBySeconds =
      overflowSeconds > 0 ? Math.min(overflowSeconds, MAX_EXTENSION_SECONDS) : 0;
    const desiredEndSeconds = clampEndSeconds(
      (resolved.end_seconds ?? 0) + extendBySeconds,
      mediaDuration
    );
    if (extendBySeconds > 0 && desiredEndSeconds > (resolved.end_seconds ?? 0)) {
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
        
        // Calculate minimum overlap: 50% of EITHER recording OR segment, minimum 2 seconds
        const recordingDuration = overlapEndSeconds - overlapStartSeconds;
        const segmentDuration = (resolvedOverlap.end_seconds ?? 0) - (resolvedOverlap.start_seconds ?? 0);
        const minOverlap = computeMinimumOverlap(recordingDuration, segmentDuration);
        
        const overlapPercentageOfRecording = recordingDuration > 0 ? (overlapSeconds / recordingDuration) * 100 : 0;
        const overlapPercentageOfSegment = segmentDuration > 0 ? (overlapSeconds / segmentDuration) * 100 : 0;
        
        debugLog('overlap detected', {
          overlapSeconds,
          minRequired: minOverlap,
          recordingDuration,
          segmentDuration,
          overlapPctOfRecording: overlapPercentageOfRecording.toFixed(1) + '%',
          overlapPctOfSegment: overlapPercentageOfSegment.toFixed(1) + '%',
          segmentId: resolvedOverlap.id,
          recordingRange: [overlapStartSeconds, overlapEndSeconds],
          segmentRange: [resolvedOverlap.start_seconds, resolvedOverlap.end_seconds],
        });
        
        if (overlapSeconds < minOverlap) {
          const overlapFromRecording = recordingDuration * MIN_OVERLAP_PERCENTAGE;
          const overlapFromSegment = segmentDuration * MIN_OVERLAP_PERCENTAGE;
          const reason = overlapSeconds < MIN_OVERLAP_ABSOLUTE_SECONDS 
            ? 'below 2s absolute minimum'
            : `below 50% threshold (need ${minOverlap.toFixed(1)}s = min of ${overlapFromRecording.toFixed(1)}s recording / ${overlapFromSegment.toFixed(1)}s segment)`;
          
          debugLog('overlap insufficient, will create new segment', { 
            overlapSeconds, 
            minOverlap,
            overlapPctOfRecording: overlapPercentageOfRecording.toFixed(1) + '%',
            overlapPctOfSegment: overlapPercentageOfSegment.toFixed(1) + '%',
            reason
          });
          resolvedOverlap = null;
        }
      }

      if (resolvedOverlap) {
        let resolved = resolvedOverlap;
        const overflowSeconds = recordingEndSeconds - (resolved.end_seconds ?? 0);
        const extendBySeconds =
          overflowSeconds > 0 ? Math.min(overflowSeconds, MAX_EXTENSION_SECONDS) : 0;
        const desiredEndSeconds = clampEndSeconds(
          (resolved.end_seconds ?? 0) + extendBySeconds,
          mediaDuration
        );
        if (extendBySeconds > 0 && desiredEndSeconds > (resolved.end_seconds ?? 0)) {
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
        
        // Check for potential fragmentation
        checkSegmentFragmentation(createdSegment);
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

  console.log(JSON.stringify({
    severity: 'info',
    event_type: 'narration_create',
    org_id: orgId,
    media_id: mediaAssetId,
    segment_id: String(targetSegment.id),
  }));

  // Determine source_type for optimistic narration (Fix #8: filter visibility)
  const sourceType = (() => {
    const role = String(ctx.membershipRole ?? '').toLowerCase();
    if (role === 'owner') return 'coach';
    if (role === 'manager' || role === 'staff') return 'staff';
    return 'member';
  })();

  const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const optimistic: OptimisticNarration = {
    id: optimisticId,
    org_id: orgId,
    media_asset_id: mediaAssetId,
    media_asset_segment_id: String(targetSegment.id),
    author_id: null,
    source_type: sourceType,
    audio_storage_path: null,
    created_at: new Date(),
    // Use Web Speech transcript if available, otherwise show "Processing..."
    transcript_raw: recorder.liveTranscript.value || 'Processing...',
    status: 'uploading',
  };

  // Track optimistic ID for cleanup (Fix #1: multiple quick recordings)
  activeOptimisticIds.value.add(optimisticId);

  // optimistic insert into the overall narrations list
  narrations.value = [...narrations.value, optimistic];

  // Helper to add timeout to promises (Fix #10)
  const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
      ),
    ]);
  };

  Promise.resolve()
    .then(async () => {
      const audioBlob = await blobPromise;
      
      // Add 60s timeout for transcription (Fix #10: transcription timeout)
      const { text } = await withTimeout(
        transcriptionService.transcribeAudio(audioBlob),
        60000,
        'Transcription timed out. Please try recording a shorter clip.'
      );
      
      // Validate segment still exists before creating narration (Fix #3)
      const segmentStillExists = segments.value.some((s) => String(s.id) === String(targetSegment.id));
      if (!segmentStillExists) {
        throw new Error('Target segment no longer exists.');
      }
      
      return narrationService.createNarration({
        orgId,
        mediaAssetId,
        mediaAssetSegmentId: String(targetSegment.id),
        transcriptRaw: text?.trim() ? text.trim() : '(No transcript)',
      });
    })
    .then((saved) => {
      // Remove from optimistic tracking (Fix #1)
      activeOptimisticIds.value.delete(optimisticId);
      // Use filter + add instead of map to prevent duplicates (Fix #4)
      narrations.value = [
        ...(narrations.value as any[]).filter((n) => n.id !== optimisticId),
        saved,
      ];
      
      // Track as processing (embedding being generated in background)
      processingNarrationIds.value.set(saved.id, Date.now());
      
      // Auto-cleanup after 5 seconds
      setTimeout(() => {
        processingNarrationIds.value.delete(saved.id);
      }, 5000);
      
      toast({ message: 'Narration added.', variant: 'success', durationMs: 2000 });

      const savedSegmentId = String((saved as any)?.media_asset_segment_id ?? targetSegment.id);
      if (canAutoTagSegments.value && savedSegmentId) {
        void runAutoTagging({ narrationId: String(saved.id), segmentId: savedSegmentId });
      }

      if (savedSegmentId) {
        const narrationCount = narrations.value.filter(
          (n) => String((n as any)?.media_asset_segment_id ?? '') === savedSegmentId
        ).length;
        const insight = insightsBySegmentId.value[savedSegmentId];
        const generatedCount = insight?.narration_count_at_generation ?? null;
        const shouldRefresh = !insight || shouldRefreshInsight(narrationCount, generatedCount);
        if (shouldRefresh) {
          void analysisService
            .getSegmentSummary(savedSegmentId, { forceRefresh: true, skipCache: true })
            .then(() => reloadSegmentInsights())
            .catch(() => {});
        }
      }
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to process narration.';
      recordingUploadError.value = message;
      // Update optimistic to error state
      narrations.value = (narrations.value as any[]).map((n) => {
        if (n.id !== optimisticId) return n;
        return {
          ...optimistic,
          status: 'error',
          transcript_raw: 'Upload failed',
          errorMessage: message,
        };
      });
      // Don't forget to remove from optimistic tracking on error too
      activeOptimisticIds.value.delete(optimisticId);
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
  if (!canEditNarrations.value) {
    toast({ message: 'You do not have permission to edit narrations.', variant: 'info', durationMs: 2500 });
    return;
  }
  
  // Check if narration is still processing (embedding generation)
  if (isNarrationProcessing(narrationId)) {
    toast({
      message: 'Please wait for narration processing to complete.',
      variant: 'info',
      durationMs: 2500
    });
    return;
  }
  
  // Fix #6: Basic optimistic locking - capture current updated_at
  const currentNarration = (narrations.value as any[]).find((n) => String(n.id) === narrationId);
  const originalUpdatedAt = currentNarration?.updated_at;
  
  try {
    const updated = await narrationService.updateNarrationText(narrationId, transcriptRaw);
    
    // Re-trigger embedding generation with new transcript
    processingNarrationIds.value.set(narrationId, Date.now());
    setTimeout(() => {
      processingNarrationIds.value.delete(narrationId);
    }, 5000);
    
    // Check if narration was modified by someone else during our edit
    const freshNarration = (narrations.value as any[]).find((n) => String(n.id) === narrationId);
    if (freshNarration && originalUpdatedAt && freshNarration.updated_at !== originalUpdatedAt) {
      toast({ 
        message: 'Warning: This narration may have been modified by another user.', 
        variant: 'info', 
        durationMs: 3000 
      });
    }
    
    narrations.value = (narrations.value as any[]).map((n) => (String(n.id) === narrationId ? updated : n));
    toast({ message: 'Narration updated.', variant: 'success', durationMs: 1500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update narration.';
    toast({ message, variant: 'error' });
  }
}

async function handleDeleteNarration(narrationId: string) {
  if (!canDeleteNarrations.value) {
    toast({ message: 'You do not have permission to delete narrations.', variant: 'info', durationMs: 2500 });
    return;
  }
  
  // Check if narration is still processing (embedding generation)
  if (isNarrationProcessing(narrationId)) {
    toast({
      message: 'Please wait for narration processing to complete.',
      variant: 'info',
      durationMs: 2500
    });
    return;
  }
  
  try {
    const targetNarration = (narrations.value as any[]).find((n) => String(n.id) === narrationId);
    const targetSegmentId = String(targetNarration?.media_asset_segment_id ?? '');
    console.log(JSON.stringify({
      severity: 'info',
      event_type: 'narration_delete',
      org_id: activeOrgId.value ?? null,
      media_id: asset.value?.id ?? null,
      narration_id: narrationId,
    }));
    await narrationService.deleteNarration(narrationId);
    narrations.value = (narrations.value as any[]).filter((n) => String(n.id) !== narrationId);
    toast({ message: 'Narration deleted.', variant: 'success', durationMs: 1500 });

    if (targetSegmentId && canGenerateSegmentInsights.value) {
      const narrationCount = narrations.value.filter(
        (n) => String((n as any)?.media_asset_segment_id ?? '') === targetSegmentId
      ).length;
      const insight = insightsBySegmentId.value[targetSegmentId];
      const generatedCount = insight?.narration_count_at_generation ?? null;
      if (insight && shouldRefreshInsight(narrationCount, generatedCount) && narrationCount > 0) {
        void analysisService
          .getSegmentSummary(targetSegmentId, { forceRefresh: true, skipCache: true })
          .then(() => reloadSegmentInsights())
          .catch(() => {});
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete narration.';
    toast({ message, variant: 'error' });
  }
}

async function handleDeleteSegment(segmentId: string) {
  if (!asset.value?.id) return;
  try {
    console.log(JSON.stringify({
      severity: 'info',
      event_type: 'segment_delete',
      org_id: activeOrgId.value ?? null,
      media_id: asset.value?.id ?? null,
      segment_id: segmentId,
    }));
    await segmentService.deleteSegment(segmentId);
    segments.value = segments.value.filter((s) => String(s.id) !== segmentId);
    narrations.value = (narrations.value as any[]).filter((n) => String(n.media_asset_segment_id) !== segmentId);
    toast({ message: 'Segment deleted.', variant: 'success', durationMs: 1500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete segment.';
    toast({ message, variant: 'error' });
  }
}
</script>

<template>
  <div
    class="w-full bg-gradient-to-t from-black to-blue-900/40
           h-[calc(100dvh-var(--main-nav-height))] overflow-y-auto
           md:h-auto md:overflow-visible md:min-h-[calc(100dvh-var(--main-nav-height))]"
  >
    <div class="container-lg pt-6 pb-16 md:pt-8 md:pb-20 text-white space-y-4 h-full">
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
        <div class="flex items-center justify-center gap-3">
          <LoadingDot />
          <ShimmerText class="text-sm text-white/70" text="Rugbycodex is getting your match..." />
        </div>
      </div>

      <div v-else-if="error" class="rounded-lg border border-white/10 bg-white/5 p-6 text-rose-200">
        {{ error }}
      </div>

      <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-5">
        <!-- Player column -->
        <div class="md:col-span-3 space-y-4">
          <!-- Processing Status Banner (shows for blocking or background processing) -->
          <MediaProcessingStatusBanner 
            v-if="processingStatus.isBlockingProcessing" 
            :status="processingStatus" 
            :show-watch-message="true"
            mode="banner"
          />
          
          <div class="md:space-y-4">
            <div class="sticky top-0 z-30 -mx-4 space-y-4 bg-black md:static md:mx-0 md:bg-transparent">
              <!-- Mobile: full-bleed video surface (like Feed); md+: rounded container -->
              <div class="md:mx-0">
                <div class="overflow-hidden bg-black ring-1 ring-white/10 md:rounded-xl md:bg-white/5">
                  <div
                    ref="surfaceEl"
                    class="relative bg-black"
                    :class="isFullscreen ? 'h-full w-full' : 'aspect-video'"
                    @pointermove="onHoverMove"
                    @pointerleave="onHoverLeave"
                  >
                    <!-- Show player only when video is watchable -->
                    <ShakaSurfacePlayer
                      v-if="processingStatus.isWatchable"
                      ref="playerRef"
                      :manifest-url="playlistUrl"
                      :autoplay="false"
                      class="h-full w-full"
                      @timeupdate="handleTimeupdate"
                      @loadedmetadata="handleLoadedMetadata"
                      @play="handlePlay"
                      @pause="handlePause"
                      @error="(m) => (error = m)"
                      @buffering="handleBuffering"
                    />
                    
                    <!-- Placeholder when video is not ready -->
                    <div 
                      v-else
                      class="absolute inset-0 flex items-center justify-center bg-black"
                    >
                      <div class="flex flex-col items-center gap-4 text-center px-6">
                        <LoadingDot size="lg" color="#3B82F6" />
                        <div>
                          <p class="text-lg font-semibold text-white">{{ processingStatus.statusMessage }}</p>
                          <p class="text-sm text-white/60 mt-1">This may take a few minutes...</p>
                        </div>
                      </div>
                    </div>

                    <FeedGestureLayer 
                      v-if="processingStatus.isWatchable"
                      @tap="onTap" 
                      @swipeDown="() => {}" 
                      @swipeUp="() => {}"
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
                </div>
              </div>

              <div class="mb-2 md:mb-0">
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
              </div>

              <div class="md:hidden text-xs text-white/50 tabular-nums pb-4 pl-4">
                {{ timeLabel }}
              </div>
            </div>

            <div class="md:hidden space-y-6 pb-6 pt-4">
              <MediaAssetReviewNarrationList
                :segments="segments"
                :narrations="(narrations as any)"
                :active-segment-id="activeSegmentId"
                :focused-segment-id="focusedSegmentId"
                :default-source="defaultNarrationSource"
                :source-filter="narrationSourceFilter"
                :can-moderate-narrations="canModerateNarrations"
                :can-assign-segments="canAssignSegments"
                :can-tag-segments="canTagSegments"
                :can-tag-players="canTagPlayers"
                :can-auto-tag-segments="canAutoTagSegments"
                :auto-tagging-segment-ids="autoTaggingSegmentIdList"
                :tag-suggestions="suggestionsBySegmentId"
                :segment-insights="insightsBySegmentId"
                :can-generate-segment-insights="canGenerateSegmentInsights"
                :insight-generating-segment-ids="insightGeneratingSegmentIdList"
                :can-edit-narrations="canEditNarrations"
                :can-delete-narrations="canDeleteNarrations"
                :current-user-id="currentUserId"
                :current-user-role="membershipRole"
                @jumpToSegment="jumpToSegment"
                @addNarration="handleAddNarrationForSegment"
                @assignSegment="openAssignSegment"
                @addToPlaylist="openAddToPlaylist"
                @editNarration="handleEditNarration"
                @deleteNarration="handleDeleteNarration"
                @deleteSegment="handleDeleteSegment"
                @addTag="handleAddSegmentTag"
                @removeTag="handleRemoveSegmentTag"
                @autoTagSegment="handleAutoTagSegment"
                @applySuggestedTags="handleApplySuggestedTags"
                @rejectSuggestedTag="handleRejectSuggestedTag"
                @generateSegmentInsight="handleGenerateSegmentInsight"
                @update:sourceFilter="handleNarrationSourceFilterChange"
                @visibleSegmentsChange="handleVisibleSegmentsChange"
                @requestDeleteEmptySegments="requestDeleteEmptySegments"
              />
            </div>
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
            class="space-y-6"
          >
            <MediaAssetReviewNarrationList
              :segments="segments"
              :narrations="(narrations as any)"
              :active-segment-id="activeSegmentId"
              :focused-segment-id="focusedSegmentId"
              :default-source="defaultNarrationSource"
              :source-filter="narrationSourceFilter"
              :can-moderate-narrations="canModerateNarrations"
              :can-assign-segments="canAssignSegments"
              :can-tag-segments="canTagSegments"
              :can-tag-players="canTagPlayers"
              :can-auto-tag-segments="canAutoTagSegments"
              :auto-tagging-segment-ids="autoTaggingSegmentIdList"
              :tag-suggestions="suggestionsBySegmentId"
              :segment-insights="insightsBySegmentId"
              :can-generate-segment-insights="canGenerateSegmentInsights"
              :insight-generating-segment-ids="insightGeneratingSegmentIdList"
              :can-edit-narrations="canEditNarrations"
              :can-delete-narrations="canDeleteNarrations"
              :current-user-id="currentUserId"
              :current-user-role="membershipRole"
              @jumpToSegment="jumpToSegment"
              @addNarration="handleAddNarrationForSegment"
              @assignSegment="openAssignSegment"
              @addToPlaylist="openAddToPlaylist"
              @editNarration="handleEditNarration"
              @deleteNarration="handleDeleteNarration"
              @deleteSegment="handleDeleteSegment"
              @addTag="handleAddSegmentTag"
              @removeTag="handleRemoveSegmentTag"
              @autoTagSegment="handleAutoTagSegment"
              @applySuggestedTags="handleApplySuggestedTags"
              @rejectSuggestedTag="handleRejectSuggestedTag"
              @generateSegmentInsight="handleGenerateSegmentInsight"
              @update:sourceFilter="handleNarrationSourceFilterChange"
              @visibleSegmentsChange="handleVisibleSegmentsChange"
              @requestDeleteEmptySegments="requestDeleteEmptySegments"
            />
          </div>
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

      <AddToPlaylistModal
        v-if="playlistSegment && activeOrgIdOrEmpty"
        :org-id="activeOrgIdOrEmpty"
        :segment-id="String(playlistSegment.id)"
        :on-close="closeAddToPlaylist"
        :on-added="closeAddToPlaylist"
      />

      <ConfirmDeleteModal
        :show="showDeleteEmptySegmentsModal"
        :item-name="pendingEmptySegmentIds.length === 1 ? 'this empty segment' : `${pendingEmptySegmentIds.length} empty segments`"
        popup-title="Delete Empty Segments"
        :is-deleting="deleteEmptySegmentsProcessing"
        :error="deleteEmptySegmentsError"
        @confirm="confirmDeleteEmptySegments"
        @cancel="closeDeleteEmptySegmentsModal"
        @close="closeDeleteEmptySegmentsModal"
      />
    </div>
  </div>
</template>
