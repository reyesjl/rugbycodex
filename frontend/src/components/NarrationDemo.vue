<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const maxDurationMs = 30_000;
const maxDurationSeconds = Math.floor(maxDurationMs / 1000);
const recordingSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

const isRecording = ref(false);
const isPlaying = ref(false);
const elapsedMs = ref(0);
const playbackProgress = ref(0);
const audioUrl = ref<string | null>(null);
const audioBlob = ref<Blob | null>(null);
const transcription = ref('');
const transcriptionError = ref<string | null>(null);
const transcribing = ref(false);
const audioRef = ref<HTMLAudioElement | null>(null);

const elapsedLabel = computed(() => {
  const seconds = Math.floor(elapsedMs.value / 1000);
  const fractional = Math.floor((elapsedMs.value % 1000) / 100);
  return `${seconds}.${fractional}s`;
});

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let timerHandle: number | null = null;
let audioChunks: BlobPart[] = [];
let activeObjectUrl: string | null = null;

type TeleprompterMode = 'idle' | 'recording' | 'playback';

const narrationSamples = [
  {
    title: 'Analytic narration',
    subtitle: 'Sample narration text',
    body: `This clip starts with a lineout just outside our 22. The jumper wins clean ball, but the nine is a step slow to clear, which lets the defense close the gap. Watch how our ten takes the ball under pressure. He steps inside to buy time, then shifts play wide through the twelve. The key skill here is decision speed under pressure and the support line from the fullback, who hits the gap on the edge.

For improvement, the nine needs to recognize when the pod isn't set and play short earlier. Communication from the forwards should trigger that adjustment.`,
  },
  {
    title: 'Developmental narration',
    subtitle: 'Training situation example',
    body: `We're running a 3v2 decision drill. The goal is to read the defender's hips, not just their shoulders. Notice here, the ball carrier fixes too early and passes before the defender has committed. The better option was to take two more steps, hold the defender, and free the outside runner.

This is where timing and scanning matter: head up, eyes forward, not locked on the ball.`,
  },
  {
    title: 'Player reflection',
    subtitle: 'Player reflection example',
    body: `I rushed the pass here because I saw the wing closing in. Watching it back, I had more time than I thought. If I stay square and take another step, I draw the defender and open the offload channel. That's something I want to work on next session.`,
  },
];

const activeSampleIndex = ref(0);
const activeSample = computed(() => narrationSamples[activeSampleIndex.value]);
const teleprompterViewportRef = ref<HTMLDivElement | null>(null);
const teleprompterTrackRef = ref<HTMLDivElement | null>(null);
const teleprompterProgress = ref(0);
const teleprompterMode = ref<TeleprompterMode>('idle');
const teleprompterActive = ref(false);
const teleprompterMaxOffset = ref(0);
const wordsPerMinute = 170;
const msPerWord = Math.round(60_000 / wordsPerMinute);

const teleprompterWords = computed(() => {
  const script = activeSample?.value?.body.replace(/\s+/g, ' ').trim();
  if (!script) return [];
  return script.split(' ');
});

const teleprompterDurationMs = computed(() => {
  const words = teleprompterWords.value.length;
  if (words === 0) return 5000;
  return Math.max(words * msPerWord, 5000);
});

const highlightedWordCount = computed(() => {
  if (teleprompterWords.value.length === 0) return 0;
  const count = Math.floor(teleprompterProgress.value * teleprompterWords.value.length);
  return Math.min(count, teleprompterWords.value.length);
});

const teleprompterTransform = computed(() => {
  const offset = teleprompterMaxOffset.value * teleprompterProgress.value;
  return `translateX(-${offset}px)`;
});

const measureTeleprompter = () => {
  if (!teleprompterViewportRef.value || !teleprompterTrackRef.value) {
    teleprompterMaxOffset.value = 0;
    return;
  }
  const viewportWidth = teleprompterViewportRef.value.clientWidth;
  const trackWidth = teleprompterTrackRef.value.scrollWidth;
  teleprompterMaxOffset.value = Math.max(0, trackWidth - viewportWidth);
};

const resetTeleprompterState = () => {
  teleprompterProgress.value = 0;
  teleprompterMode.value = 'idle';
  teleprompterActive.value = false;
};

const resetTeleprompter = () => {
  resetTeleprompterState();
  nextTick(measureTeleprompter);
};

