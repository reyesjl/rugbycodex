import { ref } from "vue";

/**
 * Converts raw PCM audio data to WAV format
 * TODO: Does this work on all browsers?
 */
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] ?? 0;
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function useAudioRecorder() {
  const recording = ref(false);
  const audioBlob = ref<Blob | null>(null);
  const audioUrl = ref<string | null>(null);
  const error = ref<string | null>(null);

  const duration = ref(0);
  const durationTimer = ref<ReturnType<typeof setInterval> | null>(null);

  let mediaRecorder: MediaRecorder | null = null;
  let audioContext: AudioContext | null = null;
  let chunks: Blob[] = [];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create audio context for WAV conversion
      audioContext = new AudioContext();

      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: "audio/webm" });

        try {
          // Convert webm to WAV
          const arrayBuffer = await webmBlob.arrayBuffer();
          const audioBuffer = await audioContext!.decodeAudioData(arrayBuffer);

          // Get PCM data from first channel
          const pcmData = audioBuffer.getChannelData(0);

          // Encode as WAV
          const wavBlob = encodeWAV(pcmData, audioBuffer.sampleRate);

          audioBlob.value = wavBlob;
          audioUrl.value = URL.createObjectURL(wavBlob);
        } catch (conversionError) {
          error.value = 'Failed to convert audio to WAV format';
        }

        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());

        // Clean up audio context
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
      };

      duration.value = 0;
      durationTimer.value = setInterval(() => {
        duration.value += 1;
      }, 1000);

      mediaRecorder.start();
      recording.value = true;
      audioBlob.value = null;
      audioUrl.value = null;
      error.value = null;
    } catch (err) {
      error.value = (err as Error).message;
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder || !recording.value) return;
    mediaRecorder.stop();
    recording.value = false;
    if (durationTimer.value) {
      clearInterval(durationTimer.value);
      durationTimer.value = null;
    }
  };

  const reset = () => {
    audioBlob.value = null;
    audioUrl.value = null;
    recording.value = false;
    error.value = null;
    duration.value = 0;
  };

  return {
    recording,
    audioBlob,
    audioUrl,
    error,
    duration,
    startRecording,
    stopRecording,
    reset,
  };
}
