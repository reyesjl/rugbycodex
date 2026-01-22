/**
 * Service for audio transcription
 */

import { invokeEdge } from '@/lib/api';
import { handleSupabaseEdgeError } from '@/lib/handleSupabaseEdgeError';
import type { TranscriptionResponse } from '@/modules/narrations/types/TranscriptionResponse';

/**
 * Transcribe audio blob to text
 * @param audioBlob - The audio data to transcribe
 * @returns The transcribed text
 */
export async function transcribeAudio(
  audioBlob: Blob
): Promise<TranscriptionResponse> {
  const formData = new FormData();

  const mime = (audioBlob.type || '').toLowerCase();
  const fileName = mime.includes('mp4') ? 'audio.m4a' : mime.includes('wav') ? 'audio.wav' : 'audio.webm';
  formData.append('file', audioBlob, fileName);

  const { data, error } = await invokeEdge('transcribe-webm-file', {
    body: formData,
  });

  if (error) {
    throw await handleSupabaseEdgeError(
      error,
      'Unable to transcribe audio. Please try again.'
    );
  }

  if (!data || typeof data.text !== 'string') {
    throw new Error('Invalid transcription response');
  }

  return {
    text: data.text,
  };
}

export const transcriptionService = {
  transcribeAudio,
};
