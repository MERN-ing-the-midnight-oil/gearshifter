import type { Event } from '../types/models';

/**
 * Whether sellers may start a new swap registration for this event.
 * Uses calendar window on `registrationOpenDate` / optional `registrationCloseDate`, plus `status === 'active'`
 * (event status is `active` | `closed` after the workflow enum simplification).
 */
export function isSellerSwapRegistrationWindowOpen(event: Event, now: Date = new Date()): boolean {
  if (event.archivedAt) return false;
  if (event.status !== 'active') return false;
  if (!event.registrationOpenDate) return false;

  const open = new Date(event.registrationOpenDate);
  if (now < open) return false;

  if (event.registrationCloseDate) {
    const close = new Date(event.registrationCloseDate);
    if (now > close) return false;
  }

  return true;
}
