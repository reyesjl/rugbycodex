export type DateLike = string | number | Date | null | undefined;

export function parseSupabaseDate(value: DateLike): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a Supabase timestamp (typically ISO string) as "Month YYYY".
 * Example: "January 2026"
 */
export function formatMonthYear(value: DateLike, locale?: string): string | null {
  const date = parseSupabaseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a Supabase timestamp as a relative day string like "3 days ago".
 * - Invalid/missing dates return null
 * - Future dates clamp to "0 days ago"
 */
export function formatDaysAgo(value: DateLike, now: Date = new Date()): string | null {
  const date = parseSupabaseDate(value);
  if (!date) return null;

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const days = Math.max(0, diffDays);

  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export type RelativeDuration = {
  count: number;
  unit: 'day' | 'week';
  isPast: boolean;
};

/**
 * Returns a relative duration in days or weeks.
 * - Future dates set isPast=false, past dates isPast=true
 * - Uses weeks for 7+ days
 * - Uses ceiling for partial periods
 */
export function getRelativeDaysWeeks(value: DateLike, now: Date = new Date()): RelativeDuration | null {
  const date = parseSupabaseDate(value);
  if (!date) return null;

  const diffMs = date.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const absDays = Math.ceil(Math.abs(diffMs) / 86_400_000);

  if (absDays >= 7) {
    const weeks = Math.max(1, Math.ceil(absDays / 7));
    return { count: weeks, unit: 'week', isPast };
  }

  return { count: absDays, unit: 'day', isPast };
}
