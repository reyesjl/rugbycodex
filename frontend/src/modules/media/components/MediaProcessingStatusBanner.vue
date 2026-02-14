<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import type { ProcessingStatus } from '@/modules/media/composables/useMediaProcessingStatus';

interface Props {
  status: ProcessingStatus;
  showWatchMessage?: boolean;
  mode?: 'overlay' | 'banner';
  uploadProgress?: number | null;
  uploadSpeedLabel?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  showWatchMessage: false,
  mode: 'overlay',
  uploadProgress: null,
  uploadSpeedLabel: null,
});

// Color mapping for each stage
const stageColors: Record<string, string> = {
  uploaded: '#3B82F6',      // blue-500
  transcoding: '#F59E0B',   // amber-500 (blocking)
  transcoded: '#8B5CF6',    // purple-500
  complete: '#10B981',      // green-500
  failed: '#EF4444',        // red-500
};

// Label mapping for each stage
const stageLabels: Record<string, string> = {
  uploaded: 'Preparing',
  transcoding: 'Transcoding',
  transcoded: 'Ready',
  complete: 'Complete',
  failed: 'Failed',
};

// Add uploading state
const isUploading = computed(() => props.uploadProgress !== null && props.uploadProgress < 100);

const currentColor = computed(() => {
  if (isUploading.value) return '#3B82F6'; // blue for uploading
  return stageColors[props.status.stage] || '#3B82F6';
});

const currentLabel = computed(() => {
  if (isUploading.value) return 'Uploading';
  return stageLabels[props.status.stage] || 'Processing';
});

const progressMessage = computed(() => {
  if (isUploading.value && props.uploadProgress !== null) {
    const speedPart = props.uploadSpeedLabel ? ` • ${props.uploadSpeedLabel}` : '';
    return `${props.uploadProgress}%${speedPart}`;
  }
  return null;
});

const bannerMessage = computed(() => {
  const stage = props.status.stage;
  
  // Blocking processing (transcoding)
  if (stage === 'uploaded' || stage === 'transcoding') {
    return 'Video is being transcoded for streaming. Please wait...';
  }
  
  return props.status.statusMessage;
});

</script>

<template>
  <!-- Overlay mode (for video thumbnails/cards) -->
  <div 
    v-if="mode === 'overlay' && (isUploading || status.isBlockingProcessing)" 
    class="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none"
  >
    <div class="flex flex-col items-center gap-3">
      <ShimmerText 
        :text="currentLabel" 
        class="text-lg font-bold"
        :color="currentColor"
      />
      <span v-if="progressMessage" class="text-sm font-medium text-white/80">
        {{ progressMessage }}
      </span>
      <LoadingDot :color="currentColor" />
    </div>
  </div>

  <!-- Banner mode (for detail view) -->
  <div
    v-else-if="mode === 'banner' && status.isBlockingProcessing"
    class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
    :class="{
      'border-amber-500/30 bg-amber-500/10': status.isBlockingProcessing,
      'border-red-500/30 bg-red-500/10': status.stage === 'failed'
    }"
  >
    <!-- Icon/Loading indicator -->
    <LoadingDot 
      v-if="status.stage !== 'failed'" 
      size="md" 
      :color="currentColor" 
    />
    <Icon
      v-else
      icon="carbon:warning-alt"
      class="h-4 w-4 text-red-400"
    />
    
    <!-- Message -->
    <div class="flex-1">
      <p class="text-sm text-white/90">
        <!-- <span class="font-medium">{{ currentLabel }}</span> -->
        <span v-if="bannerMessage" class="text-white/70">{{ bannerMessage }}</span>
      </p>
    </div>
    
  </div>
</template>

<style scoped>
/* No additional styles needed - all handled with Tailwind */
</style>
