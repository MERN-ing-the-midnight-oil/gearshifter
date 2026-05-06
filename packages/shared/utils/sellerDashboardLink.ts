/**
 * Public seller dashboard URL (opened in browser or from SMS).
 * `EXPO_PUBLIC_SELLER_DASHBOARD_ORIGIN` should be the deployed seller web origin (no trailing slash).
 * Optional `eventId` scopes the session after sign-in (strict RLS).
 */
export function buildSellerDashboardUrl(
  accessToken: string,
  origin?: string,
  eventId?: string | null
): string {
  const raw =
    origin ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SELLER_DASHBOARD_ORIGIN) ||
    'https://gearswap.app';
  const base = raw.replace(/\/$/, '');
  const ev = eventId?.trim();
  const q = ev
    ? `token=${encodeURIComponent(accessToken)}&eventId=${encodeURIComponent(ev)}`
    : `token=${encodeURIComponent(accessToken)}`;
  return `${base}/seller?${q}`;
}
