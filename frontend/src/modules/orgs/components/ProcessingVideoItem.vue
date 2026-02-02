<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import { formatMediaAssetNameForDisplay } from '@/modules/media/utils/assetUtilities';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { UploadState } from '@/modules/media/types/UploadStatus';
import { formatDaysAgo } from '@/lib/date';

const props = defineProps<{
  asset: OrgMediaAsset;
  canManage?: boolean;
  uploadMetrics?: {
    state: UploadState;
    progress: number;
    uploadSpeedBps?: number;
  };
}>();

const emit = defineEmits(['delete']);

const isActivelyUploading = computed(() => props.uploadMetrics?.state === 'uploading');

// Reactive timestamp - updates every 30 seconds
const now = ref(new Date());
let timestampInterval: number | null = null;

onMounted(() => {
  // Update timestamp every 30 seconds for reactive "x minutes ago"
  timestampInterval = window.setInterval(() => {
    now.value = new Date();
  }, 30_000); // 30 seconds
});

onUnmounted(() => {
  if (timestampInterval !== null) {
    clearInterval(timestampInterval);
  }
});

const statusText = computed(() => {
  // Uploading to Wasabi
  if (isActivelyUploading.value && props.uploadMetrics) {
    // Handle both decimal (0-1) and percentage (0-100) formats
    const progress = Math.round(
      props.uploadMetrics.progress > 1 
        ? props.uploadMetrics.progress  // Already a percentage (0-100)
        : props.uploadMetrics.progress * 100  // Convert decimal (0-1) to percentage
    );
    const bps = props.uploadMetrics.uploadSpeedBps;
    if (bps && Number.isFinite(bps) && bps > 0) {
      const mbps = (bps * 8) / (1024 * 1024);
      return `Uploading ${progress}% at ${mbps.toFixed(1)} Mbps`;
    }
    return `Uploading ${progress}%`;
  }

  // Processing stages
  const stage = props.asset.processing_stage;
  const transcodeProgress = props.asset.transcode_progress || 0;
  
  switch (stage) {
    case 'uploaded':
      return 'Queued for processing';
    case 'transcoding':
      // Show real-time progress if available
      if (transcodeProgress > 0 && transcodeProgress < 100) {
        return `Transcoding ${transcodeProgress}%`;
      }
      return 'Transcoding';
    case 'transcoded':
      return 'Finalizing';
    case 'complete':
      if (!props.asset.streaming_ready) {
        return 'Preparing preview';
      }
      return 'Complete';
    case 'detecting_events':
      return 'Detecting events';
    case 'failed':
      return 'Processing failed';
    default:
      return 'Processing';
  }
});

const timeAgoText = computed(() => {
  if (!props.asset.created_at) return '';
  // Pass reactive 'now.value' so this recomputes every 30 seconds
  return formatDaysAgo(props.asset.created_at, now.value);
});

const videoTitle = computed(() => {
  return formatMediaAssetNameForDisplay(props.asset.file_name);
});

function handleDelete() {
  emit('delete');
}
</script>

<template>
  <div class="flex items-center gap-3 py-1 group">
    <!-- Loading Dot -->
    <LoadingDot class="flex-none" />

    <!-- Video Title (Shimmer) -->
    <ShimmerText class="text-sm font-medium text-white/90">
      {{ videoTitle }}
    </ShimmerText>

    <!-- Status -->
    <span class="text-xs text-white/50">
      {{ statusText }}
    </span>

    <!-- Time ago -->
    <span class="text-xs text-white/30">
      {{ timeAgoText }}
    </span>

    <!-- Delete/Cancel Button -->
    <button
      v-if="canManage"
      @click.stop="handleDelete"
      class="flex-none opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
      title="Cancel/Delete"
    >
      <Icon icon="carbon:close" class="w-4 h-4 text-white/50 hover:text-white/90" />
    </button>
  </div>
</template>
