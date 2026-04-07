/** Loose UUID check for Postgres uuid columns (avoids 400 from PostgREST on invalid text). */
const UUID_STRING_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_STRING_RE.test(value.trim());
}

/**
 * Format a timestamptz (ISO string) as human-readable local time (e.g. "4:00 PM").
 * Used for price_drop_time on printed labels.
 */
export function formatDropTime(timestamptz: string): string {
  const date = new Date(timestamptz);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
