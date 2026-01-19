<script setup lang="ts">
import { onBeforeUnmount, ref, watch, useAttrs } from 'vue';
import shaka from 'shaka-player';

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
}

function onErrorEvent(event: Event) {
  const shakaError = (event as any).detail;
  console.error('[Shaka] error event', shakaError);
  emit('error', shakaError?.message ?? 'Shaka player error');
}

function onError(error: shaka.util.Error) {
  console.error('[Shaka] error', error);
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
    return false;
  }

  destroyPlayer();

  player = new shaka.Player();
  await player.attach(el);
  player.addEventListener('error', onErrorEvent);
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
  const ready = await initializePlayer();
  if (!ready || !player) {
    return;
  }

  try {
    await player.load(url);
    debugLog('manifest loaded', url);
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
