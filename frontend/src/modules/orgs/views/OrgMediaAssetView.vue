<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { Icon } from '@iconify/vue';
import { supabase } from '@/lib/supabaseClient';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { orgService } from '@/modules/orgs/services/orgService';
import type { OrgMediaAsset } from '@/modules/orgs/types';

const props = defineProps<{ slug?: string | string[]; assetId?: string | string[] }>();

const normalizedSlug = computed(() => {
  if (!props.slug) return null;
  return Array.isArray(props.slug) ? props.slug[0] : props.slug;
});

const normalizedAssetId = computed(() => {
  if (!props.assetId) return null;
  return Array.isArray(props.assetId) ? props.assetId[0] : props.assetId;
});

const activeOrgStore = useActiveOrgStore();
const { activeOrg } = storeToRefs(activeOrgStore);

const asset = ref<OrgMediaAsset | null>(null);
const signedUrl = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const orgMediaLink = computed(() => {
  const slug = normalizedSlug.value;
  return slug ? `/v2/orgs/${slug}/media` : '/v2/orgs';
});

const canRenderPlayer = computed(() => {
  if (!asset.value) return false;
  return asset.value.mime_type.startsWith('video/') || asset.value.mime_type === 'application/mp4' || asset.value.mime_type === 'video/mp4';
});

const videoEl = ref<HTMLVideoElement | null>(null);
const isPlaying = ref(false);
const durationSeconds = ref(0);
const currentSeconds = ref(0);
const volume = ref(1);
const isMuted = ref(false);

