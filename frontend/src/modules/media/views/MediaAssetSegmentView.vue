<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import HlsPlayer from '@/components/HlsPlayer.vue';
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
const videoEl = ref<HTMLVideoElement | null>(null);

const isPlaying = ref(false);
const narrationViewRef = ref<InstanceType<typeof NarrationView> | null>(null);

type PlayerOverlay =
  | { kind: 'seek'; direction: 'back' | 'forward'; seconds: number }
  | { kind: 'seek-limit'; edge: 'start' | 'end' }
  | { kind: 'play' }
  | { kind: 'pause' }
  | { kind: 'restart' };

const playerOverlay = ref<PlayerOverlay | null>(null);
let playerOverlayTimeout: number | null = null;

function showPlayerOverlay(overlay: PlayerOverlay, durationMs = 650) {
  playerOverlay.value = overlay;
  if (playerOverlayTimeout !== null) {
    clearTimeout(playerOverlayTimeout);
  }
  playerOverlayTimeout = window.setTimeout(() => {
    playerOverlay.value = null;
    playerOverlayTimeout = null;
  }, durationMs);
}

function showSeekOverlay(direction: 'back' | 'forward', seconds: number) {
  showPlayerOverlay({ kind: 'seek', direction, seconds });
}

function showSeekLimitOverlay(edge: 'start' | 'end') {
  showPlayerOverlay({ kind: 'seek-limit', edge }, 900);
}

