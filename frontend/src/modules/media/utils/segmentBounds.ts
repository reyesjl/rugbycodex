export type SegmentBounds = {
  startSeconds: number;
  endSeconds: number;
};

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function computeSegmentBounds(
  recordStartVideoTime: number,
  recordingDuration: number,
  mediaDuration: number,
  preBufferSeconds = 3,
  postBufferSeconds = 5,
  minTargetSeconds = 10,
  maxTargetSeconds = 60,
  durationMultiplier = 1.8
): SegmentBounds {
  const startTime = toFiniteNumber(recordStartVideoTime, 0);
  const durationSeconds = Math.max(0, toFiniteNumber(recordingDuration, 0));
  const pre = Math.max(0, toFiniteNumber(preBufferSeconds, 0));
  const post = Math.max(0, toFiniteNumber(postBufferSeconds, 0));
  const minTarget = Math.max(0, toFiniteNumber(minTargetSeconds, 0));
  const maxTarget = Math.max(minTarget, toFiniteNumber(maxTargetSeconds, minTarget));
  const multiplier = Math.max(0, toFiniteNumber(durationMultiplier, 0));

  // Segment length target: clamp(max(minTarget, duration * multiplier), minTarget, maxTarget).
  // Always preserves pre/post buffers; longer recordings can exceed maxTarget.
  const targetLength = Math.min(
    maxTarget,
    Math.max(minTarget, durationSeconds * multiplier)
  );

  const startSeconds = Math.max(0, startTime - pre);
  let endSeconds = startTime + durationSeconds + post;
  
  if (endSeconds - startSeconds < targetLength) {
    endSeconds = startSeconds + targetLength;
  }

  if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
    endSeconds = Math.min(mediaDuration, endSeconds);
  }

  if (endSeconds < startSeconds) {
    endSeconds = startSeconds;
  }

  return { startSeconds, endSeconds };
}
