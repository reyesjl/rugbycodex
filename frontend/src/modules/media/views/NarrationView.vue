<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { Narration } from '@/modules/narrations/types/Narration';
import AudioRecorder from '@/components/AudioRecorder.vue';

const DEBUG = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  console.debug('[NarrationEntry]', ...args);
}

interface Props {
  segmentId: string;
  mediaAssetId: string;
  orgId: string;
}

interface Emits {
  (e: 'recording-started'): void;
  (e: 'recording-stopped'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const narrations = ref<Narration[]>([]);
const narrationText = ref('');
const submitting = ref(false);
const submitError = ref<string | null>(null);
const loading = ref(false);

async function loadNarrations() {
  if (!props.segmentId) return;

  loading.value = true;
  try {
    narrations.value = await narrationService.listNarrationsForSegment(props.segmentId);
  } catch (err) {
    debugLog('loadNarrations(): error', err);
  } finally {
    loading.value = false;
  }
}

async function submitNarration() {
  if (!narrationText.value.trim()) return;
  if (!props.segmentId || !props.mediaAssetId || !props.orgId) return;

  submitting.value = true;
  submitError.value = null;

  try {
    const narration = await narrationService.createNarration({
      orgId: props.orgId,
      mediaAssetId: props.mediaAssetId,
      mediaAssetSegmentId: props.segmentId,
      transcriptRaw: narrationText.value.trim(),
    });

    narrations.value.push(narration);
    narrationText.value = '';
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Failed to save narration.';
    debugLog('submitNarration(): error', err);
  } finally {
    submitting.value = false;
  }
}

watch(() => props.segmentId, () => {
  if (props.segmentId) {
    void loadNarrations();
  }
}, { immediate: true });

onMounted(() => {
  void loadNarrations();
});

function handleRecordingStarted() {
  emit('recording-started');
}

function handleRecordingStopped() {
  emit('recording-stopped');
}
</script>

<template>
  <div class="space-y-4">
    <!-- Narration Input -->
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
      <h2 class="text-white text-sm font-semibold">Add Narration</h2>

      <!-- Audio Recorder -->
      <AudioRecorder v-model="narrationText" @recording-started="handleRecordingStarted"
        @recording-stopped="handleRecordingStopped" />

      <!-- Text Input -->
      <textarea v-model="narrationText"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
        rows="4" placeholder="Write your thoughts on this segment or use audio recording above..."
        :disabled="submitting"></textarea>

      <div class="flex items-center justify-between">
        <div v-if="submitError" class="text-red-400 text-sm">
          {{ submitError }}
        </div>
        <div v-else class="text-white/50 text-xs">
          {{ narrationText.length }} characters
        </div>
        <button @click="submitNarration" :disabled="!narrationText.trim() || submitting"
          class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 hover:cursor-pointer text-xs transition disabled:bg-white/10 disabled:border-white/20 disabled:cursor-not-allowed">
          {{ submitting ? 'Saving…' : 'Submit' }}
        </button>
      </div>
    </div>

    <!-- Existing Narrations -->
    <div v-if="loading" class="text-white/50 text-sm">
      Loading narrations…
    </div>
    <div v-else-if="narrations.length > 0" class="space-y-2">
      <h2 class="text-white text-sm font-semibold">Narrations ({{ narrations.length }})</h2>
      <div class="space-y-2">
        <div v-for="narration in narrations" :key="narration.id"
          class="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
          <div class="text-xs text-white/50">
            {{ new Date(narration.created_at).toLocaleString() }}
          </div>
          <div class="text-white text-sm whitespace-pre-wrap">
            {{ narration.transcript_raw }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
