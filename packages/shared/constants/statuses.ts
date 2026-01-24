// Status enums
export const ITEM_STATUSES = [
  'pending',
  'checked_in',
  'for_sale',
  'sold',
  'picked_up',
  'donated',
] as const;

export const EVENT_STATUSES = [
  'registration',
  'checkin',
  'shopping',
  'pickup',
  'closed',
] as const;

export type ItemStatus = typeof ITEM_STATUSES[number];
export type EventStatus = typeof EVENT_STATUSES[number];

