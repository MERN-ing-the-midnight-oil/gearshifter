import type { TagField, TagFieldDataType } from '../types/models';
import { formatDropTime } from './formatters';

/** Field keys that carry list / reduced / effective price on printed gear tags. */
export const TAG_TEMPLATE_PRICE_FIELD_NAMES = ['original_price', 'reduced_price', 'current_price'] as const;
export type TagTemplatePriceFieldName = (typeof TAG_TEMPLATE_PRICE_FIELD_NAMES)[number];

export function isTagTemplatePriceFieldName(field: string): field is TagTemplatePriceFieldName {
  return (TAG_TEMPLATE_PRICE_FIELD_NAMES as readonly string[]).includes(field);
}

/**
 * Canonical list-price key on gear tags; values come from `items.original_price` (seller/staff-entered
 * price persisted on the item), not from freeform custom fields.
 */
export const GEAR_TAG_ITEM_LIST_PRICE_FIELD = 'original_price';

/**
 * Custom tag / QR field keys that look like a selling price but are not wired to stored item pricing
 * (`original_price` / `reduced_price` / `current_price`). Orgs must use those canonical fields so tags
 * always match the item row.
 */
const FORBIDDEN_SHADOW_PRICE_TAG_FIELD_NAMES = new Set([
  'price',
  'list_price',
  'asking_price',
  'item_price',
  'sale_price',
  'amount',
  'tag_price',
  'written_price',
  'retail_price',
  'your_price',
  'sell_price',
]);

export function isForbiddenShadowPriceTagFieldName(field: string): boolean {
  return FORBIDDEN_SHADOW_PRICE_TAG_FIELD_NAMES.has(field.trim().toLowerCase());
}

/** Tag field keys that must be removed before persisting or printing (see {@link isForbiddenShadowPriceTagFieldName}). */
export function collectForbiddenShadowPriceTagFieldNames(tagFields: TagField[]): string[] {
  const names = tagFields
    .map((tf) => tf.field.trim())
    .filter((name) => isForbiddenShadowPriceTagFieldName(name));
  return [...new Set(names)];
}

function stripForbiddenShadowPriceTagFields(
  tagFields: TagField[],
  requiredFields?: string[]
): { tagFields: TagField[]; requiredFields?: string[] } {
  const removedLower = new Set<string>();
  const next = tagFields.filter((tf) => {
    const key = tf.field.trim().toLowerCase();
    if (FORBIDDEN_SHADOW_PRICE_TAG_FIELD_NAMES.has(key)) {
      removedLower.add(key);
      return false;
    }
    return true;
  });
  if (requiredFields === undefined) {
    return { tagFields: next };
  }
  const req =
    removedLower.size === 0
      ? [...requiredFields]
      : requiredFields.filter((r) => !removedLower.has(r.trim().toLowerCase()));
  return { tagFields: next, requiredFields: req };
}

export function defaultTagFieldForItemListPrice(): TagField {
  return {
    field: GEAR_TAG_ITEM_LIST_PRICE_FIELD,
    label: 'Price',
    maxLength: 30,
    fontSize: 10,
    fontWeight: 'normal',
    required: true,
    dataType: 'number',
    format: '$%.2f',
  };
}

/**
 * Ensures every template lists `original_price` so printed tags always use the stored item price.
 * Inserts a default `TagField` after `item_number` when present, otherwise at the front.
 * When `requiredFields` is provided, appends `original_price` if it was missing from the tag and not already listed.
 */