const startTeleprompterForRecording = () => {
  resetTeleprompterState();
  teleprompterMode.value = 'recording';
  teleprompterActive.value = true;
};

const startTeleprompterForPlayback = () => {
  if (!audioRef.value) return;
  if (audioRef.value.currentTime === 0 || audioRef.value.currentTime === audioRef.value.duration) {
    teleprompterProgress.value = 0;
  }
  teleprompterMode.value = 'playback';
  teleprompterActive.value = true;
};

const pauseTeleprompter = () => {
  teleprompterActive.value = false;
};

const cycleSample = (direction: -1 | 1) => {
  if (narrationSamples.length <= 1) return;
  const total = narrationSamples.length;
  activeSampleIndex.value = (activeSampleIndex.value + direction + total) % total;
};

const selectSample = (index: number) => {
  if (index === activeSampleIndex.value) return;
  activeSampleIndex.value = index;
};

const clearTimer = () => {
  if (timerHandle !== null) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
};

const stopMediaStream = () => {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
};

const resetRecordingState = () => {
  isRecording.value = false;
  elapsedMs.value = 0;
  audioChunks = [];
  mediaRecorder = null;
  clearTimer();
  stopMediaStream();
};

const revokeObjectUrl = () => {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
};

const finalizeRecording = () => {
  const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType ?? 'audio/webm' });
  audioBlob.value = blob;
  revokeObjectUrl();
  const url = URL.createObjectURL(blob);
  activeObjectUrl = url;
  audioUrl.value = url;
  transcription.value = '';
  transcriptionError.value = null;
  playbackProgress.value = 0;
  void audioRef.value?.load();
  void transcribeLatest();
};

const handleRecorderStop = () => {
  finalizeRecording();
  resetRecordingState();
};

const startRecording = async () => {
  if (isRecording.value || !recordingSupported) return;
  transcription.value = '';
  transcriptionError.value = null;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    transcriptionError.value =
      error instanceof Error ? error.message : 'Microphone permission was denied.';
    stopMediaStream();
    return;
  }

  audioChunks = [];
  playbackProgress.value = 0;
  audioBlob.value = null;
  revokeObjectUrl();
  audioUrl.value = null;

  try {
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
  } catch (error) {
    transcriptionError.value =
      error instanceof Error ? error.message : 'Recording is not supported in this browser.';
    stopMediaStream();
    return;
  }

  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  });
  mediaRecorder.addEventListener('stop', handleRecorderStop, { once: true });

  mediaRecorder.start();
  isRecording.value = true;
  elapsedMs.value = 0;
  startTeleprompterForRecording();
  timerHandle = window.setInterval(() => {
    elapsedMs.value += 100;
    if (teleprompterActive.value && teleprompterMode.value === 'recording') {
      const ratio =
        teleprompterDurationMs.value === 0
          ? 0
          : Math.min(1, elapsedMs.value / teleprompterDurationMs.value);
      teleprompterProgress.value = ratio;
      if (ratio >= 1) {
        teleprompterActive.value = false;
        teleprompterMode.value = 'idle';
      }
    }
    if (elapsedMs.value >= maxDurationMs) {
      stopRecording();
    }
  }, 100);
};

const stopRecording = () => {
  if (!isRecording.value || !mediaRecorder) return;
  clearTimer();
  mediaRecorder.stop();
  pauseTeleprompter();
};

const playAudio = async () => {
  if (!audioUrl.value || !audioRef.value) return;
  if (isPlaying.value) {
    audioRef.value.pause();
    return;
  }
  try {
    const result = audioRef.value.play();
    if (result instanceof Promise) {
      await result;
    }
    isPlaying.value = true;
    startTeleprompterForPlayback();
  } catch (error) {
    transcriptionError.value =
      error instanceof Error ? error.message : 'Unable to play the audio sample.';
  }
};

const resetDemo = () => {
  if (isRecording.value) {
    stopRecording();
  }
  audioBlob.value = null;
  transcription.value = '';
  transcriptionError.value = null;
  playbackProgress.value = 0;
  isPlaying.value = false;
  revokeObjectUrl();
  audioUrl.value = null;
  elapsedMs.value = 0;
  resetTeleprompterState();
  nextTick(measureTeleprompter);
};

