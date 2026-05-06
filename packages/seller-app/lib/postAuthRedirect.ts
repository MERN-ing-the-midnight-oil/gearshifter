import type { Href } from 'expo-router';

/**
 * Pull event UUID from allowed seller deep links (`/event/<id>/...`).
 */
export function extractEventIdFromSellerRedirect(
  redirect: string | string[] | undefined
): string | null {
  const raw = Array.isArray(redirect) ? redirect[0] : redirect;
  if (!raw || typeof raw !== 'string') return null;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    path = raw;
  }
  const base = (path.split('?')[0] ?? path).trim();
  const m = base.match(/^\/event\/([0-9a-f-]{36})(?:\/|$)/i);
  return m?.[1] ?? null;
}

/**
 * After sign-in / sign-up, only allow in-app paths (avoid open redirects).
 * Supports `/event/:id`, `/event/:id/add-item`, and optional query string.
 * `/event/:id/register` is normalized to the dashboard (phone sign-in is registration).
 */
export function resolveSellerPostAuthRedirect(
  redirect: string | string[] | undefined
): Href {
  const raw = Array.isArray(redirect) ? redirect[0] : redirect;
  if (!raw || typeof raw !== 'string') return '/(tabs)';
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    path = raw;
  }
  const base = (path.split('?')[0] ?? path).trim();
  if (base.startsWith('/event/')) {
    if (/\/register\/?$/i.test(base)) {
      return '/(tabs)';
    }
    return path as Href;
  }
  return '/(tabs)';
}
