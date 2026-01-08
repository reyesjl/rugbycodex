import { ref, computed, onBeforeUnmount } from 'vue';

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  hasRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  audioLevel: number;
}

export function useAudioRecording() {
  const isRecording = ref(false);
  const isPaused = ref(false);
  const duration = ref(0);
  const audioBlob = ref<Blob | null>(null);
  const audioUrl = ref<string | null>(null);
  const error = ref<string | null>(null);
  const audioLevel = ref(0);

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioChunks: Blob[] = [];
  let startTime = 0;
  let pausedTime = 0;
  let timerInterval: number | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let animationFrameId: number | null = null;

  const hasRecording = computed(() => audioBlob.value !== null);

  const state = computed<AudioRecordingState>(() => ({
    isRecording: isRecording.value,
    isPaused: isPaused.value,
    duration: duration.value,
    hasRecording: hasRecording.value,
    audioBlob: audioBlob.value,
    audioUrl: audioUrl.value,
    error: error.value,
    audioLevel: audioLevel.value,
  }));

  function updateDuration() {
    if (isRecording.value && !isPaused.value) {
      duration.value = Date.now() - startTime - pausedTime;
    }
  }

  function startTimer() {
    if (timerInterval !== null) return;
    timerInterval = window.setInterval(updateDuration, 100);
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateAudioLevel() {
    if (!analyser || isPaused.value) {
      audioLevel.value = 0;
      return;
    }

    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) for better sensitivity
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i] ?? 128;
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Apply high gain and clamp to 0-1 range
    audioLevel.value = Math.min(rms * 10, 1);

    if (isRecording.value && !isPaused.value) {
      animationFrameId = requestAnimationFrame(updateAudioLevel);
    }
  }

  function startAudioLevelMonitoring() {
    if (!mediaStream || audioContext) return;

    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;

      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      updateAudioLevel();
    } catch (err) {
      console.error('Failed to setup audio level monitoring:', err);
    }
  }

  function stopAudioLevelMonitoring() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    analyser = null;
    audioLevel.value = 0;
  }

  async function startRecording() {
    try {
      error.value = null;

      // Request microphone access optimized for speech (Whisper transcription)
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono audio for Whisper
          sampleRate: 16000, // Optimal for Whisper
          echoCancellation: true, // Remove echo
          noiseSuppression: true, // Remove background noise
          autoGainControl: true, // Normalize volume levels
        },
      });

      // Create MediaRecorder with optimal settings for speech
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000, // Good quality for speech
      };
      mediaRecorder = new MediaRecorder(mediaStream, options);

      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        audioBlob.value = blob;

        // Create URL for playback
        if (audioUrl.value) {
          URL.revokeObjectURL(audioUrl.value);
        }
        audioUrl.value = URL.createObjectURL(blob);

        stopTimer();
      };

      mediaRecorder.onerror = (event) => {
        error.value = 'Recording error occurred';
        console.error('MediaRecorder error:', event);
        stopRecording();
      };

      // Start recording
      mediaRecorder.start();
      isRecording.value = true;
      isPaused.value = false;
      startTime = Date.now();
      pausedTime = 0;
      duration.value = 0;
      startTimer();
      startAudioLevelMonitoring();
    } catch (err) {
      // Handle specific microphone errors
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotFoundError':
            error.value = 'No microphone available';
            break;
          case 'NotAllowedError':
            error.value = 'Microphone access denied';
            break;
          case 'NotReadableError':
            error.value = 'Microphone is in use by another application';
            break;
          case 'OverconstrainedError':
            error.value = 'Microphone does not support required settings';
            break;
          default:
            error.value = `Microphone error: ${err.message}`;
        }
      } else {
        error.value = err instanceof Error ? err.message : 'Failed to start recording';
      }
      console.error('Failed to start recording:', err);
    }
  }

  function pauseRecording() {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

    mediaRecorder.pause();
    isPaused.value = true;
    pausedTime += Date.now() - startTime - pausedTime;
    stopTimer();
    audioLevel.value = 0;
  }

  function resumeRecording() {
    if (!mediaRecorder || mediaRecorder.state !== 'paused') return;

    mediaRecorder.resume();
    isPaused.value = false;
    startTime = Date.now() - duration.value;
    pausedTime = 0;
    startTimer();
    updateAudioLevel();
  }

  function stopRecording() {
    if (!mediaRecorder) return;

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    isRecording.value = false;
    isPaused.value = false;
    stopAudioLevelMonitoring();

    // Stop all tracks
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    mediaRecorder = null;
  }

  function resetRecording() {
    stopRecording();

    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value);
    }

    audioBlob.value = null;
    audioUrl.value = null;
    duration.value = 0;
    audioChunks = [];
    error.value = null;
  }

  function getAudioBlob(): Blob | null {
    return audioBlob.value;
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    stopRecording();
    stopAudioLevelMonitoring();
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value);
    }
  });

  return {
    state,
    isRecording,
    isPaused,
    duration,
    hasRecording,
    audioUrl,
    audioLevel,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    getAudioBlob,
  };
}
