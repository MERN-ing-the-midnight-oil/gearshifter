// Status enums (ItemStatus source of truth: types/models.ts)
import type { ItemStatus } from '../types/models';

export const ITEM_STATUSES = [
  'pending',
  'checked_in',
  'for_sale',
  'sold',
  'picked_up',
  'donated',
  'donated_abandoned',
  'unclaimed',
  'withdrawn',
  'lost',
  'damaged',
] as const satisfies readonly ItemStatus[];

/** No longer listed for at-event pickup (sold, resolved, org-retained, or inventory exception). */
export const ITEM_STATUS_PICKUP_STATION_COMPLETE = new Set<ItemStatus>([
  'sold',
  'donated',
  'donated_abandoned',
  'picked_up',
  'unclaimed',
  'withdrawn',
  'lost',
  'damaged',
]);

/** Opt-in donation (`donated`) or policy abandonment to org (`donated_abandoned`). */
export function isItemDonatedToOrg(status: ItemStatus): boolean {
  return status === 'donated' || status === 'donated_abandoned';
}

export const EVENT_STATUSES = ['active', 'closed'] as const;

export type EventStatus = typeof EVENT_STATUSES[number];