const formatDurationClock = (seconds?: number | null) => {
  if (seconds == null) return '0:00';
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatDate = (date?: Date | null) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

type AudioClip = {
  id: string;
  createdAt: Date;
  startAtSeconds: number;
  endAtSeconds: number;
  url: string;
};

const audioClips = ref<AudioClip[]>([]);
const isRecording = ref(false);
const audioError = ref<string | null>(null);
const recorder = ref<MediaRecorder | null>(null);
const recorderStream = ref<MediaStream | null>(null);
const recordStartAtSeconds = ref<number | null>(null);
const recordChunks = ref<BlobPart[]>([]);
const preRecordMuted = ref<boolean | null>(null);
const preRecordVolume = ref<number | null>(null);
const isRequestingMic = ref(false);

const createTempId = () => {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const syncFromVideo = () => {
  const el = videoEl.value;
  if (!el) return;
  durationSeconds.value = Number.isFinite(el.duration) ? el.duration : 0;
  currentSeconds.value = Number.isFinite(el.currentTime) ? el.currentTime : 0;
  isPlaying.value = !el.paused && !el.ended;
  volume.value = el.volume;
  isMuted.value = el.muted;
};

const togglePlay = async () => {
  const el = videoEl.value;
  if (!el) return;

  if (el.paused || el.ended) {
    try {
      await el.play();
    } catch {
      // Autoplay policies or load errors; UI will remain paused.
    }
  } else {
    el.pause();
  }
  syncFromVideo();
};

const seekTo = (nextSeconds: number) => {
  const el = videoEl.value;
  if (!el) return;
  el.currentTime = Math.max(0, Math.min(nextSeconds, Number.isFinite(el.duration) ? el.duration : nextSeconds));
  syncFromVideo();
};

const setVolume = (nextVolume: number) => {
  const el = videoEl.value;
  if (!el) return;
  const v = Math.max(0, Math.min(nextVolume, 1));
  el.volume = v;
  if (v > 0 && el.muted) el.muted = false;
  syncFromVideo();
};

const toggleMute = () => {
  const el = videoEl.value;
  if (!el) return;
  el.muted = !el.muted;
  syncFromVideo();
};

const restoreVideoAudioAfterRecording = () => {
  const el = videoEl.value;
  if (!el) return;
  if (preRecordMuted.value == null) return;

  el.muted = preRecordMuted.value;
  if (preRecordVolume.value != null) {
    el.volume = preRecordVolume.value;
  }
  preRecordMuted.value = null;
  preRecordVolume.value = null;
  syncFromVideo();
};

const cleanupRecorderResources = () => {
  // Does not call recorder.stop(); onstop finalizes the recording.
  recorder.value = null;

  const stream = recorderStream.value;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  recorderStream.value = null;
};

const startRecording = async () => {
  audioError.value = null;
  if (isRecording.value || isRequestingMic.value) return;
  const video = videoEl.value;
  if (!video) {
    audioError.value = 'Video player not ready.';
    return;
  }
  // Avoid feedback / recording bugs by muting playback while recording.
  if (preRecordMuted.value == null) {
    preRecordMuted.value = video.muted;
    preRecordVolume.value = video.volume;
  }
  video.muted = true;
  syncFromVideo();

  const nav = globalThis.navigator;
  if (!nav?.mediaDevices?.getUserMedia) {
    audioError.value = 'Audio recording is not supported in this browser.';
    return;
  }

  if (!('MediaRecorder' in globalThis)) {
    audioError.value = 'MediaRecorder is not available in this browser.';
    return;
  }

  try {
    isRequestingMic.value = true;
    const stream = await nav.mediaDevices.getUserMedia({ audio: true });
    recorderStream.value = stream;

    recordChunks.value = [];
    recordStartAtSeconds.value = Number.isFinite(video.currentTime) ? video.currentTime : 0;

    // Safari can be picky about mime types; choose the first supported one.
    const MediaRecorderCtor = globalThis.MediaRecorder;
    const preferredMimeTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    const supportedMimeType = preferredMimeTypes.find((t) => {
      try {
        return typeof MediaRecorderCtor?.isTypeSupported === 'function' ? MediaRecorderCtor.isTypeSupported(t) : false;
      } catch {
        return false;
      }
    });

    const mr = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
    recorder.value = mr;

    mr.ondataavailable = (evt: BlobEvent) => {
      if (evt.data && evt.data.size > 0) {
        recordChunks.value = [...recordChunks.value, evt.data];
      }
    };

    mr.onstop = () => {
      try {
        isRecording.value = false;
        const startAt = recordStartAtSeconds.value ?? 0;
        const currentVideoTime = videoEl.value?.currentTime;
        const endAt = Number.isFinite(currentVideoTime) ? (currentVideoTime ?? startAt) : startAt;
        const blob = new Blob(recordChunks.value, { type: mr.mimeType || supportedMimeType || 'audio/webm' });
        if (blob.size === 0) {
          audioError.value = 'No audio data was captured. Please try again.';
          return;
        }
        const url = URL.createObjectURL(blob);

        audioClips.value = [
          {
            id: createTempId(),
            createdAt: new Date(),
            startAtSeconds: startAt,
            endAtSeconds: Math.max(endAt, startAt),
            url,
          },
          ...audioClips.value,
        ];
      } finally {
        cleanupRecorderResources();
        restoreVideoAudioAfterRecording();
        recordChunks.value = [];
        recordStartAtSeconds.value = null;
      }
    };

    mr.onerror = () => {
      audioError.value = 'Audio recording error. Please try again.';
      stopRecording();
    };

    // Emit chunks while recording to reduce memory pressure on Safari.
    mr.start(250);
    isRecording.value = true;
  } catch (e: unknown) {
    audioError.value = e instanceof Error ? e.message : 'Unable to start recording.';
    cleanupRecorderResources();
    restoreVideoAudioAfterRecording();
    recordChunks.value = [];
    recordStartAtSeconds.value = null;
    isRecording.value = false;
  } finally {
    isRequestingMic.value = false;
  }
};

const stopRecording = () => {
  // Make this idempotent; Safari can throw in odd states.
  isRequestingMic.value = false;

  const mr = recorder.value;
  if (mr && mr.state !== 'inactive') {
    isRecording.value = false;
    try {
      mr.stop();
      return;
    } catch {
      // fall through
    }
  }

  isRecording.value = false;
  cleanupRecorderResources();
  restoreVideoAudioAfterRecording();
  recordChunks.value = [];
  recordStartAtSeconds.value = null;
};

const seekToClip = (clip: AudioClip) => {
  seekTo(clip.startAtSeconds);
};

const removeClip = (clipId: string) => {
  const clipEl = clipAudioEls.get(clipId);
  if (clipEl) {
    try {
      clipEl.pause();
    } catch {
      // no-op
    }
  }
  clipAudioEls.delete(clipId);

  const clip = audioClips.value.find((c) => c.id === clipId);
  if (clip) {
    try {
      URL.revokeObjectURL(clip.url);
    } catch {
      // no-op
    }
  }
  audioClips.value = audioClips.value.filter((c) => c.id !== clipId);
  const { [clipId]: _, ...rest } = clipStates.value;
  clipStates.value = rest;
};

type ClipPlayerState = {
  isPlaying: boolean;
  currentSeconds: number;
  durationSeconds: number;
  volume: number;
  isMuted: boolean;
};

const clipAudioEls = new Map<string, HTMLAudioElement>();
const clipStates = ref<Record<string, ClipPlayerState>>({});

const defaultClipState = (): ClipPlayerState => ({
  isPlaying: false,
  currentSeconds: 0,
  durationSeconds: 0,
  volume: 1,
  isMuted: false,
});

const getClipState = (clipId: string): ClipPlayerState => {
  return clipStates.value[clipId] ?? defaultClipState();
};

const setClipAudioEl = (clipId: string, el: HTMLAudioElement | null) => {
  if (!el) {
    clipAudioEls.delete(clipId);
    return;
  }
  clipAudioEls.set(clipId, el);
  syncClipFromAudio(clipId);
};

const syncClipFromAudio = (clipId: string) => {
  const el = clipAudioEls.get(clipId);
  if (!el) return;
  const prev = clipStates.value[clipId] ?? defaultClipState();
  clipStates.value = {
    ...clipStates.value,
    [clipId]: {
      ...prev,
      isPlaying: !el.paused && !el.ended,
      currentSeconds: Number.isFinite(el.currentTime) ? el.currentTime : 0,
      durationSeconds: Number.isFinite(el.duration) ? el.duration : 0,
      volume: el.volume,
      isMuted: el.muted,
    },
  };
};

const toggleClipPlay = async (clipId: string) => {
  const el = clipAudioEls.get(clipId);
  if (!el) return;

  if (el.paused || el.ended) {
    // Keep it simple: only one clip playing at a time.
    clipAudioEls.forEach((other, otherId) => {
      if (otherId === clipId) return;
      try {
        other.pause();
      } catch {
        // no-op
      }
    });

    try {
      await el.play();
    } catch {
      // no-op
    }
  } else {
    el.pause();
  }
  syncClipFromAudio(clipId);
};

const seekClipTo = (clipId: string, nextSeconds: number) => {
  const el = clipAudioEls.get(clipId);
  if (!el) return;
  const duration = Number.isFinite(el.duration) ? el.duration : nextSeconds;
  el.currentTime = Math.max(0, Math.min(nextSeconds, duration));
  syncClipFromAudio(clipId);
};

const setClipVolume = (clipId: string, nextVolume: number) => {
  const el = clipAudioEls.get(clipId);
  if (!el) return;
  const v = Math.max(0, Math.min(nextVolume, 1));
  el.volume = v;
  if (v > 0 && el.muted) el.muted = false;
  syncClipFromAudio(clipId);
};

// const formatBytes = (bytes?: number | null) => {
//   if (bytes == null) return '—';
//   if (bytes === 0) return '0 B';
//   const units = ['B', 'KB', 'MB', 'GB', 'TB'];
//   const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
//   const value = bytes / Math.pow(1024, i);
//   return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
// };

// const formatDuration = (seconds?: number | null) => {
//   if (seconds == null) return '—';
//   if (!Number.isFinite(seconds)) return '—';
//   const total = Math.max(0, Math.floor(seconds));
//   const m = Math.floor(total / 60);
//   const s = total % 60;
//   return `${m}:${String(s).padStart(2, '0')}`;
// };

const signUrl = async (nextAsset: OrgMediaAsset) => {
  const { data, error: signedError } = await supabase.storage
    .from(nextAsset.bucket)
    .createSignedUrl(nextAsset.storage_path, 60 * 60);

  if (signedError) throw signedError;
  if (!data?.signedUrl) throw new Error('Unable to create a signed URL.');
  signedUrl.value = data.signedUrl;
};

const load = async () => {
  const slug = normalizedSlug.value;
  const id = normalizedAssetId.value;
  if (!slug || !id) return;

  loading.value = true;
  error.value = null;
  asset.value = null;
  signedUrl.value = null;

  try {
    await activeOrgStore.ensureLoaded(slug);
    if (!activeOrg.value?.id) {
      throw new Error('No organization selected.');
    }

    const nextAsset = await orgService.mediaAssets.getById(activeOrg.value.id, id);
    asset.value = nextAsset;
    await signUrl(nextAsset);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load media.';
  } finally {
    loading.value = false;
  }
};

watch(
  [normalizedSlug, normalizedAssetId],
  async () => {
    await load();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopRecording();
  audioClips.value.forEach((clip) => {
    try {
      URL.revokeObjectURL(clip.url);
    } catch {
      // no-op
    }
  });
  clipAudioEls.forEach((el) => {
    try {
      el.pause();
    } catch {
      // no-op
    }
  });
  clipAudioEls.clear();
});
</script>

<template>
  <section class="container space-y-6 py-5 text-white">
    <header>
      <RouterLink
        :to="orgMediaLink"
        class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
      >
        <Icon icon="carbon:arrow-left" class="h-4 w-4" />
        Back to media
      </RouterLink>
    </header>

    <div v-if="loading" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
      Loading media…
    </div>

    <div v-else-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
      <p class="font-semibold">{{ error }}</p>
      <p class="text-sm text-white/80">Check access, then try refreshing.</p>
    </div>

    <div v-else-if="asset" class="space-y-4">
      <div class="overflow-hidden rounded border border-white/10 bg-black/30">
        <div v-if="signedUrl && canRenderPlayer" class="relative aspect-video bg-black">
          <video
            ref="videoEl"
            :src="signedUrl"
            class="h-full w-full"
            playsinline
            @click="togglePlay"
            @loadedmetadata="syncFromVideo"
            @timeupdate="syncFromVideo"
            @durationchange="syncFromVideo"
            @play="syncFromVideo"
            @pause="syncFromVideo"
            @volumechange="syncFromVideo"
          />

          <!-- Record (top-right) -->
          <button
            type="button"
            class="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-black/40 text-white backdrop-blur-sm transition"
            :class="isRecording ? 'border-rose-300/60' : 'border-white/30 hover:bg-white hover:text-black'"
            :title="isRecording ? 'Stop recording' : 'Record voice note'"
            @click.stop="isRecording ? stopRecording() : startRecording()"
          >
            <Icon
              v-if="isRecording"
              icon="carbon:pause"
              class="h-5 w-5"
              aria-hidden="true"
            />
            <span
              v-else
              class="h-3 w-3 rounded-full bg-rose-500"
              aria-hidden="true"
            />
            <span class="sr-only">{{ isRecording ? 'Stop recording' : 'Record voice note' }}</span>
          </button>

          <!-- Minimal overlay controls (no native controls) -->
          <div class="pointer-events-none absolute inset-0 flex flex-col justify-end">
            <div class="pointer-events-auto bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3">
              <input
                type="range"
                class="h-1 w-full cursor-pointer accent-white"
                min="0"
                :max="Math.max(0, durationSeconds)"
                step="0.1"
                :value="currentSeconds"
                @input="(e) => seekTo(Number((e.target as HTMLInputElement).value))"
                aria-label="Seek"
              />

              <div class="mt-2 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white hover:text-black"
                    @click="togglePlay"
                    :title="isPlaying ? 'Pause' : 'Play'"
                  >
                    <Icon :icon="isPlaying ? 'carbon:pause' : 'carbon:play'" class="h-4 w-4" />
                    <span class="sr-only">{{ isPlaying ? 'Pause' : 'Play' }}</span>
                  </button>

                  <div class="text-xs text-white/80 tabular-nums">
                    {{ formatDurationClock(currentSeconds) }} / {{ formatDurationClock(durationSeconds) }}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white hover:text-black"
                    @click="toggleMute"
                    :title="isMuted ? 'Unmute' : 'Mute'"
                  >
                    <Icon :icon="isMuted || volume === 0 ? 'carbon:volume-mute' : 'carbon:volume-up'" class="h-4 w-4" />
                    <span class="sr-only">Toggle mute</span>
                  </button>

                  <input
                    type="range"
                    class="h-1 w-24 cursor-pointer accent-white"
                    min="0"
                    max="1"
                    step="0.01"
                    :value="isMuted ? 0 : volume"
                    @input="(e) => setVolume(Number((e.target as HTMLInputElement).value))"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="p-4 text-white/70">
          This file type can’t be previewed in the browser right now.
        </div>
      </div>

      <div class="space-y-2">
        <h2 class="text-xl font-semibold leading-snug">
          {{ asset.file_name }}
        </h2>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/70">
          <span>{{ formatDate(asset.created_at) }}</span>
          <span class="uppercase">{{ asset.status }}</span>
        </div>
        <!-- <div class="rounded border border-white/10 bg-white/5 p-3">
          <p class="text-xs uppercase tracking-wide text-white/50">Storage</p>
          <p class="mt-1 font-mono text-xs text-white/70">{{ asset.bucket }}/{{ asset.storage_path }}</p>
        </div> -->
      </div>

      <div v-if="signedUrl && canRenderPlayer" class="space-y-2 rounded border border-white/10 bg-white/5 p-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-white/70">Audio track</p>
            <p class="text-xs text-white/60">Voice notes synced to video time.</p>
          </div>
        </div>

        <div v-if="audioError" class="rounded border border-rose-400/40 bg-rose-500/10 p-2 text-xs text-white">
          {{ audioError }}
        </div>

        <div v-if="isRecording" class="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/80">
          Recording… start at {{ formatDurationClock(recordStartAtSeconds ?? currentSeconds) }}
        </div>

        <div v-if="audioClips.length" class="space-y-1.5">
          <div
            v-for="clip in audioClips"
            :key="clip.id"
            class="rounded border border-white/10 bg-black/20 p-2"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 text-xs">
                <div class="truncate font-semibold">
                  {{ formatDurationClock(clip.startAtSeconds) }}
                  <span class="text-white/50">→</span>
                  {{ formatDurationClock(clip.endAtSeconds) }}
                  <span class="text-white/50">•</span>
                  <span class="font-normal text-white/60">{{ clip.createdAt.toLocaleString() }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:text-white"
                  @click="seekToClip(clip)"
                  title="Jump to clip"
                >
                  <Icon icon="carbon:skip-back" class="h-4 w-4" />
                  <span class="sr-only">Jump</span>
                </button>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:text-white"
                  @click="removeClip(clip.id)"
                  title="Remove clip"
                >
                  <Icon icon="carbon:trash-can" class="h-4 w-4" />
                  <span class="sr-only">Remove</span>
                </button>
              </div>
            </div>
            <div class="mt-1">
              <audio
                :src="clip.url"
                :ref="(el) => setClipAudioEl(clip.id, el as HTMLAudioElement | null)"
                class="hidden"
                preload="metadata"
                @loadedmetadata="() => syncClipFromAudio(clip.id)"
                @timeupdate="() => syncClipFromAudio(clip.id)"
                @play="() => syncClipFromAudio(clip.id)"
                @pause="() => syncClipFromAudio(clip.id)"
                @volumechange="() => syncClipFromAudio(clip.id)"
              />

              <div class="mt-1 space-y-1">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:text-white"
                    @click="toggleClipPlay(clip.id)"
                    :title="getClipState(clip.id).isPlaying ? 'Pause clip' : 'Play clip'"
                  >
                    <Icon
                      :icon="getClipState(clip.id).isPlaying ? 'carbon:pause' : 'carbon:play'"
                      class="h-4 w-4"
                    />
                    <span class="sr-only">{{ getClipState(clip.id).isPlaying ? 'Pause' : 'Play' }}</span>
                  </button>

                  <input
                    type="range"
                    class="h-1 flex-1 cursor-pointer accent-white"
                    min="0"
                    :max="Math.max(0, getClipState(clip.id).durationSeconds)"
                    step="0.1"
                    :value="getClipState(clip.id).currentSeconds"
                    @input="(e) => seekClipTo(clip.id, Number((e.target as HTMLInputElement).value))"
                    aria-label="Clip seek"
                  />

                  <div class="text-[10px] text-white/70 tabular-nums">
                    {{ formatDurationClock(getClipState(clip.id).currentSeconds) }}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <Icon
                    :icon="getClipState(clip.id).isMuted || getClipState(clip.id).volume === 0 ? 'carbon:volume-mute' : 'carbon:volume-up'"
                    class="h-3.5 w-3.5 text-white/70"
                    aria-hidden="true"
                  />
                  <input
                    type="range"
                    class="h-1 w-24 cursor-pointer accent-white"
                    min="0"
                    max="1"
                    step="0.01"
                    :value="getClipState(clip.id).isMuted ? 0 : getClipState(clip.id).volume"
                    @input="(e) => setClipVolume(clip.id, Number((e.target as HTMLInputElement).value))"
                    aria-label="Clip volume"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-xs text-white/60">
          No recordings yet.
        </div>
      </div>
    </div>
  </section>
</template>
