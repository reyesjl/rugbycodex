import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';
import { eventDetectionService } from '@/modules/events/services/eventDetectionService';

export interface MediaAsset {
  id: string;
  streaming_ready: boolean;
  processing_stage?: string | null;
  duration_seconds?: number;
}

export interface ProcessingStatus {
  stage: 'uploaded' | 'transcoding' | 'transcoded' | 'detecting_events' | 'complete' | 'failed';
  isProcessing: boolean;
  isWatchable: boolean;
  isBlockingProcessing: boolean;
  isBackgroundProcessing: boolean;
  statusMessage: string;
  statusIcon: string;
  detectionCount: number | null;
}

export function useMediaProcessingStatus(mediaAsset: Ref<MediaAsset | null>) {
  const detectionCount = ref<number | null>(null);
  const isLoadingDetections = ref(false);

  const processingStatus = computed<ProcessingStatus>(() => {
    if (!mediaAsset.value) {
      return {
        stage: 'uploaded',
        isProcessing: false,
        isWatchable: false,
        isBlockingProcessing: false,
        isBackgroundProcessing: false,
        statusMessage: 'Unknown',
        statusIcon: 'mdi:help-circle',
        detectionCount: null,
      };
    }

    const stage = (mediaAsset.value.processing_stage || 'uploaded') as ProcessingStatus['stage'];
    const streamingReady = mediaAsset.value.streaming_ready;
    
    // Determine if video is watchable (transcoding complete)
    const isWatchable = streamingReady === true;
    
    // Determine processing type
    const isBlockingProcessing = stage === 'uploaded' || stage === 'transcoding';
    const isBackgroundProcessing = stage === 'detecting_events'; // Only active detection, not 'transcoded'

    switch (stage) {
      case 'uploaded':
        return {
          stage,
          isProcessing: true,
          isWatchable: false,
          isBlockingProcessing: true,
          isBackgroundProcessing: false,
          statusMessage: 'Preparing video...',
          statusIcon: 'mdi:clock-outline',
          detectionCount: null,
        };

      case 'transcoding':
        return {
          stage,
          isProcessing: true,
          isWatchable: false,
          isBlockingProcessing: true,
          isBackgroundProcessing: false,
          statusMessage: 'Transcoding video for streaming...',
          statusIcon: 'mdi:cog-sync',
          detectionCount: null,
        };

      case 'transcoded':
        return {
          stage,
          isProcessing: false,
          isWatchable,
          isBlockingProcessing: false,
          isBackgroundProcessing: false,
          statusMessage: 'Video ready for viewing',
          statusIcon: 'mdi:check-circle',
          detectionCount: null,
        };

      case 'detecting_events':
        const duration = mediaAsset.value.duration_seconds || 0;
        const estimatedMinutes = Math.ceil((duration / 60) * 0.25); // ~25% of video duration
        return {
          stage,
          isProcessing: true,
          isWatchable,
          isBlockingProcessing: false,
          isBackgroundProcessing: true,
          statusMessage: `Analyzing rugby events (~${estimatedMinutes} min)`,
          statusIcon: 'mdi:radar',
          detectionCount: null,
        };

      case 'complete':
        const count = detectionCount.value;
        return {
          stage,
          isProcessing: false,
          isWatchable: true,
          isBlockingProcessing: false,
          isBackgroundProcessing: false,
          statusMessage: count !== null && count > 0 
            ? `Ready - ${count} events detected`
            : 'Ready',
          statusIcon: 'mdi:check-circle',
          detectionCount: count,
        };

      case 'failed':
        return {
          stage,
          isProcessing: false,
          isWatchable,
          isBlockingProcessing: false,
          isBackgroundProcessing: false,
          statusMessage: 'Processing failed',
          statusIcon: 'mdi:alert-circle',
          detectionCount: null,
        };

      default:
        // Fallback for old videos without processing_stage
        if (streamingReady) {
          return {
            stage: 'complete',
            isProcessing: false,
            isWatchable: true,
            isBlockingProcessing: false,
            isBackgroundProcessing: false,
            statusMessage: 'Ready',
            statusIcon: 'mdi:check-circle',
            detectionCount: null,
          };
        }
        return {
          stage: 'uploaded',
          isProcessing: true,
          isWatchable: false,
          isBlockingProcessing: true,
          isBackgroundProcessing: false,
          statusMessage: 'Processing...',
          statusIcon: 'mdi:clock-outline',
          detectionCount: null,
        };
    }
  });

  // Fetch detection count when stage is complete
  watch(
    () => mediaAsset.value?.processing_stage,
    async (newStage) => {
      if (newStage === 'complete' && mediaAsset.value && !isLoadingDetections.value) {
        isLoadingDetections.value = true;
        try {
          const result = await eventDetectionService.getEventDetections(mediaAsset.value.id);
          detectionCount.value = result.stats?.total_count || 0;
        } catch (error) {
          console.error('Failed to fetch detection count:', error);
          detectionCount.value = null;
        } finally {
          isLoadingDetections.value = false;
        }
      }
    },
    { immediate: true }
  );

  return {
    processingStatus,
    detectionCount,
    isLoadingDetections,
  };
}
