export type DurationLikeSeconds = number | null | undefined;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Formats a duration (in seconds) as "<H>h <MM>m".
 * Example: 3670 -> "1h 01m"
 */
export function formatHoursMinutes(seconds: DurationLikeSeconds): string {
  const safeSeconds = Number(seconds ?? 0);
  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) {
    return '0h 00m';
  }

  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${pad2(minutes)}m`;
}