const transcribeLatest = async () => {
  if (!audioBlob.value) return;
  if (!openaiApiKey) {
    transcriptionError.value =
      'Missing OpenAI API key. Set VITE_OPENAI_API_KEY to enable transcription.';
    return;
  }

  transcribing.value = true;
  transcription.value = '';
  transcriptionError.value = null;

  const formData = new FormData();
  formData.append('file', audioBlob.value, 'narration-demo.webm');
  formData.append('model', 'gpt-4o-mini-transcribe');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const message =
        errorPayload?.error?.message ??
        `Transcription failed with status ${response.status}.`;
      throw new Error(message);
    }

    const result = (await response.json()) as { text?: string };
    transcription.value = result.text ?? '';
  } catch (error) {
    transcriptionError.value =
      error instanceof Error ? error.message : 'Transcription failed. Please try again.';
  } finally {
    transcribing.value = false;
  }
};

const handleAudioPlay = () => {
  isPlaying.value = true;
  startTeleprompterForPlayback();
};

const handleAudioPause = () => {
  isPlaying.value = false;
  pauseTeleprompter();
};

const handleAudioEnded = () => {
  isPlaying.value = false;
  teleprompterProgress.value = 1;
  pauseTeleprompter();
  teleprompterMode.value = 'idle';
  if (audioRef.value) {
    audioRef.value.currentTime = 0;
  }
};

const handleTimeUpdate = () => {
  if (!audioRef.value || !audioRef.value.duration) {
    playbackProgress.value = 0;
    return;
  }
  const progress = (audioRef.value.currentTime / audioRef.value.duration) * 100;
  playbackProgress.value = Math.min(100, Math.max(0, progress));
  if (teleprompterActive.value && teleprompterMode.value === 'playback') {
    const ratio = Math.min(1, audioRef.value.currentTime / audioRef.value.duration);
    teleprompterProgress.value = ratio;
    if (ratio >= 1) {
      teleprompterActive.value = false;
      teleprompterMode.value = 'idle';
    }
  }
};

const handleSampleChange = () => {
  if (isRecording.value) {
    stopRecording();
  }
  if (isPlaying.value && audioRef.value) {
    audioRef.value.pause();
  }
  resetTeleprompter();
};

watch(
  () => activeSample.value,
  () => {
    handleSampleChange();
  }
);

watch(teleprompterWords, () => {
  nextTick(measureTeleprompter);
});

onMounted(() => {
  window.addEventListener('resize', measureTeleprompter);
  nextTick(measureTeleprompter);
});

onBeforeUnmount(() => {
  resetDemo();
  clearTimer();
  stopMediaStream();
  revokeObjectUrl();
  window.removeEventListener('resize', measureTeleprompter);
});
</script>

