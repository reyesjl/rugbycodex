import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

type PlayerControls = {
  setMuted?: (muted: boolean) => void;
  setVolume01?: (volume01: number) => void;
  getMuted?: () => boolean;
  getVolume01?: () => number;
};

type TapPayload = {
  pointerType: PointerEvent['pointerType'];
  xPct: number;
  yPct: number;
};

type FlashIcon = 'play' | 'pause' | 'rew5' | 'rew10' | 'ff5' | 'ff10' | null;

type Options = {
  getVideoEl: () => HTMLVideoElement | null;
  getSurfaceEl: () => HTMLElement | null;
  getPlayer?: () => PlayerControls | null;
  isPlaying: Ref<boolean>;
  onTogglePlay: () => void;
  onSeekRelative: (deltaSeconds: number) => void;
  onFullscreenError?: (err: unknown) => void;
  suppressBufferingUntilMs?: Ref<number>;
  shouldIgnoreBuffering?: (next: boolean) => boolean;
  requireElementForFullscreen?: boolean;
};

export function useVideoOverlayControls(options: Options) {
  const overlayVisible = ref(false);
  let overlayTimer: number | null = null;

  const isBuffering = ref(false);
  const suppressOverlayRevealUntilMs = ref(0);
  const suppressBufferingUntilMs = options.suppressBufferingUntilMs ?? ref(0);

  const flashIcon = ref<FlashIcon>(null);
  let flashTimer: number | null = null;

  const volume01 = ref(1);
  const muted = ref(false);
  const volumeBeforeMute01 = ref(0.7);

  const isFullscreen = ref(false);

  function showOverlay(durationMs: number | null = null) {
    void durationMs;
    overlayVisible.value = true;
    if (overlayTimer !== null) window.clearTimeout(overlayTimer);
  }

  function hideOverlay() {
    overlayVisible.value = false;
    if (overlayTimer !== null) {
      window.clearTimeout(overlayTimer);
      overlayTimer = null;
    }
  }

  function requestTogglePlay() {
    options.onTogglePlay();
  }

  function flashPlayPause(kind: 'play' | 'pause') {
    flashIcon.value = kind;
    if (flashTimer !== null) window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flashIcon.value = null;
      flashTimer = null;
    }, 180);
  }

  function flashSeek(kind: 'ff' | 'rew', amountSeconds: number) {
    const a = amountSeconds >= 10 ? 10 : 5;
    flashIcon.value = kind === 'rew'
      ? (a === 10 ? 'rew10' : 'rew5')
      : (a === 10 ? 'ff10' : 'ff5');
    if (flashTimer !== null) window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flashIcon.value = null;
      flashTimer = null;
    }, 180);
  }

  function isMousePointer(e: PointerEvent): boolean {
    return e.pointerType === 'mouse';
  }

  function onHoverMove(e: PointerEvent) {
    if (!isMousePointer(e)) return;
    if (isBuffering.value) return;
    showOverlay(null);
  }

  function onHoverLeave(e: PointerEvent) {
    if (!isMousePointer(e)) return;
    if (isBuffering.value) return;
    hideOverlay();
  }

  function onNarrationButtonHoverEnter(e: PointerEvent) {
    if (!isMousePointer(e)) return;
    hideOverlay();
  }

  function onTap(payload: TapPayload) {
    void payload;
    if (isBuffering.value) return;
    requestTogglePlay();
  }

  function handleBuffering(next: boolean) {
    if (Date.now() < suppressBufferingUntilMs.value) return;
    if (options.shouldIgnoreBuffering?.(next)) return;
    isBuffering.value = next;
    if (next) hideOverlay();
  }

  function applyVolumeToPlayer() {
    const player = options.getPlayer?.() ?? null;
    player?.setMuted?.(muted.value);
    player?.setVolume01?.(volume01.value);
  }

  function syncVolumeFromPlayer() {
    const player = options.getPlayer?.() ?? null;
    const currentVol = player?.getVolume01?.();
    const currentMuted = player?.getMuted?.();
    if (typeof currentVol === 'number') {
      volume01.value = Math.max(0, Math.min(1, currentVol));
      if (volume01.value > 0) volumeBeforeMute01.value = volume01.value;
    }
    if (typeof currentMuted === 'boolean') {
      muted.value = currentMuted;
    }
  }

  function toggleMute() {
    if (muted.value || volume01.value <= 0) {
      muted.value = false;
      if (volume01.value <= 0) volume01.value = volumeBeforeMute01.value || 0.7;
    } else {
      if (volume01.value > 0) volumeBeforeMute01.value = volume01.value;
      muted.value = true;
    }
    applyVolumeToPlayer();
  }

  function setVolume(next: number) {
    const v = Math.max(0, Math.min(1, next));
    volume01.value = v;
    muted.value = v <= 0;
    applyVolumeToPlayer();
  }

  const canFullscreen = computed(() => {
    const surface = options.getSurfaceEl() as any;
    const video = options.getVideoEl() as any;
    const doc = document as any;
    if (options.requireElementForFullscreen && !surface && !video) return false;
    return Boolean(
      surface?.requestFullscreen ||
      surface?.webkitRequestFullscreen ||
      surface?.msRequestFullscreen ||
      doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      video?.webkitEnterFullscreen
    );
  });

  function getFullscreenElement(): Element | null {
    const doc = document as any;
    return (document.fullscreenElement ?? doc.webkitFullscreenElement ?? null) as Element | null;
  }

  function syncFullscreenState() {
    const active = getFullscreenElement();
    const surface = options.getSurfaceEl();
    const video = options.getVideoEl() as any;
    const isNativeVideoFullscreen = Boolean(video?.webkitDisplayingFullscreen);
    isFullscreen.value = isNativeVideoFullscreen || Boolean(active && surface && active === surface);
  }

  async function toggleFullscreen() {
    const el = options.getSurfaceEl() as any;
    const video = options.getVideoEl() as any;
    const doc = document as any;
    if (!el && !video) return;

    try {
      const isNativeVideoFullscreen = Boolean(video?.webkitDisplayingFullscreen);

      if (getFullscreenElement() || isNativeVideoFullscreen) {
        await Promise.resolve((document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.() ?? video?.webkitExitFullscreen?.()) as any);
        return;
      }

      // Prefer fullscreen on the container so overlays remain visible.
      if (el?.requestFullscreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen) {
        await Promise.resolve((el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.() ?? el.msRequestFullscreen?.()) as any);
        return;
      }

      // iOS fallback: enter native video fullscreen.
      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch (err) {
      if (options.onFullscreenError) {
        options.onFullscreenError(err);
      }
    }
  }

  function bindVideoFullscreenListeners(video: any, previous: any) {
    if (previous) {
      previous.removeEventListener?.('webkitbeginfullscreen', syncFullscreenState);
      previous.removeEventListener?.('webkitendfullscreen', syncFullscreenState);
    }
    if (!video) return;
    video.addEventListener?.('webkitbeginfullscreen', syncFullscreenState);
    video.addEventListener?.('webkitendfullscreen', syncFullscreenState);
  }

  watch([volume01, muted], () => {
    applyVolumeToPlayer();
  });

  watch(
    () => options.getVideoEl(),
    (video, prev) => {
      bindVideoFullscreenListeners(video as any, prev as any);
      syncFullscreenState();
    },
    { immediate: true }
  );

  onMounted(() => {
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange' as any, syncFullscreenState);
    syncFullscreenState();
  });

  onBeforeUnmount(() => {
    hideOverlay();
    bindVideoFullscreenListeners(null, options.getVideoEl() as any);
    if (flashTimer !== null) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
    document.removeEventListener('fullscreenchange', syncFullscreenState);
    document.removeEventListener('webkitfullscreenchange' as any, syncFullscreenState);
  });

  return {
    overlayVisible,
    isBuffering,
    suppressOverlayRevealUntilMs,
    suppressBufferingUntilMs,
    flashIcon,
    volume01,
    muted,
    isFullscreen,
    canFullscreen,
    showOverlay,
    hideOverlay,
    requestTogglePlay,
    flashPlayPause,
    flashSeek,
    onHoverMove,
    onHoverLeave,
    onNarrationButtonHoverEnter,
    onTap,
    handleBuffering,
    applyVolumeToPlayer,
    syncVolumeFromPlayer,
    toggleMute,
    setVolume,
    toggleFullscreen,
  };
}
