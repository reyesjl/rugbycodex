import { computed } from 'vue';
import type { Ref } from 'vue';

export interface MediaAsset {
  id: string;
  streaming_ready: boolean;
  processing_stage?: string | null;
  duration_seconds?: number;
}

export interface ProcessingStatus {
  stage: 'uploaded' | 'transcoding' | 'transcoded' | 'complete' | 'failed';
  isProcessing: boolean;
  isWatchable: boolean;
  isBlockingProcessing: boolean;
  statusMessage: string;
  statusIcon: string;
}

export function useMediaProcessingStatus(mediaAsset: Ref<MediaAsset | null>) {
  const processingStatus = computed<ProcessingStatus>(() => {
    if (!mediaAsset.value) {
      return {
        stage: 'uploaded',
        isProcessing: false,
        isWatchable: false,
        isBlockingProcessing: false,
        statusMessage: 'Unknown',
        statusIcon: 'mdi:help-circle',
      };
    }

    const stage = (mediaAsset.value.processing_stage || 'uploaded') as ProcessingStatus['stage'];
    const streamingReady = mediaAsset.value.streaming_ready;
    
    // Determine if video is watchable (transcoding complete)
    const isWatchable = streamingReady === true;
    
    switch (stage) {
      case 'uploaded':
        return {
          stage,
          isProcessing: true,
          isWatchable: false,
          isBlockingProcessing: true,
          statusMessage: 'Preparing video...',
          statusIcon: 'mdi:clock-outline',
        };

      case 'transcoding':
        return {
          stage,
          isProcessing: true,
          isWatchable: false,
          isBlockingProcessing: true,
          statusMessage: 'Transcoding video for streaming...',
          statusIcon: 'mdi:cog-sync',
        };

      case 'transcoded':
        return {
          stage,
          isProcessing: false,
          isWatchable,
          isBlockingProcessing: false,
          statusMessage: 'Video ready for viewing',
          statusIcon: 'mdi:check-circle',
        };

      case 'complete':
        return {
          stage,
          isProcessing: false,
          isWatchable: true,
          isBlockingProcessing: false,
          statusMessage: 'Ready',
          statusIcon: 'mdi:check-circle',
        };

      case 'failed':
        return {
          stage,
          isProcessing: false,
          isWatchable,
          isBlockingProcessing: false,
          statusMessage: 'Processing failed',
          statusIcon: 'mdi:alert-circle',
        };

      default:
        // Fallback for old videos without processing_stage
        if (streamingReady) {
          return {
            stage: 'complete',
            isProcessing: false,
            isWatchable: true,
            isBlockingProcessing: false,
            statusMessage: 'Ready',
            statusIcon: 'mdi:check-circle',
          };
        }
        return {
          stage: 'uploaded',
          isProcessing: true,
          isWatchable: false,
          isBlockingProcessing: true,
          statusMessage: 'Processing...',
          statusIcon: 'mdi:clock-outline',
        };
    }
  });

  return {
    processingStatus,
  };
}
