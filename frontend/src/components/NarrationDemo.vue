<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

type NarrationCategory = 'commentary' | 'playerReflection' | 'coachNotes' | 'analystReview';

interface NarrationExample {
  id: NarrationCategory;
  label: string;
  summary: string;
  audioSrc: string;
  transcript: string;
  durationLabel: string;
}

const waveformSegments = 84;

const commentarySrc = new URL('../assets/audio/ngwenya-demo.mp3', import.meta.url).href;
const coachSrc = new URL('../assets/audio/coach-demo2.mp3', import.meta.url).href;
const playerSrc = new URL('../assets/audio/player-demo.mp3', import.meta.url).href;

const narrationExamples: NarrationExample[] = [
  {
    id: 'commentary',
    label: 'Commentary',
    summary: 'Broadcast-style recap of the attacking move from the booth perspective.',
    audioSrc: commentarySrc,
    transcript: `The Springboks sensing a chance to record the bonus-point victory. Clever intercepts! I don’t think he’s got the legs to go the whole way—looking for support—finds it from another forward, Alec Parker. They’re looking for the gasman outside—Ngwenya’s got it now! Over the ten-metre line—inside, then outside Habana! Wave bye-bye, boys—he’s over for the score! What a sensational try from the Zimbabwe-born number 14, Takudzwa Ngwenya, playing for the USA Eagles. We mentioned the threat before—he’s taken Habana on the outside; foot to the floor, pedal to the metal—and the Eagles have their first try!`,
    durationLabel: '0:30',
  },
  {
    id: 'playerReflection',
    label: 'Player reflection',
    summary: 'First-person debrief focused on decision making after the match.',
    audioSrc: playerSrc,
    transcript: `We’d been on their line for a few phases and Hope went low first but got stopped just short. When the ball came back I saw space by the ruck so I kept low, drove hard, and got over. It was all about patience and clean work from the pack. Nothing fancy—just good control and finishing what we started against a strong Black Ferns defense.`,
    durationLabel: '0:30',
  },
  {
    id: 'coachNotes',
    label: 'Coach notes',
    summary: 'Training feedback emphasising shape and scanning habits.',
    audioSrc: coachSrc,
    transcript: `Boys, selection this week’s been about combinations, form, and finish. You’ve earned your spots now. Ireland’s got history with us, and we’ve talked about those lessons. This time, we stay a step ahead. They’ll be clear in how they play—organized, physical, disciplined—and they’ll finish strong off the bench. So it’s about us: how we connect, how we execute, and how we finish. It’ll be tight, it’ll be physical, and the margins will be small—maybe a call, maybe a bounce. But if we’re our best on the day, that’s enough.`,
    durationLabel: '0:34',
  },
];

const createFallbackWaveform = (segments = waveformSegments) =>
  Array.from({ length: segments }, (_, index) => {
    const base = 0.35 + 0.25 * Math.sin(index / 2.6);
    const accent = 0.15 * Math.sin(index / 1.2);
    return Math.min(1, Math.max(0.12, base + accent));
  });

const selectedExampleId = ref<NarrationCategory>('commentary');
const selectedExample = computed(
  () => narrationExamples.find((example) => example.id === selectedExampleId.value) ?? narrationExamples[0]
);

const audioRef = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const audioReady = ref(false);
const playbackRatio = ref(0);
const playbackError = ref<string | null>(null);
const showTranscript = ref(false);

const waveformData = ref<number[]>(createFallbackWaveform());
const loadingWaveform = ref(false);
const waveformError = ref<string | null>(null);

const waveformCache = new Map<string, number[]>();
let waveformRequestToken = 0;

const highlightedWaveformBars = computed(() => {
  const total = waveformData.value.length;
  if (total === 0) return 0;
  return Math.round(total * playbackRatio.value);
});

const playButtonLabel = computed(() => {
  if (!audioReady.value) return 'Loading audio';
  return isPlaying.value ? 'Pause' : 'Play';
});

const transcriptButtonLabel = computed(() =>
  showTranscript.value ? 'Hide transcript' : 'Reveal transcript'
);

