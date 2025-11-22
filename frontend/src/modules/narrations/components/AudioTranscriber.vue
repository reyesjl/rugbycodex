<script setup lang="ts">
import { useAudioRecorder } from "@/modules/narrations/composables/useAudioRecorder";
import FakeWaveform from "./FakeWaveform.vue";
import { Icon } from "@iconify/vue";
import { ref } from "vue";
import LoadingIcon from "@/components/LoadingIcon.vue";
import { supabase } from "@/lib/supabaseClient";
import type { TranscriptionResponse } from "@/modules/narrations/types";

const {
  recording,
  audioBlob,
  audioUrl,
  error,
  duration,
  startRecording,
  stopRecording,
  reset
} = useAudioRecorder();

const loadingTranscription = ref(false);
const transcription = ref<string | null>(null);
const transcriptionError = ref<string | null>(null);


const handleTranscribe = async () => {
  if (!audioBlob.value) return;
  try {
    loadingTranscription.value = true;
    transcriptionError.value = null;

    const formData = new FormData();
    formData.append("file", audioBlob.value, "audio.wav");

    const { data, error: fnError } = await supabase.functions.invoke<TranscriptionResponse>(
      "transcribe-wav-file",
      {
        body: formData,
      }
    );

    if (fnError) throw fnError;
    if (!data) throw new Error("No transcription returned");

    transcription.value = data.transcription;
  } catch (err) {
    transcriptionError.value = (err as Error).message;
  } finally {
    loadingTranscription.value = false;
  }
};
</script>

<template>
  <div class="max-w-2xl mx-auto p-6">
    <!-- Recording Controls Card -->
    <div
      class="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Audio Recorder
        </h2>
        <div v-if="duration > 0" class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <Icon icon="mdi:clock-outline" class="w-4 h-4" />
          <span class="font-mono">{{ Math.floor(duration / 60) }}:{{ String(duration % 60).padStart(2, '0') }}</span>
        </div>
      </div>

      <!-- Recording Control Area -->
      <div class="flex items-center gap-4 mb-6">
        <button :class="[
          'flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-all duration-200 shadow-md hover:shadow-lg',
          recording
            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
        ]" @click="recording ? stopRecording() : startRecording()">
          <Icon :icon="recording ? 'mdi:stop-circle' : 'mdi:microphone'" class="w-5 h-5" />
          {{ recording ? "Stop Recording" : "Start Recording" }}
        </button>

        <FakeWaveform :is-recording="recording" />

        <button v-if="audioUrl && !recording" @click="reset"
          class="flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200">
          <Icon icon="mdi:refresh" class="w-5 h-5" />
          Reset
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="error"
        class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
        </div>
      </div>

      <!-- Playback Section -->
      <div v-if="audioUrl && !recording" class="space-y-4">
        <div class="border-t border-neutral-200 dark:border-neutral-800 pt-6">
          <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Playback</h3>
          <audio :src="audioUrl" controls class="w-full rounded-lg bg-neutral-50 dark:bg-neutral-800" />
        </div>

        <!-- Transcription Section -->
        <div v-if="audioBlob" class="flex flex-col items-center gap-4 w-full">
          <button @click="handleTranscribe"
            class="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200">
            <Icon icon="mdi:text-to-speech" class="w-5 h-5" />
            Transcribe Audio
          </button>
          <LoadingIcon v-if="loadingTranscription" />
          <span v-else-if="transcriptionError" class="text-red-500">{{ transcriptionError }} </span>
          <textarea v-else-if="transcription"
            v-model="transcription"
            :placeholder="'Transcription ...'"
            class="border overflow-auto min-h-[200px] rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <!-- Recording State Indicator -->
      <div v-if="recording" class="mt-6 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
        Recording in progress...
      </div>
    </div>
  </div>
</template>
