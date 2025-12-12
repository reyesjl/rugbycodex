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

const stopPlayback = () => {
  const el = videoEl.value;
  if (!el) return;
  el.pause();
  el.currentTime = 0;
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

const startRecording = async () => {
  audioError.value = null;
  if (isRecording.value) return;
  const el = videoEl.value;
  if (!el) {
    audioError.value = 'Video player not ready.';
    return;
  }

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
    const stream = await nav.mediaDevices.getUserMedia({ audio: true });
    recorderStream.value = stream;

    recordChunks.value = [];
    recordStartAtSeconds.value = Number.isFinite(el.currentTime) ? el.currentTime : 0;

    const mr = new MediaRecorder(stream);
    recorder.value = mr;

    mr.ondataavailable = (evt: BlobEvent) => {
      if (evt.data && evt.data.size > 0) {
        recordChunks.value = [...recordChunks.value, evt.data];
      }
    };

    mr.onstop = () => {
      try {
        const startAt = recordStartAtSeconds.value ?? 0;
        const endAt = Number.isFinite(el.currentTime) ? el.currentTime : startAt;
        const blob = new Blob(recordChunks.value, { type: mr.mimeType || 'audio/webm' });
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
        recordChunks.value = [];
        recordStartAtSeconds.value = null;
      }
    };

    mr.start();
    isRecording.value = true;
  } catch (e) {
    audioError.value = e instanceof Error ? e.message : 'Unable to start recording.';
    stopRecording();
  }
};

const stopRecording = () => {
  if (!isRecording.value) return;
  isRecording.value = false;

  const mr = recorder.value;
  if (mr && mr.state !== 'inactive') {
    try {
      mr.stop();
    } catch {
      // no-op
    }
  }
  recorder.value = null;

  const stream = recorderStream.value;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  recorderStream.value = null;
};

const seekToClip = (clip: AudioClip) => {
  seekTo(clip.startAtSeconds);
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
        <div v-if="signedUrl && canRenderPlayer" class="aspect-video bg-black">
          <video
            ref="videoEl"
            :src="signedUrl"
            class="h-full w-full"
            playsinline
            @loadedmetadata="syncFromVideo"
            @timeupdate="syncFromVideo"
            @durationchange="syncFromVideo"
            @play="syncFromVideo"
            @pause="syncFromVideo"
            @volumechange="syncFromVideo"
          />
        </div>
        <div v-else class="p-4 text-white/70">
          This file type can’t be previewed in the browser right now.
        </div>
      </div>

      <div v-if="signedUrl && canRenderPlayer" class="space-y-3 rounded border border-white/10 bg-white/5 p-4">
        <div class="space-y-1">
          <input
            type="range"
            class="w-full"
            min="0"
            :max="Math.max(0, durationSeconds)"
            step="0.1"
            :value="currentSeconds"
            @input="(e) => seekTo(Number((e.target as HTMLInputElement).value))"
            aria-label="Seek"
          />
          <div class="flex items-center justify-between text-xs text-white/70">
            <span>{{ formatDurationClock(currentSeconds) }}</span>
            <span>{{ formatDurationClock(durationSeconds) }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
              @click="togglePlay"
            >
              <Icon :icon="isPlaying ? 'carbon:pause' : 'carbon:play'" class="h-4 w-4" />
              {{ isPlaying ? 'Pause' : 'Play' }}
            </button>

            <button
              type="button"
              class="inline-flex items-center gap-2 rounded border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
              @click="stopPlayback"
            >
              <Icon icon="carbon:stop" class="h-4 w-4" />
              Stop
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
              @click="toggleMute"
              :title="isMuted ? 'Unmute' : 'Mute'"
            >
              <Icon :icon="isMuted || volume === 0 ? 'carbon:volume-mute' : 'carbon:volume-up'" class="h-4 w-4" />
              <span class="sr-only">Toggle mute</span>
            </button>

            <input
              type="range"
              class="w-32"
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

      <div v-if="signedUrl && canRenderPlayer" class="space-y-3 rounded border border-white/10 bg-white/5 p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-white/70">Audio track</p>
            <p class="text-xs text-white/60">Record voice notes synced to the current video time.</p>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="!isRecording"
              type="button"
              class="inline-flex items-center gap-2 rounded border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
              @click="startRecording"
            >
              <Icon icon="carbon:microphone" class="h-4 w-4" />
              Record
            </button>
            <button
              v-else
              type="button"
              class="inline-flex items-center gap-2 rounded border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
              @click="stopRecording"
            >
              <Icon icon="carbon:stop" class="h-4 w-4" />
              Stop recording
            </button>
          </div>
        </div>

        <div v-if="audioError" class="rounded border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-white">
          {{ audioError }}
        </div>

        <div v-if="isRecording" class="rounded border border-white/10 bg-black/20 p-3 text-sm text-white/80">
          Recording… start at {{ formatDurationClock(recordStartAtSeconds ?? currentSeconds) }}
        </div>

        <div v-if="audioClips.length" class="space-y-2">
          <div
            v-for="clip in audioClips"
            :key="clip.id"
            class="rounded border border-white/10 bg-black/20 p-3"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div class="text-sm">
                <div class="font-semibold">
                  Clip @ {{ formatDurationClock(clip.startAtSeconds) }}
                  <span class="text-white/50">→</span>
                  {{ formatDurationClock(clip.endAtSeconds) }}
                </div>
                <div class="text-xs text-white/60">Recorded {{ clip.createdAt.toLocaleString() }}</div>
              </div>
              <button
                type="button"
                class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                @click="seekToClip(clip)"
              >
                Jump
              </button>
            </div>
            <div class="mt-2">
              <audio :src="clip.url" controls class="w-full" />
            </div>
          </div>
        </div>

        <div v-else class="text-sm text-white/60">
          No recordings yet.
        </div>
      </div>
    </div>
  </section>
</template>
