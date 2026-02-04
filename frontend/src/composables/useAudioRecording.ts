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

  const selectedMimeType = ref<string | null>(null);

  // Web Speech API for live transcription
  const liveTranscript = ref<string>('');
  const hasWebSpeechSupport = ref(false);
  let speechRecognition: any = null;

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioChunks: Blob[] = [];
  let startTime = 0;
  let pausedTime = 0;
  let timerInterval: number | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let animationFrameId: number | null = null;

  let pendingStopPromise: Promise<Blob> | null = null;
  let pendingStopResolve: ((blob: Blob) => void) | null = null;
  let pendingStopReject: ((err: unknown) => void) | null = null;
  let pendingStopTimer: number | null = null;

  // Check Web Speech API support on initialization
  const SpeechRecognition = 
    (window as any).SpeechRecognition || 
    (window as any).webkitSpeechRecognition;
  hasWebSpeechSupport.value = !!SpeechRecognition;

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
      liveTranscript.value = '';

      // Starting a new recording invalidates any previous stop waiters.
      pendingStopPromise = null;
      pendingStopResolve = null;
      pendingStopReject = null;
      if (pendingStopTimer !== null) {
        window.clearTimeout(pendingStopTimer);
        pendingStopTimer = null;
      }

      if (typeof MediaRecorder === 'undefined') {
        error.value = 'Audio recording is not supported in this browser.';
        return;
      }

      // Start Web Speech API for live transcription if supported
      if (hasWebSpeechSupport.value && SpeechRecognition) {
        try {
          speechRecognition = new SpeechRecognition();
          speechRecognition.continuous = true;
          speechRecognition.interimResults = true;
          speechRecognition.lang = 'en-US';
          
          speechRecognition.onresult = (event: any) => {
            const results = Array.from(event.results);
            const transcript = results
              .map((result: any) => result[0].transcript)
              .join('');
            liveTranscript.value = transcript;
          };
          
          speechRecognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            // Don't fail the recording, just disable live transcript
            speechRecognition = null;
          };
          
          speechRecognition.start();
        } catch (err) {
          console.warn('Failed to start speech recognition:', err);
          speechRecognition = null;
        }
      }

      // Prefer iOS/Safari-friendly containers when available.
      const preferredMimeTypes = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];

      selectedMimeType.value =
        preferredMimeTypes.find((type) => {
          try {
            return MediaRecorder.isTypeSupported(type);
          } catch {
            return false;
          }
        }) ?? null;

      // Request microphone access.
      // Note: iOS/Safari can be picky about advanced constraints like `sampleRate`.
      // We'll try “speech-friendly” constraints first, then fall back to plain audio.
      const primaryConstraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (primaryErr) {
        console.warn('getUserMedia(primary) failed, retrying with fallback constraints', primaryErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Create MediaRecorder. Some browsers throw if you pass an unsupported mimeType,
      // so only pass it when we've positively detected support.
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 16000,
      };
      if (selectedMimeType.value) {
        options.mimeType = selectedMimeType.value;
      }

      const recorder = new MediaRecorder(mediaStream, options);
      const stream = mediaStream;
      mediaRecorder = recorder;

      audioChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blobType = selectedMimeType.value ?? recorder.mimeType ?? 'audio/webm';
        const blob = new Blob(audioChunks, { type: blobType });
        audioBlob.value = blob;

        // Create URL for playback
        if (audioUrl.value) {
          URL.revokeObjectURL(audioUrl.value);
        }
        audioUrl.value = URL.createObjectURL(blob);

        stopTimer();

        // Resolve any awaited stop.
        if (pendingStopResolve) {
          pendingStopResolve(blob);
        }
        pendingStopPromise = null;
        pendingStopResolve = null;
        pendingStopReject = null;
        if (pendingStopTimer !== null) {
          window.clearTimeout(pendingStopTimer);
          pendingStopTimer = null;
        }

        // Stop all tracks only after MediaRecorder has finalized.
        try {
          stream?.getTracks().forEach((track) => track.stop());
        } catch {
          // best-effort
        }
        if (mediaStream === stream) {
          mediaStream = null;
        }
        if (mediaRecorder === recorder) {
          mediaRecorder = null;
        }
      };

      recorder.onerror = (event) => {
        error.value = 'Recording error occurred';
        console.error('MediaRecorder error:', event);

        if (pendingStopReject) {
          pendingStopReject(new Error('Recording error occurred'));
        }
        pendingStopPromise = null;
        pendingStopResolve = null;
        pendingStopReject = null;
        if (pendingStopTimer !== null) {
          window.clearTimeout(pendingStopTimer);
          pendingStopTimer = null;
        }

        stopRecording();
      };

      // Start recording
      recorder.start();
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

    const recorder = mediaRecorder;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    // Stop Web Speech API
    if (speechRecognition) {
      try {
        speechRecognition.stop();
      } catch (err) {
        console.warn('Failed to stop speech recognition:', err);
      }
      speechRecognition = null;
    }

    isRecording.value = false;
    isPaused.value = false;
    stopAudioLevelMonitoring();
  }

  async function stopRecordingAndGetBlob(timeoutMs = 8000): Promise<Blob> {
    if (audioBlob.value) return audioBlob.value;
    if (!mediaRecorder) {
      throw new Error('No active recording to stop.');
    }

    if (!pendingStopPromise) {
      pendingStopPromise = new Promise<Blob>((resolve, reject) => {
        pendingStopResolve = resolve;
        pendingStopReject = reject;
      });

      // Safety timeout so we don't hang forever if onstop never fires.
      pendingStopTimer = window.setTimeout(() => {
        if (pendingStopReject) {
          pendingStopReject(new Error('Timed out waiting for recorded audio.'));
        }
        pendingStopPromise = null;
        pendingStopResolve = null;
        pendingStopReject = null;
        pendingStopTimer = null;
      }, timeoutMs);

      stopRecording();
    }

    return pendingStopPromise;
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
    liveTranscript.value = '';
    speechRecognition = null;
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
    liveTranscript,
    hasWebSpeechSupport,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingAndGetBlob,
    resetRecording,
    getAudioBlob,
  };
}
