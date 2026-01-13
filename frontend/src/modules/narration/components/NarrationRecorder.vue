<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  isRecording: boolean;
  audioLevel01: number; // 0..1
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();

function barHeight(i: number, level: number): string {
  // subtle, deterministic-ish waveform
  const base = 4;
  const variance = (i % 2 === 0 ? 10 : 7) * level;
  return `${base + variance}px`;
}
</script>

<template>
  <div class="absolute right-3 top-1/2 -translate-y-1/2">
    <div class="relative">
      <!-- Always-visible floating record button -->
      <button
        type="button"
        class="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/15 backdrop-blur hover:bg-black/50 cursor-pointer"
        @click.stop="emit('toggle')"
        :title="isRecording ? 'Stop narration' : 'Record narration'"
      >
        <span
          class="inline-flex h-9 w-9 items-center justify-center rounded-full ring-2"
          :class="isRecording ? 'bg-red-500/80 ring-red-300/80' : 'bg-white/5 ring-white/30'"
        >
          <Icon :icon="isRecording ? 'carbon:stop' : 'carbon:microphone'" width="18" height="18" class="text-white" />
        </span>
      </button>

      <!-- Recording indicator (only while recording) -->
      <div
        v-if="isRecording"
        class="absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-2 ring-1 ring-white/10"
      >
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <div class="flex items-end gap-0.5">
            <div
              v-for="i in 5"
              :key="i"
              class="w-0.5 rounded-full bg-red-400/90"
              :style="{ height: barHeight(i, audioLevel01) }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
