/**
 * Public seller dashboard URL (opened in browser or from SMS).
 * `EXPO_PUBLIC_SELLER_DASHBOARD_ORIGIN` should be the deployed seller web origin (no trailing slash).
 */
export function buildSellerDashboardUrl(accessToken: string, origin?: string): string {
  const raw =
    origin ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SELLER_DASHBOARD_ORIGIN) ||
    'https://gearswap.app';
  const base = raw.replace(/\/$/, '');
  return `${base}/seller?token=${encodeURIComponent(accessToken)}`;
}