const loadWaveform = async (url: string) => {
  const cached = waveformCache.get(url);
  if (cached) {
    waveformData.value = cached;
    waveformError.value = null;
    return;
  }

  const requestId = ++waveformRequestToken;

  if (typeof window === 'undefined') {
    waveformData.value = createFallbackWaveform();
    waveformError.value = null;
    return;
  }

  loadingWaveform.value = true;
  waveformError.value = null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to load audio preview (status ${response.status}).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!ctor) {
      throw new Error('Waveform preview is not supported in this browser.');
    }

    const audioContext = new ctor();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const samples = waveformSegments;
      const blockSize = Math.max(1, Math.floor(channelData.length / samples));
      const waveform: number[] = [];

      for (let i = 0; i < samples; i += 1) {
        const start = i * blockSize;
        let sum = 0;
        let count = 0;

        for (let j = 0; j < blockSize && start + j < channelData.length; j += 1) {
          const sample = channelData[start + j] ?? 0;
          sum += Math.abs(sample);
          count += 1;
        }

        waveform.push(count ? sum / count : 0);
      }

      const max = Math.max(...waveform);
      const normalized =
        max > 0 ? waveform.map((value) => Math.min(1, value / max)) : createFallbackWaveform(samples);

      waveformCache.set(url, normalized);
      if (waveformRequestToken === requestId) {
        waveformData.value = normalized;
      }
    } finally {
      await audioContext.close();
    }
  } catch (error) {
    if (waveformRequestToken === requestId) {
      waveformError.value =
        error instanceof Error ? error.message : 'Waveform preview unavailable right now.';
      const fallback = createFallbackWaveform();
      waveformCache.set(url, fallback);
      waveformData.value = fallback;
    }
  } finally {
    if (waveformRequestToken === requestId) {
      loadingWaveform.value = false;
    }
  }
};

const togglePlayback = async () => {
  const element = audioRef.value;
  if (!element) return;

  if (isPlaying.value) {
    element.pause();
    return;
  }

  playbackError.value = null;

  try {
    await element.play();
  } catch (error) {
    playbackError.value =
      error instanceof Error ? error.message : 'Unable to start playback. Please try again.';
  }
};

const resetPlayback = () => {
  const element = audioRef.value;
  if (!element) return;

  element.pause();
  element.currentTime = 0;
  playbackRatio.value = 0;
  isPlaying.value = false;
  playbackError.value = null;
};

const toggleTranscript = () => {
  showTranscript.value = !showTranscript.value;
};

const handleLoadedMetadata = () => {
  audioReady.value = true;
  playbackError.value = null;
};

const handleAudioPlay = () => {
  isPlaying.value = true;
  playbackError.value = null;
};

const handleAudioPause = () => {
  isPlaying.value = false;
};

const handleAudioEnded = () => {
  const element = audioRef.value;
  if (!element) return;

  element.pause();
  element.currentTime = 0;
  playbackRatio.value = 0;
  isPlaying.value = false;
};

const handleTimeUpdate = () => {
  const element = audioRef.value;
  if (!element || !Number.isFinite(element.duration) || element.duration <= 0) {
    playbackRatio.value = 0;
    return;
  }

  playbackRatio.value = Math.min(1, Math.max(0, element.currentTime / element.duration));
};

watch(
  selectedExample,
  (example) => {
    if (!example) return;

    showTranscript.value = false;
    playbackRatio.value = 0;
    audioReady.value = false;
    isPlaying.value = false;
    playbackError.value = null;

    if (audioRef.value) {
      audioRef.value.pause();
      audioRef.value.currentTime = 0;
    }

    void loadWaveform(example.audioSrc);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  audioRef.value?.pause();
});
</script>

