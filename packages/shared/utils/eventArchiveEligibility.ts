import type { Event } from '../types/models';

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Latest instant we treat as "when the event ends" for archive eligibility (local calendar day of that instant matters). */
export function getEventEndInstant(event: Event): Date {
  if (event.pickupEndTime) {
    return new Date(event.pickupEndTime);
  }
  if (event.shopCloseTime) {
    return new Date(event.shopCloseTime);
  }
  const end = new Date(event.eventDate);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Archive is allowed from the first moment of the calendar day after the day the event ended (local timezone).
 */
export function isEventArchiveEligible(event: Event, now: Date = new Date()): boolean {
  if (event.archivedAt) {
    return false;
  }
  const end = getEventEndInstant(event);
  const endDay = startOfLocalDay(end);
  const firstMomentAfterEndDay = new Date(endDay);
  firstMomentAfterEndDay.setDate(firstMomentAfterEndDay.getDate() + 1);
  return now.getTime() >= firstMomentAfterEndDay.getTime();
}
