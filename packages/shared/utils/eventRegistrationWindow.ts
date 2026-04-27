import type { Event } from '../types/models';

/**
 * Whether sellers may start a new swap registration for this event.
 * Matches seller event detail: calendar window plus workflow status `registration`, and not archived.
 */
export function isSellerSwapRegistrationWindowOpen(event: Event, now: Date = new Date()): boolean {
  if (event.archivedAt) return false;
  if (!event.registrationOpenDate || !event.registrationCloseDate) return false;
  const open = new Date(event.registrationOpenDate);
  const close = new Date(event.registrationCloseDate);
  const status = event.status as string;
  return now >= open && now <= close && status === 'registration';
}
