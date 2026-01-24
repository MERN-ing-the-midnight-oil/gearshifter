// Item categories for gear swaps
export const ITEM_CATEGORIES = [
  'bike',
  'bike_part',
  'accessory',
  'clothing',
  'gear',
  'other',
] as const;

export type ItemCategory = typeof ITEM_CATEGORIES[number];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  bike: 'Bike',
  bike_part: 'Bike Part',
  accessory: 'Accessory',
  clothing: 'Clothing',
  gear: 'Gear',
  other: 'Other',
};

