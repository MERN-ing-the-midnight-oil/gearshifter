import type { Item, ItemStatus } from '../types/models';

const TITLE_MAX_LEN = 72;

/**
 * Title for seller-facing lists: optional dashboard listing name, else a short human line from
 * description, else category, else the technical item number (e.g. SG2026-…).
 */
export function getSellerFacingItemTitle(item: Item): string {
  const label = item.sellerItemLabel?.trim();
  if (label) return label;

  const rawDesc =
    item.description?.trim() ||
    (typeof item.customFields?.description === 'string' ? item.customFields.description.trim() : '');
  if (rawDesc) {
    const oneLine = rawDesc.split(/\r?\n/)[0]?.trim() ?? '';
    if (oneLine) {
      return oneLine.length > TITLE_MAX_LEN
        ? `${oneLine.slice(0, TITLE_MAX_LEN - 1)}…`
        : oneLine;
    }
  }

  const cat = item.category?.trim();
  if (cat) return cat;

  return item.itemNumber;
}

/** Seller-facing status pill: `pending` is pre-check-in (not yet confirmed by staff). */
export function formatSellerItemStatusLabel(status: ItemStatus): string {
  if (status === 'pending') return 'Pre-registered';
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
