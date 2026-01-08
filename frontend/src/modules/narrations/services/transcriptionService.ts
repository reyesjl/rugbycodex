/**
 * Service for audio transcription
 */

import { supabase } from '@/lib/supabaseClient';
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
  formData.append('file', audioBlob, 'audio.webm');

  const { data, error } = await supabase.functions.invoke('transcribe-webm-file', {
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
