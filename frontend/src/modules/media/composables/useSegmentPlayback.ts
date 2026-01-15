import { computed, ref, type ComputedRef, type Ref } from 'vue';

type PlayerControls = {
  play?: () => void;
  pause?: () => void;
  togglePlayback?: () => void;
  setCurrentTime?: (seconds: number) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getVideoElement?: () => HTMLVideoElement | null;
};

type Options = {
  getPlayer: () => PlayerControls | null;
  segmentStartSeconds: Ref<number> | ComputedRef<number>;
  segmentEndSeconds: Ref<number> | ComputedRef<number>;
  isActive?: Ref<boolean> | ComputedRef<boolean>;
  isPlaying?: Ref<boolean>;
  enableWatchedHalf?: boolean;
  onWatchedHalf?: () => void;
};

const END_EPSILON_SECONDS = 0.05;

export function useSegmentPlayback(options: Options) {
  const currentTime = ref(0);
  const duration = ref(0);
  const hasSeekedToStart = ref(false);
  const endedWithinSegment = ref(false);
  const suppressEndClampUntilMs = ref(0);
  const suppressBufferingUntilMs = ref(0);
  const watchedSeconds = ref(0);
  const lastWatchedTime = ref<number | null>(null);
  const hasReportedHalf = ref(false);

  const segmentStart = computed(() => Math.max(0, options.segmentStartSeconds.value ?? 0));
  const segmentEnd = computed(() => Math.max(0, options.segmentEndSeconds.value ?? 0));

  const segmentLength = computed(() => {
    const start = segmentStart.value;
    const end = segmentEnd.value;
    if (end > start) return end - start;
    // Fallback: if segment bounds missing, fall back to full duration.
    return Math.max(0, duration.value - start);
  });

  const progress01 = computed(() => {
    const len = segmentLength.value;
    if (!len) return 0;

    const start = segmentStart.value;
    const end = segmentEnd.value;

    const effectiveEnd = end > start ? end : start + len;
    const t = Math.min(effectiveEnd, Math.max(start, currentTime.value));
    return Math.min(1, Math.max(0, (t - start) / len));
  });

  const segmentCurrentSeconds = computed(() => {
    return Math.max(0, (currentTime.value ?? 0) - segmentStart.value);
  });

  function playAfterSeek(targetSeconds: number) {
    const player = options.getPlayer();
    const video = player?.getVideoElement?.() ?? null;
    if (!video) {
      player?.play?.();
      return;
    }

    let done = false;
    let timer: number | null = null;

    const cleanup = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', onSeeked);
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const onSeeked = () => {
      // Extra guard: don't wait for perfect equality; just ensure we're near the target.
      const dt = Math.abs((video.currentTime ?? 0) - targetSeconds);
      cleanup();
      if (dt <= 0.5) {
        player?.play?.();
      } else {
        // Best-effort play anyway; the player will no-op if src isn't ready.
        player?.play?.();
      }
    };

    video.addEventListener('seeked', onSeeked);
    timer = window.setTimeout(() => {
      cleanup();
      player?.play?.();
    }, 900);
  }

  function seekRelative(deltaSeconds: number) {
    const player = options.getPlayer();
    const t = (player?.getCurrentTime?.() ?? currentTime.value ?? 0) + deltaSeconds;
    const start = segmentStart.value;
    const end = segmentEnd.value;
    const d = duration.value ?? 0;
    const maxEnd = end > start ? end : (d > 0 ? d : Number.POSITIVE_INFINITY);
    const clamped = Math.max(start, Math.min(maxEnd, Math.max(0, t)));
    endedWithinSegment.value = false;
    suppressEndClampUntilMs.value = Date.now() + 750;
    player?.setCurrentTime?.(clamped);
  }

  function handleTimeupdate(p: { currentTime: number; duration: number }): { didClampEnd: boolean } {
    currentTime.value = p.currentTime;
    duration.value = p.duration;

    const active = options.isActive ? options.isActive.value : true;
    if (!active) return { didClampEnd: false };

    if (options.enableWatchedHalf !== false && options.isPlaying?.value) {
      const prev = lastWatchedTime.value;
      const delta = typeof prev === 'number' ? p.currentTime - prev : 0;
      if (delta > 0 && delta < 2.5) {
        watchedSeconds.value += delta;
      }
      const len = segmentLength.value;
      if (!hasReportedHalf.value && len > 0 && watchedSeconds.value / len >= 0.5) {
        hasReportedHalf.value = true;
        options.onWatchedHalf?.();
      }
    }
    lastWatchedTime.value = p.currentTime;

    // After we issue a restart/seek, some browsers emit a timeupdate before the
    // seek takes effect. Avoid immediately re-triggering the "end" clamp.
    if (Date.now() < suppressEndClampUntilMs.value) {
      const start = segmentStart.value;
      if (p.currentTime <= start + 0.25) {
        suppressEndClampUntilMs.value = 0;
      }
      return { didClampEnd: false };
    }

    const start = segmentStart.value;
    const end = segmentEnd.value;
    const endClamped = end > 0 && p.duration > 0 ? Math.min(end, p.duration) : end;
    if (endClamped > 0 && p.currentTime >= endClamped - END_EPSILON_SECONDS) {
      suppressBufferingUntilMs.value = Date.now() + 1000;
      options.getPlayer()?.pause?.();
      options.getPlayer()?.setCurrentTime?.(endClamped);
      endedWithinSegment.value = true;
      return { didClampEnd: true };
    }
    if (start > 0 && !hasSeekedToStart.value && p.duration > 0) {
      // Safety net: if we missed loadedmetadata, still snap to segment start once.
      hasSeekedToStart.value = true;
      endedWithinSegment.value = false;
      suppressEndClampUntilMs.value = Date.now() + 1000;
      options.getPlayer()?.setCurrentTime?.(start);
    }

    return { didClampEnd: false };
  }

  function handleLoadedMetadata(p: { duration: number }) {
    duration.value = p.duration;
    hasSeekedToStart.value = false;
    endedWithinSegment.value = false;

    const active = options.isActive ? options.isActive.value : true;
    if (!active) return;
    const start = segmentStart.value;
    if (start > 0) {
      hasSeekedToStart.value = true;
      suppressEndClampUntilMs.value = Date.now() + 1000;
      options.getPlayer()?.setCurrentTime?.(start);
    }
  }

  function resetWatchTracking() {
    watchedSeconds.value = 0;
    lastWatchedTime.value = null;
    hasReportedHalf.value = false;
  }

  function resetForActiveItem() {
    endedWithinSegment.value = false;
    hasSeekedToStart.value = false;
    lastWatchedTime.value = segmentStart.value;
    options.getPlayer()?.pause?.();
    suppressEndClampUntilMs.value = Date.now() + 1000;
    options.getPlayer()?.setCurrentTime?.(segmentStart.value);
  }

  function restartSegment() {
    endedWithinSegment.value = false;
    suppressEndClampUntilMs.value = Date.now() + 1200;
    const target = segmentStart.value;
    options.getPlayer()?.setCurrentTime?.(target);
    playAfterSeek(target);
  }

  function scrubToSegmentSeconds(seconds: number) {
    const len = segmentLength.value;
    if (!len) return;
    const t = segmentStart.value + Math.max(0, Math.min(len, seconds));
    endedWithinSegment.value = false;
    suppressEndClampUntilMs.value = Date.now() + 1000;
    options.getPlayer()?.setCurrentTime?.(t);
  }

  function clearEndedWithinSegment() {
    endedWithinSegment.value = false;
  }

  function updateEndedWithinSegmentOnPause() {
    const end = segmentEnd.value;
    if (end > 0 && currentTime.value >= end - END_EPSILON_SECONDS) {
      endedWithinSegment.value = true;
    }
  }

  function resetOnSourceChange() {
    hasSeekedToStart.value = false;
    endedWithinSegment.value = false;
    currentTime.value = 0;
    duration.value = 0;
    resetWatchTracking();
  }

  return {
    currentTime,
    duration,
    segmentStart,
    segmentEnd,
    segmentLength,
    progress01,
    segmentCurrentSeconds,
    endedWithinSegment,
    suppressBufferingUntilMs,
    resetWatchTracking,
    resetForActiveItem,
    handleTimeupdate,
    handleLoadedMetadata,
    seekRelative,
    restartSegment,
    scrubToSegmentSeconds,
    clearEndedWithinSegment,
    updateEndedWithinSegmentOnPause,
    resetOnSourceChange,
  };
}
