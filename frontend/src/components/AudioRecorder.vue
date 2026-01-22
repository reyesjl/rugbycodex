<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAudioRecording } from '@/composables/useAudioRecording';
import { useTypewriter } from '@/composables/useTypewriter';
import { transcriptionService } from '@/modules/narrations/services/transcriptionService';

interface Props {
  modelValue: string;
  orgId?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'recording-started'): void;
  (e: 'recording-stopped'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const {
  isRecording,
  isPaused,
  duration,
  hasRecording,
  audioUrl,
  audioLevel,
  error: recordingError,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  resetRecording,
  getAudioBlob,
} = useAudioRecording();

const audioPlayer = ref<HTMLAudioElement | null>(null);
const isPlayingAudio = ref(false);
const transcribing = ref(false);
const transcriptionError = ref<string | null>(null);
const hasTranscribed = ref(false);

const { value: typewriterText, typeText } = useTypewriter();

// Sync typewriter text to modelValue as it types
watch(typewriterText, (newText) => {
  emit('update:modelValue', newText);
});

const formattedDuration = computed(() => {
  const seconds = Math.floor(duration.value / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

async function handleStartRecording() {
  await startRecording();
  emit('recording-started');
}

function handleStopRecording() {
  stopRecording();
  emit('recording-stopped');
}

function handleResetRecording() {
  resetRecording();
  transcriptionError.value = null;
  hasTranscribed.value = false;
}

function toggleRecordingPause() {
  if (isPaused.value) {
    resumeRecording();
  } else {
    pauseRecording();
  }
}

function toggleAudioPlayback() {
  if (!audioPlayer.value || !audioUrl.value) return;

  if (audioPlayer.value.paused) {
    audioPlayer.value.play();
    isPlayingAudio.value = true;
  } else {
    audioPlayer.value.pause();
    isPlayingAudio.value = false;
  }
}

function handleAudioEnded() {
  isPlayingAudio.value = false;
}

async function handleTranscribe() {
  const audioBlob = getAudioBlob();
  if (!audioBlob) return;

  transcribing.value = true;
  transcriptionError.value = null;

  try {
    const result = await transcriptionService.transcribeAudio(audioBlob, props.orgId);
    hasTranscribed.value = true;

    // Use typewriter effect to display transcription
    await typeText(result.text, 20);
  } catch (err) {
    transcriptionError.value = err instanceof Error ? err.message : 'Transcription failed';
    console.error('Transcription error:', err);
  } finally {
    transcribing.value = false;
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Recording Controls -->
    <div v-if="isRecording || hasRecording" class="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">

      <!-- Recording Status & Duration -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div v-if="isRecording" class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <div v-if="!isPaused" class="flex items-center gap-0.5 h-4">
              <div v-for="i in 5" :key="i" class="w-0.5 rounded-full bg-red-500 transition-all duration-100" :style="{
                height: `${2 + (audioLevel * Math.random() * 0.3 + audioLevel * 0.7) * 14}px`,
                opacity: 0.5 + audioLevel * 0.5
              }"></div>
            </div>
            <span class="text-white text-sm font-medium">
              {{ isPaused ? 'Paused' : 'Recording' }}
            </span>
          </div>
          <div v-else class="flex items-center gap-2">
            <Icon icon="carbon:checkmark" class="text-green-500" width="16" height="16" />
            <span class="text-white text-sm font-medium">Recording Complete</span>
          </div>
          <span class="text-white/70 text-sm">{{ formattedDuration }}</span>
        </div>

        <!-- Record Controls -->
        <div v-if="isRecording" class="flex items-center gap-2">
          <button @click="toggleRecordingPause"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-white border border-amber-500 bg-amber-500/70 hover:bg-amber-700/70 hover:cursor-pointer text-xs transition"
            :title="isPaused ? 'Resume' : 'Pause'">
            <Icon :icon="isPaused ? 'carbon:play' : 'carbon:pause'" width="14" height="14" />
          </button>
          <button @click="handleStopRecording"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-white border border-red-500 bg-red-500/70 hover:bg-red-700/70 hover:cursor-pointer text-xs transition"
            title="Stop recording">
            <Icon icon="carbon:stop" width="14" height="14" />
            <span>Stop</span>
          </button>
        </div>
      </div>

      <!-- Audio Playback & Actions -->
      <div v-if="hasRecording && !isRecording" class="space-y-2">
        <!-- Audio Player (hidden) -->
        <audio ref="audioPlayer" :src="audioUrl ?? undefined" @ended="handleAudioEnded" class="hidden"></audio>

        <!-- Playback Controls -->
        <div class="flex items-center gap-2">
          <button @click="toggleAudioPlayback"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 hover:cursor-pointer text-xs transition"
            :title="isPlayingAudio ? 'Pause' : 'Play recording'">
            <Icon :icon="isPlayingAudio ? 'carbon:pause' : 'carbon:play'" width="14" height="14" />
            <span>{{ isPlayingAudio ? 'Pause' : 'Play' }}</span>
          </button>

          <button @click="handleTranscribe" :disabled="transcribing || hasTranscribed"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-white border border-violet-500 bg-violet-500/70 hover:bg-violet-700/70 hover:cursor-pointer text-xs transition disabled:bg-violet-500/20 disabled:border-violet-500/30 disabled:text-white/50 disabled:cursor-not-allowed">
            <Icon icon="carbon:text-creation" width="14" height="14" />
            <span>{{ transcribing ? 'Transcribing…' : hasTranscribed ? 'Transcribed' : 'Transcribe' }}</span>
          </button>

          <button @click="handleResetRecording"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-white border border-white/20 bg-white/10 hover:bg-white/20 hover:cursor-pointer text-xs transition"
            title="Delete and re-record">
            <Icon icon="carbon:restart" width="14" height="14" />
            <span>Re-record</span>
          </button>
        </div>

        <!-- Transcription Error -->
        <div v-if="transcriptionError" class="text-red-400 text-xs">
          {{ transcriptionError }}
        </div>
      </div>

      <!-- Recording Error -->
      <div v-if="recordingError" class="text-red-400 text-xs">
        {{ recordingError }}
      </div>
    </div>

    <!-- Start Recording Button -->
    <div v-else class="space-y-2 flex justify-end">
      <button @click="handleStartRecording"
        class="flex items-center gap-2 rounded-lg px-2 py-1 text-white border border-red-500 bg-red-500/70 hover:bg-red-700/70 hover:cursor-pointer text-xs transition">
        <Icon icon="carbon:microphone" width="16" height="16" />
        <span>Record</span>
      </button>

      <!-- Microphone Error -->
      <div v-if="recordingError" class="flex items-center gap-2 text-red-400 text-xs">
        <Icon icon="carbon:warning" width="14" height="14" />
        <span>{{ recordingError }}</span>
      </div>
    </div>
  </div>
</template>
