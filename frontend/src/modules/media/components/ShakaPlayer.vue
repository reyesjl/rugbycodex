<script setup lang="ts">
import { onBeforeUnmount, ref, watch, useAttrs } from 'vue';
import shaka from 'shaka-player';
import { logInfo, logError, logPerformance } from '@/lib/logger';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  manifestUrl: string;
}>();

const emit = defineEmits<{
  (e: 'error', message: string): void;
}>();

const attrs = useAttrs();
const videoEl = ref<HTMLVideoElement | null>(null);
let player: shaka.Player | null = null;
let loadStartTime: number | null = null;
let playbackSessionId: string | null = null;

const DEBUG = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  console.debug('[ShakaPlayer]', ...args);
}

function destroyPlayer() {
  if (!player) return;
  player.removeEventListener('error', onErrorEvent);
  player.destroy();
  player = null;
  playbackSessionId = null;
}

function onErrorEvent(event: Event) {
  const shakaError = (event as any).detail;
  console.error('[Shaka] error event', shakaError);
  
  // Log to Axiom
  logError('Video playback error', shakaError, {
    playback_session_id: playbackSessionId,
    manifest_url: props.manifestUrl,
    error_code: shakaError?.code,
    error_category: shakaError?.category,
  });
  
  emit('error', shakaError?.message ?? 'Shaka player error');
}

function onError(error: shaka.util.Error) {
  console.error('[Shaka] error', error);
  
  // Log to Axiom
  logError('Video player error', error, {
    playback_session_id: playbackSessionId,
    manifest_url: props.manifestUrl,
    error_code: error?.code,
    error_category: error?.category,
  });
  
  emit('error', error?.message ?? 'Shaka player error');
}

async function initializePlayer(): Promise<boolean> {
  const el = videoEl.value;
  if (!el) {
    return false;
  }

  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    emit('error', 'Browser does not support Shaka Player');
    logError('Browser not supported for video playback', new Error('Shaka Player not supported'));
    return false;
  }

  destroyPlayer();

  player = new shaka.Player();
  await player.attach(el);
  player.addEventListener('error', onErrorEvent);
  
  // Track video playback events
  el.addEventListener('loadedmetadata', () => {
    if (loadStartTime) {
      const loadTimeMs = Date.now() - loadStartTime;
      logPerformance('video_load_time', loadTimeMs, 'ms', {
        playback_session_id: playbackSessionId,
        manifest_url: props.manifestUrl,
      });
    }
  });
  
  el.addEventListener('playing', () => {
    logInfo('Video playback started', {
      playback_session_id: playbackSessionId,
      manifest_url: props.manifestUrl,
      video_duration: el.duration,
    });
  });
  
  el.addEventListener('pause', () => {
    logInfo('Video playback paused', {
      playback_session_id: playbackSessionId,
      current_time: el.currentTime,
    });
  });
  
  el.addEventListener('ended', () => {
    logInfo('Video playback completed', {
      playback_session_id: playbackSessionId,
      video_duration: el.duration,
    });
  });
  
  player.configure({
    streaming: {
      rebufferingGoal: 2,
      bufferingGoal: 10,
    },
  });

  debugLog('player initialized');
  return true;
}

async function loadManifest(url: string) {
  if (!url) {
    destroyPlayer();
    return;
  }
  
  // Generate new playback session ID
  playbackSessionId = crypto.randomUUID();
  loadStartTime = Date.now();
  
  logInfo('Loading video manifest', {
    playback_session_id: playbackSessionId,
    manifest_url: url,
  });
  
  const ready = await initializePlayer();
  if (!ready || !player) {
    return;
  }

  try {
    await player.load(url);
    debugLog('manifest loaded', url);
    
    const loadTimeMs = Date.now() - (loadStartTime || Date.now());
    logInfo('Video manifest loaded', {
      playback_session_id: playbackSessionId,
      manifest_url: url,
      load_time_ms: loadTimeMs,
    });
  } catch (error) {
    onError(error as shaka.util.Error);
  }
}

watch(
  [() => props.manifestUrl, videoEl],
  ([next, el]) => {
    if (!next) {
      destroyPlayer();
      return;
    }
    if (!el) return;
    void loadManifest(next);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  destroyPlayer();
});

defineExpose({
  getVideoElement: () => videoEl.value,
});
</script>

<template>
  <video
    ref="videoEl"
    class="w-full h-full"
    playsinline
    muted
    preload="metadata"
    webkit-playsinline
    v-bind="attrs"
  />
</template>
