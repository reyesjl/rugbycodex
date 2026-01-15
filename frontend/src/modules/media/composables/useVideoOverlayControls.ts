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

const DOUBLE_TAP_WINDOW_MS = 280;
// Only ramp if the user keeps double-clicking quickly.
const SEEK_RAMP_WINDOW_MS = 450;

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

  let lastTapAtMs = 0;
  let lastTapSide: 'left' | 'right' | null = null;
  let lastSeekDoubleAtMs = 0;
  let lastSeekSide: 'left' | 'right' | null = null;
  let seekRampLevel = 0; // 0=>5, 1=>10
  let pendingMouseSingleTapTimer: number | null = null;

  function showOverlay(durationMs: number | null = 2500) {
    overlayVisible.value = true;
    if (overlayTimer !== null) window.clearTimeout(overlayTimer);
    if (durationMs === null) return;
    overlayTimer = window.setTimeout(() => {
      overlayVisible.value = false;
      overlayTimer = null;
    }, durationMs);
  }

  function hideOverlay() {
    overlayVisible.value = false;
    if (overlayTimer !== null) {
      window.clearTimeout(overlayTimer);
      overlayTimer = null;
    }
  }

  function requestTogglePlay() {
    const video = options.getVideoEl();
    const willPlay = video ? video.paused : !options.isPlaying.value;
    if (willPlay) {
      hideOverlay();
      // After pressing play, ignore mouse-move reveal for a moment.
      suppressOverlayRevealUntilMs.value = Date.now() + 600;
    } else {
      showOverlay(null);
    }
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
    if (Date.now() < suppressOverlayRevealUntilMs.value) return;
    // Any movement over the surface should reveal controls.
    showOverlay(2500);
  }

  function onHoverLeave(e: PointerEvent) {
    if (!isMousePointer(e)) return;
    if (isBuffering.value) return;
    // When no longer hovering, auto-hide quickly.
    showOverlay(800);
  }

  function onNarrationButtonHoverEnter(e: PointerEvent) {
    if (!isMousePointer(e)) return;
    hideOverlay();
  }

  function nextSeekAmountSeconds(nowMs: number, side: 'left' | 'right'): number {
    const isContinuous = (nowMs - lastSeekDoubleAtMs) <= SEEK_RAMP_WINDOW_MS && lastSeekSide === side;
    if (!isContinuous) {
      seekRampLevel = 0;
    } else {
      seekRampLevel = Math.min(1, seekRampLevel + 1);
    }
    lastSeekDoubleAtMs = nowMs;
    lastSeekSide = side;
    return seekRampLevel === 0 ? 5 : 10;
  }

  function onTap(payload: TapPayload) {
    if (isBuffering.value) return;
    const now = Date.now();
    const side: 'left' | 'right' = (payload.xPct ?? 0.5) < 0.5 ? 'left' : 'right';
    const isDoubleTap = (now - lastTapAtMs) <= DOUBLE_TAP_WINDOW_MS && lastTapSide === side;
    lastTapAtMs = now;
    lastTapSide = side;

    // Desktop: single click toggles play/pause. Double click seeks.
    if (payload.pointerType === 'mouse') {
      if (isDoubleTap) {
        if (pendingMouseSingleTapTimer !== null) {
          window.clearTimeout(pendingMouseSingleTapTimer);
          pendingMouseSingleTapTimer = null;
        }
        const amount = nextSeekAmountSeconds(now, side);
        options.onSeekRelative(side === 'left' ? -amount : amount);
        flashSeek(side === 'left' ? 'rew' : 'ff', amount);
        return;
      }

      // Delay single-click so a second click can be treated as a double-click seek.
      if (pendingMouseSingleTapTimer !== null) window.clearTimeout(pendingMouseSingleTapTimer);
      pendingMouseSingleTapTimer = window.setTimeout(() => {
        pendingMouseSingleTapTimer = null;
        requestTogglePlay();
      }, DOUBLE_TAP_WINDOW_MS + 20);
      return;
    }

    // Touch: single tap toggles overlay, double tap seeks.
    if (isDoubleTap) {
      const amount = nextSeekAmountSeconds(now, side);
      options.onSeekRelative(side === 'left' ? -amount : amount);
      flashSeek(side === 'left' ? 'rew' : 'ff', amount);
      return;
    }

    if (overlayVisible.value) hideOverlay();
    else showOverlay();
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

  watch(overlayVisible, (v) => {
    // If controls disappear, restart ramp back at 5s.
    if (v) return;
    seekRampLevel = 0;
    lastSeekDoubleAtMs = 0;
    lastSeekSide = null;
  });

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
    if (pendingMouseSingleTapTimer !== null) {
      window.clearTimeout(pendingMouseSingleTapTimer);
      pendingMouseSingleTapTimer = null;
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
