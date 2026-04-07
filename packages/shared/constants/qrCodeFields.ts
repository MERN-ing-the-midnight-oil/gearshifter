// Available fields that can be included in QR code data
// Org users can select which fields to include when QR codes are scanned

export interface QRCodeField {
  name: string;
  label: string;
  description: string;
  category: 'basic' | 'pricing' | 'details' | 'media';
  requiresData?: boolean; // True if field requires actual data to be useful
}

export const AVAILABLE_QR_CODE_FIELDS: QRCodeField[] = [
  // Basic fields
  {
    name: 'item_number',
    label: 'Item Number',
    description: 'Unique item identifier',
    category: 'basic',
  },
  {
    name: 'item_id',
    label: 'Item ID',
    description: 'Internal item ID',
    category: 'basic',
  },
  {
    name: 'category',
    label: 'Category',
    description: 'Item category',
    category: 'basic',
  },
  {
    name: 'description',
    label: 'Description',
    description: 'Item description',
    category: 'basic',
  },
  {
    name: 'size',
    label: 'Size',
    description: 'Item size',
    category: 'basic',
  },
  
  // Pricing fields
  {
    name: 'original_price',
    label: 'Original Price',
    description: 'Original listing price',
    category: 'pricing',
  },
  {
    name: 'reduced_price',
    label: 'Reduced Price',
    description: 'Price after reduction',
    category: 'pricing',
  },
  {
    name: 'current_price',
    label: 'Current Price',
    description: 'Current price (original or reduced based on time)',
    category: 'pricing',
  },
  {
    name: 'price_drop_time',
    label: 'Price Drop Time',
    description: 'When price reduction occurs',
    category: 'pricing',
  },
  {
    name: 'price_reduction_time',
    label: 'Price Reduction Time',
    description: 'Single price reduction time',
    category: 'pricing',
  },
  {
    name: 'price_reduction_times',
    label: 'Price Reduction Schedule',
    description: 'All price reduction times and prices',
    category: 'pricing',
  },
  {
    name: 'enable_price_reduction',
    label: 'Price Reduction Enabled',
    description: 'Whether price reduction is enabled',
    category: 'pricing',
  },
  
  // Details
  {
    name: 'seller_name',
    label: 'Seller Name',
    description: 'Name of the seller',
    category: 'details',
  },
  {
    name: 'status',
    label: 'Status',
    description: 'Item status (pending, for_sale, sold, etc.)',
    category: 'details',
  },
  {
    name: 'donate_if_unsold',
    label: 'Donate if Unsold',
    description: 'Whether item will be donated if not sold',
    category: 'details',
  },
  {
    name: 'checked_in_at',
    label: 'Checked In At',
    description: 'When item was checked in',
    category: 'details',
  },
  
  // Media
  {
    name: 'photos',
    label: 'Photos',
    description: 'Item photos/images',
    category: 'media',
  },
  {
    name: 'photo_urls',
    label: 'Photo URLs',
    description: 'URLs to item photos',
    category: 'media',
  },
];

/**
 * Get QR code fields grouped by category
 */
export const getQRCodeFieldsByCategory = (): Record<string, QRCodeField[]> => {
  const grouped: Record<string, QRCodeField[]> = {
    basic: [],
    pricing: [],
    details: [],
    media: [],
  };

  AVAILABLE_QR_CODE_FIELDS.forEach((field) => {
    grouped[field.category].push(field);
  });

  return grouped;
};

/**
 * Get field by name
 */
export const getQRCodeField = (name: string): QRCodeField | undefined => {
  return AVAILABLE_QR_CODE_FIELDS.find((f) => f.name === name);
};