const title = computed(() => {
  if (asset.value?.title?.trim()) return asset.value.title;
  const fileName = asset.value?.file_name ?? '';
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled clip';
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

// Seek to segment start and loop within bounds
let teardownPlayback: (() => void) | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function handleRestart() {
  if (!videoEl.value || !segment.value) return;
  videoEl.value.currentTime = segment.value.start_seconds;
  showPlayerOverlay({ kind: 'restart' });
}

function handleBack() {
  if (!videoEl.value || !segment.value) return;
  const attemptedTime = videoEl.value.currentTime - 5;
  const clampedTime = clamp(attemptedTime, segment.value.start_seconds, segment.value.end_seconds);
  videoEl.value.currentTime = clampedTime;
  if (clampedTime !== attemptedTime) {
    showSeekLimitOverlay('start');
  } else {
    showSeekOverlay('back', 5);
  }
}

function handlePlayPause() {
  if (!videoEl.value) return;
  if (videoEl.value.paused) {
    showPlayerOverlay({ kind: 'play' });
    videoEl.value.play().catch((err) => {
      debugLog('play failed', err);
    });
  } else {
    videoEl.value.pause();
    showPlayerOverlay({ kind: 'pause' });
  }
}

function handleForward() {
  if (!videoEl.value || !segment.value) return;
  const attemptedTime = videoEl.value.currentTime + 5;
  const clampedTime = clamp(attemptedTime, segment.value.start_seconds, segment.value.end_seconds);
  videoEl.value.currentTime = clampedTime;
  if (clampedTime !== attemptedTime) {
    showSeekLimitOverlay('end');
  } else {
    showSeekOverlay('forward', 5);
  }
}

function handleNarrationRecordingStarted() {
  // If video is paused, play it when recording starts
  if (videoEl.value && videoEl.value.paused) {
    videoEl.value.play().catch((err) => {
      debugLog('play on record start failed', err);
    });
  }
}

function handleNarrationRecordingStopped() {
  // No action needed when recording stops
}

function handleRecordToggle() {
  // This button is no longer used - recording is handled in NarrationView
  // Keeping for backward compatibility
}

function updatePlayingState() {
  if (!videoEl.value) return;
  isPlaying.value = !videoEl.value.paused;
}

function setupSegmentPlayback() {
  if (!videoEl.value || !segment.value) return;

  // If we re-run setup (e.g. route changes, playlist reload), ensure we don't
  // stack event listeners.
  if (teardownPlayback) {
    teardownPlayback();
    teardownPlayback = null;
  }

  const video = videoEl.value;
  const seg = segment.value;

  // Seek to segment start
  video.currentTime = seg.start_seconds;

  const enforceBounds = (source: 'timeupdate' | 'seeking') => {
    // If user scrubs backward before the segment, clamp back to start.
    if (video.currentTime < seg.start_seconds) {
      video.currentTime = seg.start_seconds;
      if (source === 'seeking') showSeekLimitOverlay('start');
      return;
    }

    // If user scrubs forward past end (or playback naturally reaches end),
    // clamp to segment end and require manual restart.
    if (video.currentTime >= seg.end_seconds) {
      video.currentTime = seg.end_seconds;
      if (!video.paused) {
        video.pause();
      }
      if (source === 'seeking') showSeekLimitOverlay('end');
    }
  };

  const enforceBoundsTimeupdate = () => enforceBounds('timeupdate');
  const enforceBoundsSeeking = () => enforceBounds('seeking');

  // timeupdate covers normal playback; seeking catches user scrubs immediately.
  video.addEventListener('timeupdate', enforceBoundsTimeupdate);
  video.addEventListener('seeking', enforceBoundsSeeking);

  // Track play/pause state
  video.addEventListener('play', updatePlayingState);
  video.addEventListener('pause', updatePlayingState);

  teardownPlayback = () => {
    video.removeEventListener('timeupdate', enforceBoundsTimeupdate);
    video.removeEventListener('seeking', enforceBoundsSeeking);
    video.removeEventListener('play', updatePlayingState);
    video.removeEventListener('pause', updatePlayingState);
  };

  // Cleanup
  onBeforeUnmount(() => {
    teardownPlayback?.();
    teardownPlayback = null;
    if (playerOverlayTimeout !== null) {
      clearTimeout(playerOverlayTimeout);
      playerOverlayTimeout = null;
    }
  });

  // Auto-play
  const playPromise = video.play();
  if (playPromise) {
    playPromise.catch((err) => {
      debugLog('autoplay blocked', err);
    });
  }

  // Initialize playing state
  updatePlayingState();
}

watch([segmentId, activeOrgId], () => {
  if (!segmentId.value) return;
  if (!activeOrgId.value) return;
  void loadSegment();
}, { immediate: true });

// Setup playback after video loads
watch([playlistObjectUrl, segment], () => {
  if (playlistObjectUrl.value && segment.value) {
    // Wait for video element to be ready
    setTimeout(() => {
      const findVideo = () => {
        const vid = document.querySelector('video');
        if (vid) {
          videoEl.value = vid;
          // Wait for video metadata to load
          if (vid.readyState >= 1) {
            setupSegmentPlayback();
          } else {
            vid.addEventListener('loadedmetadata', setupSegmentPlayback, { once: true });
          }
        } else {
          setTimeout(findVideo, 100);
        }
      };
      findVideo();
    }, 100);
  }
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
        <div class="relative">
          <HlsPlayer :src="playlistObjectUrl ?? ''" class="w-full h-auto" playsinline autoplay
            @error="handlePlayerError" />

          <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-250 ease-in"
            leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
            <div v-if="playerOverlay" class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div class="flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-white backdrop-blur-sm">
                <Icon :icon="playerOverlay.kind === 'seek'
                  ? (playerOverlay.direction === 'back' ? 'carbon:skip-back' : 'carbon:skip-forward')
                  : playerOverlay.kind === 'seek-limit'
                    ? 'carbon:information'
                    : playerOverlay.kind === 'restart'
                      ? 'carbon:restart'
                      : playerOverlay.kind === 'pause'
                        ? 'carbon:pause'
                        : 'carbon:play'
                  " width="18" height="18" />
                <div class="text-sm font-medium">
                  <template v-if="playerOverlay.kind === 'seek'">
                    {{ playerOverlay.direction === 'back' ? '-' : '+' }}{{ playerOverlay.seconds }} seconds
                  </template>
                  <template v-else-if="playerOverlay.kind === 'seek-limit'">
                    {{ playerOverlay.edge === 'start' ? 'Start of segment' : 'End of segment' }}
                  </template>
                  <template v-else-if="playerOverlay.kind === 'restart'">
                    Restarted
                  </template>
                  <template v-else>
                    {{ playerOverlay.kind === 'pause' ? 'Paused' : 'Playing' }}
                  </template>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Custom Controls -->
      <div class="flex items-center justify-center gap-5">
        <div class="flex items-center">
          <button type="button"
            class="flex items-center rounded-lg px-2 py-1 text-white border border-emerald-500 bg-emerald-500/70 hover:bg-emerald-700/70 hover:cursor-pointer text-xs transition"
            @click="handleRestart" title="Restart segment">
            <Icon icon="carbon:restart" width="15" height="15" />
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button type="button"
            class="flex items-center rounded-lg px-2 py-1 text-white border border-indigo-500 bg-indigo-500/70 hover:bg-indigo-700/70 hover:cursor-pointer text-xs transition"
            @click="handleBack" title="Back 5 seconds">
            <Icon icon="carbon:skip-back" width="15" height="15" />
          </button>
          <button type="button" :class="[
            'flex items-center rounded-lg px-2 py-1 text-white text-xs transition border hover:cursor-pointer',
            isPlaying
              ? 'border-amber-500 bg-amber-500/70 hover:bg-amber-700/70'
              : 'border-sky-500 bg-sky-500/70 hover:bg-sky-700/70',
          ]" @click="handlePlayPause" :title="isPlaying ? 'Pause' : 'Play'">
            <Icon :icon="isPlaying ? 'carbon:pause' : 'carbon:play'" width="15" height="15" />
          </button>
          <button type="button"
            class="flex items-center rounded-lg px-2 py-1 text-white border border-indigo-500 bg-indigo-500/70 hover:bg-indigo-700/70 hover:cursor-pointer text-xs transition"
            @click="handleForward" title="Forward 5 seconds">
            <Icon icon="carbon:skip-forward" width="15" height="15" />
          </button>
        </div>
      </div>

      <!-- Segment Info -->
      <div class="space-y-1">
        <h1 class="text-white text-xl font-semibold">{{ title }}</h1>
        <div class="text-xs font-medium tracking-wide text-white/50">
          Segment {{ segment.segment_index + 1 }} · {{ formatMinutesSeconds(segment.start_seconds) }} - {{
            formatMinutesSeconds(segment.end_seconds) }}
        </div>
      </div>

      <!-- Narration View Component -->
      <NarrationView ref="narrationViewRef" v-if="activeOrgId && asset" :segment-id="segmentId"
        :media-asset-id="asset.id" :org-id="activeOrgId" @recording-started="handleNarrationRecordingStarted"
        @recording-stopped="handleNarrationRecordingStopped" />
    </div>
  </div>
</template>