<template>
  <section
    class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]"
  >
    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Narration Demo
        </p>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Record a 30-second sample and view the transcription.
        </h2>
      </div>
      <p
        class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500"
      >
        Limit {{ maxDurationSeconds }}s
      </p>
    </header>

    <div class="mt-6 flex flex-col gap-6">
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          :disabled="!recordingSupported || transcribing"
          @click="isRecording ? stopRecording() : startRecording()"
        >
          <span v-if="isRecording" class="inline-flex h-2.5 w-2.5 items-center justify-center">
            <span class="block h-2.5 w-2.5 rounded-sm bg-rose-400"></span>
          </span>
          <span v-else class="inline-flex h-2.5 w-2.5 items-center justify-center">
            <span class="block h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
          </span>
          <span>{{ isRecording ? 'Stop Recording' : 'Record Sample' }}</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-neutral-300/80 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
          :disabled="!audioUrl"
          @click="playAudio"
        >
          <span class="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-current">
            <span v-if="isPlaying" class="block h-1.5 w-1.5 bg-current"></span>
            <span
              v-else
              class="ml-0.5 inline-block h-0 w-0 border-y-4 border-l-[6px] border-y-transparent border-l-current"
            ></span>
          </span>
          <span>{{ isPlaying ? 'Pause' : 'Play Back' }}</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-transparent px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 transition hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-400 dark:hover:text-neutral-100"
          :disabled="!audioUrl && !isRecording"
          @click="resetDemo"
        >
          Reset
        </button>

        <span
          v-if="isRecording"
          class="inline-flex items-center rounded-full bg-rose-100/70 px-3 py-1 text-xs font-medium text-rose-600 dark:bg-rose-500/20 dark:text-rose-200"
        >
          Recording {{ elapsedLabel }}
        </span>
      </div>

      <div v-if="!recordingSupported" class="rounded-2xl bg-rose-100/70 p-4 text-sm text-rose-700">
        Your browser does not support audio recording. Try updating your browser or using a desktop
        device.
      </div>

      <div v-else class="space-y-4">
        <div
          class="flex h-16 items-center gap-4 rounded-2xl border border-dashed border-neutral-300/70 px-4 dark:border-neutral-800/70"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-neutral-100 dark:bg-neutral-50 dark:text-neutral-900"
          >
            <span
              v-if="isPlaying"
              class="block h-3 w-3 rounded-sm bg-current transition-transform duration-150"
            ></span>
            <span
              v-else
              class="ml-0.5 inline-block h-0 w-0 border-y-4 border-l-[6px] border-y-transparent border-l-current transition-transform duration-150"
            ></span>
          </div>
          <div class="flex-1">
            <div class="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                class="h-full rounded-full bg-neutral-900 transition-[width] duration-150 dark:bg-neutral-100"
                :style="{ width: `${playbackProgress}%` }"
              ></div>
            </div>
            <p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {{ audioUrl ? 'Playback ready' : 'Tap record to capture a quick narration sample.' }}
            </p>
          </div>
        </div>

        <audio
          ref="audioRef"
          v-if="audioUrl"
          :src="audioUrl"
          @ended="handleAudioEnded"
          @pause="handleAudioPause"
          @play="handleAudioPlay"
          @timeupdate="handleTimeUpdate"
          class="hidden"
        ></audio>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          Transcription
        </p>
        <div
          class="min-h-[88px] rounded-2xl border border-neutral-200/60 bg-neutral-50/80 p-4 text-sm text-neutral-700 dark:border-neutral-800/70 dark:bg-neutral-900/60 dark:text-neutral-200"
        >
          <template v-if="transcribing">
            <span class="font-medium text-neutral-500 dark:text-neutral-400">
              Transcribing your narration…
            </span>
          </template>
          <template v-else-if="transcription">
            <p>{{ transcription }}</p>
          </template>
          <template v-else-if="transcriptionError">
            <p class="text-rose-500 dark:text-rose-400">{{ transcriptionError }}</p>
          </template>
          <template v-else>
            <p class="text-neutral-400 dark:text-neutral-500">
              Your transcription will appear here once the recording finishes processing.
            </p>
          </template>
        </div>
      </div>

      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        We send the audio clip to OpenAI's transcription API. Set `VITE_OPENAI_API_KEY` in your
        environment to enable this demo.
      </p>

      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300/80 text-sm font-semibold text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
              @click="cycleSample(-1)"
              :disabled="narrationSamples.length <= 1 || isRecording || isPlaying"
              aria-label="Previous narration sample"
            >
              <
            </button>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                {{ activeSample?.subtitle }}
              </p>
              <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {{ activeSample?.title }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300/80 text-sm font-semibold text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
            @click="cycleSample(1)"
            :disabled="narrationSamples.length <= 1 || isRecording || isPlaying"
            aria-label="Next narration sample"
          >
            >
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="(sample, index) in narrationSamples"
            :key="sample.title"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-neutral-100"
            :class="
              index === activeSampleIndex
                ? 'border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900'
                : 'border-transparent bg-neutral-200/70 text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400'
            "
            @click="selectSample(index)"
            :disabled="isRecording || isPlaying"
          >
            {{ sample.title }}
          </button>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-neutral-900/90 px-5 py-5 text-base text-neutral-400 shadow-inner transition dark:border-neutral-800/70 dark:bg-neutral-900/90 md:text-lg"
        >
          <div ref="teleprompterViewportRef" class="overflow-hidden">
            <div
              ref="teleprompterTrackRef"
              class="flex items-center whitespace-nowrap transition-transform duration-150 ease-linear will-change-transform"
              :style="{ transform: teleprompterTransform }"
            >
              <span
                v-for="(word, index) in teleprompterWords"
                :key="`${word}-${index}`"
                class="mr-4 transition-colors duration-150 last:mr-0"
                :class="index < highlightedWordCount ? 'text-neutral-50' : 'text-neutral-500/70'"
              >
                {{ word }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
