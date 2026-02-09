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
  preBufferSeconds = 5,
  postBufferSeconds = 10,
  minLengthSeconds = 15,
  maxLengthSeconds = 60
): SegmentBounds {
  const startTime = toFiniteNumber(recordStartVideoTime, 0);
  const durationSeconds = Math.max(0, toFiniteNumber(recordingDuration, 0));
  const pre = Math.max(0, toFiniteNumber(preBufferSeconds, 0));
  const post = Math.max(0, toFiniteNumber(postBufferSeconds, 0));
  const baseMinLength = Math.max(0, toFiniteNumber(minLengthSeconds, 0));
  const maxLength = Math.max(0, toFiniteNumber(maxLengthSeconds, 0));

  // Dynamic minimum length: 3x recording duration, but capped
  // For 2s recording: 6s minimum
  // For 10s recording: 30s minimum
  // For 30s recording: 60s minimum (capped at maxLength)
  const dynamicMinLength = Math.min(
    Math.max(baseMinLength, durationSeconds * 3),
    maxLength
  );

  const startSeconds = Math.max(0, startTime - pre);
  let endSeconds = startTime + durationSeconds + post;
  
  if (endSeconds - startSeconds < dynamicMinLength) {
    endSeconds = startSeconds + dynamicMinLength;
  }

  if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
    endSeconds = Math.min(mediaDuration, endSeconds);
  }

  if (endSeconds < startSeconds) {
    endSeconds = startSeconds;
  }

  return { startSeconds, endSeconds };
}
