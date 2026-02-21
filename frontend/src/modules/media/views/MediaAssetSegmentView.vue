<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import ShakaSurfacePlayer from '@/modules/media/components/ShakaSurfacePlayer.vue';
import { useSegmentPlayback } from '@/modules/media/composables/useSegmentPlayback';
import { useVideoOverlayControls } from '@/modules/media/composables/useVideoOverlayControls';
import MediaPlaybackOverlayShell from '@/modules/media/components/MediaPlaybackOverlayShell.vue';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { mediaService } from '@/modules/media/services/mediaService';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import { supabase } from '@/lib/supabaseClient';
import { formatMinutesSeconds } from '@/lib/duration';
import NarrationView from '@/modules/media/views/NarrationView.vue';

const DEBUG = import.meta.env.DEV;

//TODO: Ui play/pause on click space bar etc

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  console.debug('[MediaAssetSegmentView]', ...args);
}

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const segmentId = computed(() => String(route.params.segmentId ?? ''));
const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);

const loading = ref(true);
const error = ref<string | null>(null);
const segment = ref<MediaAssetSegment | null>(null);
const asset = ref<OrgMediaAsset | null>(null);
const playlistObjectUrl = ref<string | null>(null);
const playerRef = ref<InstanceType<typeof ShakaSurfacePlayer> | null>(null);
const surfaceEl = ref<HTMLElement | null>(null);
const videoEl = computed(() => playerRef.value?.getVideoElement?.() ?? null);

const isPlaying = ref(false);

const segmentPlayback = useSegmentPlayback({
  getPlayer: () => playerRef.value,
  segmentStartSeconds: computed(() => segment.value?.start_seconds ?? 0),
  segmentEndSeconds: computed(() => segment.value?.end_seconds ?? 0),
  isActive: computed(() => Boolean(segment.value && playlistObjectUrl.value)),
  isPlaying,
  enableWatchedHalf: false,
});

const {
  duration,
  progress01,
  segmentCurrentSeconds,
  segmentLength,
  suppressBufferingUntilMs,
  handleTimeupdate: handleSegmentTimeupdate,
  handleLoadedMetadata: handleSegmentLoadedMetadata,
  seekRelative: seekRelativeInternal,
  scrubToSegmentSeconds: scrubToSecondsInternal,
  resetOnSourceChange,
} = segmentPlayback;