export function ensureGearTagTemplateIncludesItemListPrice(
  tagFields: TagField[],
  requiredFields?: string[]
): { tagFields: TagField[]; requiredFields?: string[] } {
  const has = tagFields.some((tf) => tf.field === GEAR_TAG_ITEM_LIST_PRICE_FIELD);
  if (has) {
    return {
      tagFields,
      ...(requiredFields !== undefined ? { requiredFields: [...requiredFields] } : {}),
    };
  }
  const insert = defaultTagFieldForItemListPrice();
  const itemNumberIdx = tagFields.findIndex((tf) => tf.field === 'item_number');
  const insertAt = itemNumberIdx >= 0 ? itemNumberIdx + 1 : 0;
  const next = [...tagFields.slice(0, insertAt), insert, ...tagFields.slice(insertAt)];
  if (requiredFields !== undefined) {
    const req = requiredFields.includes(GEAR_TAG_ITEM_LIST_PRICE_FIELD)
      ? [...requiredFields]
      : [...requiredFields, GEAR_TAG_ITEM_LIST_PRICE_FIELD];
    return { tagFields: next, requiredFields: req };
  }
  return { tagFields: next };
}

/**
 * Drops shadow “price” tag fields, then ensures `original_price` is present.
 * Use for all template reads/writes so tags never show a second price from `customFields`.
 */
export function sanitizeGearTagTemplatePriceSemantics(
  tagFields: TagField[],
  requiredFields?: string[]
): { tagFields: TagField[]; requiredFields?: string[] } {
  const stripped = stripForbiddenShadowPriceTagFields(tagFields, requiredFields);
  return ensureGearTagTemplateIncludesItemListPrice(
    stripped.tagFields,
    stripped.requiredFields !== undefined ? stripped.requiredFields : requiredFields
  );
}

export interface AutoGearTagPriceItemContext {
  originalPrice?: number | null;
  reducedPrice?: number | null;
  enablePriceReduction?: boolean | null;
}

export interface AutoGearTagPriceEventContext {
  priceDropTime?: string | Date | null;
}

/**
 * Extra ESC/POS text lines so list price and/or reduced price always appear when the item has
 * that data but the template did not include any price field (or those fields had no value).
 * When the template already printed a price field, only the scheduled drop line is appended
 * (same behavior as before) so organizers can show list price in the template and still get
 * the “After …” reduction line automatically.
 */
export function formatAutomaticGearTagPriceLines(
  item: AutoGearTagPriceItemContext,
  event: AutoGearTagPriceEventContext | null | undefined,
  templateEmittedPriceLine: boolean
): string {
  if (templateEmittedPriceLine) {
    if (item.enablePriceReduction && item.reducedPrice != null && event?.priceDropTime != null) {
      const dropTimeStr =
        typeof event.priceDropTime === 'string'
          ? event.priceDropTime
          : event.priceDropTime.toISOString();
      return `After ${formatDropTime(dropTimeStr)}: $${item.reducedPrice.toFixed(2)}\n`;
    }
    return '';
  }

  let out = '';
  const orig = item.originalPrice;
  const reduced = item.reducedPrice;
  const reductionOn = Boolean(item.enablePriceReduction && reduced != null);

  if (orig != null) {
    out += `Price: $${orig.toFixed(2)}\n`;
  }

  if (reductionOn) {
    if (event?.priceDropTime != null) {
      const dropTimeStr =
        typeof event.priceDropTime === 'string'
          ? event.priceDropTime
          : event.priceDropTime.toISOString();
      out += `After ${formatDropTime(dropTimeStr)}: $${reduced!.toFixed(2)}\n`;
    } else {
      out += `Reduced: $${reduced!.toFixed(2)}\n`;
    }
  } else if (orig == null && reduced != null) {
    out += `Price: $${reduced.toFixed(2)}\n`;
  }

  return out;
}

/** Resolved input kind for a tag template field (defaults to text when unset). */
export function resolveTagFieldDataType(tf: Pick<TagField, 'dataType'>): TagFieldDataType {
  const d = tf.dataType;
  if (d === 'text' || d === 'any' || d === 'boolean' || d === 'number' || d === 'integer' || d === 'dropdown') {
    return d;
  }
  return 'text';
}

/** Non-empty dropdown labels from `TagField.dropdownOptions`. */
export function tagFieldDropdownOptions(tf: Pick<TagField, 'dropdownOptions'>): string[] {
  if (!tf.dropdownOptions?.length) return [];
  return tf.dropdownOptions.map((s) => String(s).trim()).filter(Boolean);
}
