import type { Href } from 'expo-router';

/**
 * After sign-in / sign-up, only allow in-app paths (avoid open redirects).
 * Supports `/event/:id`, `/event/:id/register`, `/event/:id/add-item`, and optional query string.
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
  const base = path.split('?')[0] ?? path;
  if (base.startsWith('/event/')) return path as Href;
  return '/(tabs)';
}