const overlayControls = useVideoOverlayControls({
  getVideoEl: () => videoEl.value,
  getSurfaceEl: () => surfaceEl.value,
  getPlayer: () => playerRef.value,
  isPlaying,
  onTogglePlay: () => playerRef.value?.togglePlayback(),
  onSeekRelative: (deltaSeconds) => seekRelative(deltaSeconds),
  suppressBufferingUntilMs,
  requireElementForFullscreen: true,
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
  onTap,
  handleBuffering,
  applyVolumeToPlayer,
  syncVolumeFromPlayer,
  toggleMute,
  setVolume,
  toggleFullscreen,
} = overlayControls;

const togglePlay = requestTogglePlay;

const assetTitle = computed(() => {
  if (asset.value?.title?.trim()) return asset.value.title;
  const fileName = asset.value?.file_name ?? '';
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled clip';
});

const segmentTitle = computed(() => {
  if (!segment.value) return '';
  return `Segment ${segment.value.segment_index + 1} · ${formatMinutesSeconds(
    segment.value.start_seconds
  )} - ${formatMinutesSeconds(segment.value.end_seconds)}`;
});

function handlePlayerError(message: string) {
  error.value = message;
}

async function loadSegment() {
  debugLog('loadSegment(): start', {
    segmentId: segmentId.value,
    activeOrgId: activeOrgId.value,
  });
  loading.value = true;
  error.value = null;
  segment.value = null;
  asset.value = null;
  playlistObjectUrl.value = null;

  try {
    if (!segmentId.value) {
      throw new Error('Missing segment id.');
    }

    if (!activeOrgId.value) {
      return;
    }

    // Load segment
    const { data: segmentData, error: segmentError } = await supabase
      .from('media_asset_segments')
      .select('*')
      .eq('id', segmentId.value)
      .single();

    if (segmentError) throw segmentError;
    if (!segmentData) throw new Error('Segment not found.');

    segment.value = {
      id: segmentData.id,
      media_asset_id: segmentData.media_asset_id,
      segment_index: segmentData.segment_index,
      start_seconds: segmentData.start_seconds,
      end_seconds: segmentData.end_seconds,
      created_at: new Date(segmentData.created_at),
    };

    debugLog('loadSegment(): fetched segment', segment.value);

    // Load parent asset
    const found = await mediaService.getById(activeOrgId.value, segment.value.media_asset_id);
    asset.value = found;

    debugLog('loadSegment(): fetched asset', {
      id: found.id,
      bucket: found.bucket,
      storage_path: found.storage_path,
    });

    // Get playlist URL
    try {
      playlistObjectUrl.value = await mediaService.getPresignedHlsPlaylistUrl(
        activeOrgId.value,
        found.id,
        found.bucket
      );
    } catch (err) {
      if (err instanceof Error && 'cause' in err && err.cause) {
        debugLog('fetchPlaybackPlaylistObjectUrl(): function error', err.cause);
      }
      throw err;
    }

    loading.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load segment.';
    debugLog('loadSegment(): error', err);
  } finally {
    loading.value = false;
    debugLog('loadSegment(): done', { loading: loading.value, error: error.value });
  }
}

function seekRelative(deltaSeconds: number) {
  seekRelativeInternal(deltaSeconds);
  suppressBufferingUntilMs.value = Date.now() + 500;
  isBuffering.value = false;
}

function scrubToSeconds(seconds: number) {
  scrubToSecondsInternal(seconds);
}

function handleNarrationRecordingStarted() {
  playerRef.value?.play?.();
}

function handleNarrationRecordingStopped() {
  // No action needed when recording stops
}

function handleTimeupdate(payload: { currentTime: number; duration: number }) {
  const previousDuration = duration.value;
  handleSegmentTimeupdate(payload);
  if (!payload.duration && previousDuration) {
    duration.value = previousDuration;
  }
}

function handleLoadedMetadata(payload: { duration: number }) {
  handleSegmentLoadedMetadata(payload);
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

watch(
  [segmentId, activeOrgId],
  () => {
    if (!segmentId.value) return;
    if (!activeOrgId.value) return;
    void loadSegment();
  },
  { immediate: true }
);

watch([playlistObjectUrl, segmentId], () => {
  resetOnSourceChange();
  isPlaying.value = false;
  isBuffering.value = false;
});

onBeforeUnmount(() => {
  isBuffering.value = false;
});
</script>

<template>
  <div class="container space-y-4 py-6 text-white pb-20">
    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading segment…
    </div>

    <div v-else-if="error" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      {{ error }}
    </div>

    <div v-else-if="asset && segment" class="space-y-4">
      <!-- Video Player -->
      <div class="overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
        <div
          ref="surfaceEl"
          class="relative bg-black aspect-video"
          :class="isFullscreen ? 'h-full w-full' : 'aspect-video'"
          @pointermove="onHoverMove"
          @pointerleave="onHoverLeave"
        >
          <ShakaSurfacePlayer
            ref="playerRef"
            :manifest-url="playlistObjectUrl ?? ''"
            class="h-full w-full"
            autoplay
            @error="handlePlayerError"
            @timeupdate="handleTimeupdate"
            @loadedmetadata="handleLoadedMetadata"
            @play="handlePlay"
            @pause="handlePause"
            @buffering="handleBuffering"
          />

          <MediaPlaybackOverlayShell
            :overlay-visible="overlayVisible"
            :is-buffering="isBuffering"
            :flash-icon="flashIcon"
            :is-playing="isPlaying"
            :progress01="progress01"
            :current-seconds="segmentCurrentSeconds"
            :duration-seconds="segmentLength"
            :volume01="volume01"
            :muted="muted"
            :can-fullscreen="canFullscreen"
            :is-fullscreen="isFullscreen"
            :show-center-play-pause="false"
            :show-restart="false"
            :show-skip-controls="true"
            @tap="onTap"
            @swipe-down="() => {}"
            @swipe-up="() => {}"
            @toggle-play="togglePlay"
            @prev="() => {}"
            @next="() => {}"
            @restart="() => scrubToSeconds(0)"
            @scrub-to-seconds="scrubToSeconds"
            @scrub-start="() => showOverlay(null)"
            @scrub-end="() => showOverlay(1500)"
            @set-volume01="setVolume"
            @toggle-mute="toggleMute"
            @toggle-fullscreen="toggleFullscreen"
            @rewind-10="seekRelative(-10)"
            @forward-10="seekRelative(10)"
          />
        </div>
      </div>

      <!-- Segment Info -->
      <div class="space-y-1">
        <h1 class="text-white text-xl font-semibold">{{ segmentTitle }}</h1>
        <div class="text-xs font-medium tracking-wide text-white/50">
          {{ assetTitle }}
        </div>
      </div>

      <!-- Narration View Component -->
      <NarrationView
        v-if="activeOrgId && asset"
        :segment-id="segmentId"
        :media-asset-id="asset.id"
        :org-id="activeOrgId"
        @recording-started="handleNarrationRecordingStarted"
        @recording-stopped="handleNarrationRecordingStopped"
      />
    </div>
  </div>
</template>
