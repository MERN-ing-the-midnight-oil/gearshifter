import type { TagField } from '../types/models';

/**
 * Default line for new seller receipt templates (seeded from item tag sizes or “+ New”).
 * Prints as one sentence: Sold to {buyer} at {date & time} for {price}.
 */
export const DEFAULT_SELLER_RECEIPT_TAG_FIELDS: TagField[] = [
  {
    field: 'sale_summary',
    label: 'Sale summary',
    hideLabelOnTag: true,
    maxLength: 140,
    fontSize: 10,
    fontWeight: 'normal',
    required: false,
    dataType: 'text',
  },
];

/** Pick list for configuring seller receipt layouts (shown in organizer UI). */
export const SELLER_RECEIPT_AVAILABLE_FIELDS: Array<{ name: string; label: string; defaultLabel?: string }> = [
  {
    name: 'sale_summary',
    label: 'Sale summary (sold to… at… for…)',
    defaultLabel: 'Sale',
  },
  { name: 'buyer_name', label: 'Buyer name', defaultLabel: 'Buyer' },
  { name: 'buyer_phone', label: 'Buyer phone' },
  { name: 'buyer_email', label: 'Buyer email' },
  { name: 'sale_datetime', label: 'Sold at (sale time)', defaultLabel: 'Sold at' },
  { name: 'printed_datetime', label: 'Printed at', defaultLabel: 'Printed at' },
  { name: 'item_number', label: 'Item number', defaultLabel: 'Item #' },
  { name: 'item_description', label: 'Item description' },
  { name: 'sold_price', label: 'Sale price', defaultLabel: 'Sale price' },
  { name: 'seller_amount', label: 'Seller payout', defaultLabel: 'Seller payout' },
  { name: 'commission_amount', label: 'Commission', defaultLabel: 'Commission' },
  { name: 'event_name', label: 'Event name' },
];