<template>
  <section
    class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Narration Demo
        </p>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Examples
        </h2>
        <!-- <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ selectedExample.summary }}
        </p> -->
      </div>
      <select id="narration-demo-select" v-model="selectedExampleId"
        class="w-full rounded-full border border-neutral-300/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-800/70 disabled:cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-100/40 dark:[color-scheme:dark] md:w-auto">
        <option v-for="example in narrationExamples" :key="example.id" :value="example.id">
          {{ example.label }}
        </option>
      </select>
    </header>

    <div
      class="mt-6 rounded-3xl border border-neutral-200/60 bg-white/70 p-5 transition dark:border-neutral-800/70 dark:bg-neutral-900/60">
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
          <button type="button"
            class="relative inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-neutral-200/60 bg-neutral-50 text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:border-neutral-500 dark:hover:bg-neutral-700"
            :disabled="!audioReady || loadingWaveform" :aria-label="playButtonLabel" @click="togglePlayback">
            <span v-if="!audioReady || loadingWaveform" class="text-xs font-semibold uppercase tracking-[0.2em]">
              ...
            </span>
            <span v-else class="play-toggle" :class="isPlaying ? 'play-toggle--pause' : 'play-toggle--play'"
              aria-hidden="true"></span>
          </button>
          <div class="relative flex-1">
            <p class="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              {{ selectedExample?.label }}
            </p>
            <div
              class="relative overflow-hidden rounded-2xl border border-neutral-200/40 bg-neutral-950/90 px-4 py-4 shadow-inner dark:border-neutral-800/50 dark:bg-neutral-950/80">
              <div class="flex h-16 items-end gap-[2px]" aria-hidden="true">
                <div v-for="(value, index) in waveformData" :key="index"
                  class="flex-1 rounded-full transition-[background-color,height] duration-200" :class="index < highlightedWaveformBars
                      ? 'bg-neutral-50 dark:bg-neutral-100'
                      : 'bg-neutral-600/60 dark:bg-neutral-700/60'
                    " :style="{ height: `${Math.round(Math.max(0.12, value) * 100)}%` }"></div>
              </div>
              <div v-if="loadingWaveform"
                class="absolute inset-0 flex items-center justify-center bg-neutral-950/70 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-300">
                Generating waveform…
              </div>
            </div>
            <div class="mt-2 flex items-center justify-end text-xs text-neutral-500 dark:text-neutral-400">
              <button type="button"
                class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 transition hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
                :disabled="playbackRatio === 0 && !isPlaying" @click="resetPlayback">
                Reset playback
              </button>
            </div>
            <p v-if="playbackError" class="mt-2 text-xs text-rose-500 dark:text-rose-400">
              {{ playbackError }}
            </p>
            <p v-else-if="waveformError" class="mt-2 text-xs text-amber-500 dark:text-amber-400">
              {{ waveformError }}
            </p>
          </div>
        </div>

        <button type="button"
          class="w-full rounded-2xl border border-neutral-300/80 bg-neutral-950/90 px-4 py-3 text-sm font-semibold text-neutral-50 transition hover:border-neutral-200 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
          @click="toggleTranscript">
          {{ transcriptButtonLabel }}
        </button>

        <transition name="fade">
          <div v-if="showTranscript"
            class="rounded-2xl border border-neutral-200/60 bg-neutral-50/90 p-4 text-sm text-neutral-700 dark:border-neutral-800/70 dark:bg-neutral-900/80 dark:text-neutral-100">
            <p v-for="(paragraph, index) in selectedExample?.transcript?.split('\n\n')" :key="index"
              class="mb-3 last:mb-0">
              {{ paragraph }}
            </p>
          </div>
        </transition>
      </div>
    </div>

    <p class="mt-6 text-xs text-neutral-400 dark:text-neutral-500">
      These samples are pre-recorded for the demo. Recording your own audio is disabled here.
    </p>

    <audio ref="audioRef" :key="selectedExample?.id" class="hidden" :src="selectedExample?.audioSrc" preload="auto"
      @loadedmetadata="handleLoadedMetadata" @play="handleAudioPlay" @pause="handleAudioPause" @ended="handleAudioEnded"
      @timeupdate="handleTimeUpdate"></audio>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.play-toggle {
  display: block;
  position: relative;
  width: 0;
  height: 0;
}

.play-toggle--play {
  border-style: solid;
  border-width: 8px 0 8px 12px;
  border-color: transparent transparent transparent currentColor;
}

.play-toggle--pause {
  width: 12px;
  height: 16px;
}

.play-toggle--pause::before,
.play-toggle--pause::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  background: currentColor;
}

.play-toggle--pause::before {
  left: 0;
}

.play-toggle--pause::after {
  right: 0;
}
</style>
