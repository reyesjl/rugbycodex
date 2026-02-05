import { computed, ref } from 'vue';
import { useAudioRecording } from '@/composables/useAudioRecording';
import { transcriptionService } from '@/modules/narrations/services/transcriptionService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { Narration, NarrationSourceType } from '@/modules/narrations/types/Narration';

export type OptimisticNarration = {
  id: string;
  org_id: string;
  media_asset_id: string;
  media_asset_segment_id: string;
  author_id: string | null;
  source_type?: NarrationSourceType | null;
  audio_storage_path: string | null;
  created_at: Date;
  transcript_raw: string;
  status: 'uploading' | 'error';
  errorMessage?: string;
};

export type NarrationListItem = Narration | OptimisticNarration;

type StartContext = {
  orgId: string;
  mediaAssetId: string;
  mediaAssetSegmentId: string;
  timeSeconds: number;
};

/**
 * Wraps existing recording + transcription + narrationService APIs.
 *
 * Non-blocking design:
 * - stopRecording returns immediately with an optimistic item + a promise that resolves later.
 */
export function useNarrationRecorder() {
  const context = ref<StartContext | null>(null);
  const isUploading = ref(false);
  const lastError = ref<string | null>(null);

  const audio = useAudioRecording();

  const isRecording = computed(() => audio.isRecording.value);
  const audioLevel = computed(() => audio.audioLevel.value);
  const duration = computed(() => audio.duration.value);
  const liveTranscript = computed(() => audio.liveTranscript.value);

  async function startRecording(ctx: StartContext): Promise<void> {
    lastError.value = null;

    // Clear previous captured audio before a new recording starts.
    // IMPORTANT: do this synchronously here (user intent), not later in the upload
    // promise (which could clobber a newer recording).
    if (!audio.isRecording.value && audio.hasRecording.value) {
      audio.resetRecording();
    }

    context.value = ctx;
    await audio.startRecording();

    // If the underlying recorder failed to start, don't keep stale context.
    if (!audio.isRecording.value) {
      context.value = null;
      throw new Error(audio.error.value ?? 'Failed to start recording.');
    }
  }

  function stopRecording():
    | {
        optimistic: OptimisticNarration;
        promise: Promise<Narration>;
      }
    | null {
    if (!context.value) return null;

    const blobPromise = audio.stopRecordingAndGetBlob();

    const ctx = context.value;
    context.value = null;
    isUploading.value = true;

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: OptimisticNarration = {
      id: optimisticId,
      org_id: ctx.orgId,
      media_asset_id: ctx.mediaAssetId,
      media_asset_segment_id: ctx.mediaAssetSegmentId,
      author_id: null,
      audio_storage_path: null,
      created_at: new Date(),
      transcript_raw: 'Uploading…',
      status: 'uploading',
    };

    const promise = (async () => {
      try {
        const audioBlob = await blobPromise;

        // Existing pipeline: Edge transcription, then create narration row.
        const { text } = await transcriptionService.transcribeAudio(audioBlob);

        const narration = await narrationService.createNarration({
          orgId: ctx.orgId,
          mediaAssetId: ctx.mediaAssetId,
          mediaAssetSegmentId: ctx.mediaAssetSegmentId,
          transcriptRaw: text?.trim() ? text.trim() : '(No transcript)',
        });

        return narration;
      } finally {
        isUploading.value = false;
      }
    })().catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to process narration.';
      lastError.value = message;
      throw err;
    });

    return { optimistic, promise };
  }

  return {
    // state
    isRecording,
    audioLevel,
    duration,
    liveTranscript,
    isUploading,
    lastError,
    // actions
    startRecording,
    stopRecording,
  };
}
