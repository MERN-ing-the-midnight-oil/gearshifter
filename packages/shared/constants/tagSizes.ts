// Standard portable printer label sizes
// Common sizes for Brother, DYMO, Zebra, Epson, and other portable printers

export type PrinterTechnology = 'thermal' | 'inkjet' | 'laser' | 'dot-matrix';

export interface TagSizePreset {
  id: string;
  name: string;
  brand: string; // Required brand name
  model?: string; // Optional model name
  technology: PrinterTechnology; // Required printing technology
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
  description?: string;
}

export const TAG_SIZE_PRESETS: TagSizePreset[] = [
  // Brother QL Series
  {
    id: 'brother-62x100',
    name: '62mm x 100mm',
    brand: 'Brother',
    model: 'QL Series',
    technology: 'thermal',
    widthMm: 62,
    heightMm: 100,
    widthInches: 2.44,
    heightInches: 3.94,
    description: 'Standard Brother QL label',
  },
  {
    id: 'brother-62x29',
    name: '62mm x 29mm',
    brand: 'Brother',
    model: 'QL Series',
    technology: 'thermal',
    widthMm: 62,
    heightMm: 29,
    widthInches: 2.44,
    heightInches: 1.14,
    description: 'Compact Brother QL label',
  },
  {
    id: 'brother-29x90',
    name: '29mm x 90mm',
    brand: 'Brother',
    model: 'QL Series',
    technology: 'thermal',
    widthMm: 29,
    heightMm: 90,
    widthInches: 1.14,
    heightInches: 3.54,
    description: 'Narrow Brother QL label',
  },
  {
    id: 'brother-50x80',
    name: '50mm x 80mm',
    brand: 'Brother',
    model: 'QL Series',
    technology: 'thermal',
    widthMm: 50,
    heightMm: 80,
    widthInches: 1.97,
    heightInches: 3.15,
    description: 'Medium Brother QL label',
  },
  
  // DYMO LabelWriter
  {
    id: 'dymo-25x67',
    name: '1" x 2.625"',
    brand: 'DYMO',
    model: 'LabelWriter',
    technology: 'thermal',
    widthMm: 25.4,
    heightMm: 66.7,
    widthInches: 1.0,
    heightInches: 2.625,
    description: 'Standard DYMO address label',
  },
  {
    id: 'dymo-25x89',
    name: '1" x 3.5"',
    brand: 'DYMO',
    model: 'LabelWriter',
    technology: 'thermal',
    widthMm: 25.4,
    heightMm: 88.9,
    widthInches: 1.0,
    heightInches: 3.5,
    description: 'Long DYMO address label',
  },
  {
    id: 'dymo-54x25',
    name: '2.125" x 1"',
    brand: 'DYMO',
    model: 'LabelWriter',
    technology: 'thermal',
    widthMm: 54,
    heightMm: 25.4,
    widthInches: 2.125,
    heightInches: 1.0,
    description: 'Wide DYMO label',
  },
  {
    id: 'dymo-102x38',
    name: '4" x 1.5"',
    brand: 'DYMO',
    model: 'LabelWriter',
    technology: 'thermal',
    widthMm: 102,
    heightMm: 38.1,
    widthInches: 4.0,
    heightInches: 1.5,
    description: 'Large DYMO shipping label',
  },
  
  // Zebra
  {
    id: 'zebra-50x25',
    name: '2" x 1"',
    brand: 'Zebra',
    technology: 'thermal',
    widthMm: 50.8,
    heightMm: 25.4,
    widthInches: 2.0,
    heightInches: 1.0,
    description: 'Standard Zebra label',
  },
  {
    id: 'zebra-102x51',
    name: '4" x 2"',
    brand: 'Zebra',
    technology: 'thermal',
    widthMm: 101.6,
    heightMm: 50.8,
    widthInches: 4.0,
    heightInches: 2.0,
    description: 'Large Zebra label',
  },
  {
    id: 'zebra-102x76',
    name: '4" x 3"',
    brand: 'Zebra',
    technology: 'thermal',
    widthMm: 101.6,
    heightMm: 76.2,
    widthInches: 4.0,
    heightInches: 3.0,
    description: 'Extra large Zebra label',
  },
  
  // Epson
  {
    id: 'epson-62x100',
    name: '62mm x 100mm',
    brand: 'Epson',
    technology: 'thermal',
    widthMm: 62,
    heightMm: 100,
    widthInches: 2.44,
    heightInches: 3.94,
    description: 'Standard Epson label',
  },
  {
    id: 'epson-50x80',
    name: '50mm x 80mm',
    brand: 'Epson',
    technology: 'thermal',
    widthMm: 50,
    heightMm: 80,
    widthInches: 1.97,
    heightInches: 3.15,
    description: 'Medium Epson label',
  },
  
  // Phomemo M110
  {
    id: 'phomemo-20x10',
    name: '20mm x 10mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 20,
    heightMm: 10,
    widthInches: 0.79,
    heightInches: 0.39,
    description: 'Small Phomemo M110 label',
  },
  {
    id: 'phomemo-20x20',
    name: '20mm x 20mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 20,
    heightMm: 20,
    widthInches: 0.79,
    heightInches: 0.79,
    description: 'Square Phomemo M110 label',
  },
  {
    id: 'phomemo-25x15',
    name: '25mm x 15mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 25,
    heightMm: 15,
    widthInches: 0.98,
    heightInches: 0.59,
    description: 'Compact Phomemo M110 label',
  },
  {
    id: 'phomemo-25x30',
    name: '25mm x 30mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 25,
    heightMm: 30,
    widthInches: 0.98,
    heightInches: 1.18,
    description: 'Narrow Phomemo M110 label',
  },
  {
    id: 'phomemo-30x20',
    name: '30mm x 20mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 30,
    heightMm: 20,
    widthInches: 1.18,
    heightInches: 0.79,
    description: 'Wide Phomemo M110 label',
  },
  {
    id: 'phomemo-30x30',
    name: '30mm x 30mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 30,
    heightMm: 30,
    widthInches: 1.18,
    heightInches: 1.18,
    description: 'Square Phomemo M110 label',
  },
  {
    id: 'phomemo-40x20',
    name: '40mm x 20mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 40,
    heightMm: 20,
    widthInches: 1.57,
    heightInches: 0.79,
    description: 'Wide Phomemo M110 label',
  },
  {
    id: 'phomemo-40x30',
    name: '40mm x 30mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 40,
    heightMm: 30,
    widthInches: 1.57,
    heightInches: 1.18,
    description: 'Standard Phomemo M110 label',
  },
  {
    id: 'phomemo-40x40',
    name: '40mm x 40mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 40,
    heightMm: 40,
    widthInches: 1.57,
    heightInches: 1.57,
    description: 'Square Phomemo M110 label',
  },
  {
    id: 'phomemo-50x30',
    name: '50mm x 30mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 50,
    heightMm: 30,
    widthInches: 1.97,
    heightInches: 1.18,
    description: 'Large Phomemo M110 label',
  },
  {
    id: 'phomemo-50x50',
    name: '50mm x 50mm',
    brand: 'Phomemo',
    model: 'M110',
    technology: 'thermal',
    widthMm: 50,
    heightMm: 50,
    widthInches: 1.97,
    heightInches: 1.97,
    description: 'Large square Phomemo M110 label',
  },
  
  // Generic/Common Sizes (for custom printers)
  {
    id: 'standard-50x30',
    name: '50mm x 30mm',
    brand: 'Other',
    technology: 'thermal',
    widthMm: 50,
    heightMm: 30,
    widthInches: 1.97,
    heightInches: 1.18,
    description: 'Common standard size',
  },
  {
    id: 'standard-100x50',
    name: '100mm x 50mm',
    brand: 'Other',
    technology: 'thermal',
    widthMm: 100,
    heightMm: 50,
    widthInches: 3.94,
    heightInches: 1.97,
    description: 'Common large size',
  },
  {
    id: 'standard-80x40',
    name: '80mm x 40mm',
    brand: 'Other',
    technology: 'thermal',
    widthMm: 80,
    heightMm: 40,
    widthInches: 3.15,
    heightInches: 1.57,
    description: 'Common medium size',
  },
];

/**
 * Get tag size presets grouped by brand
 */
export const getTagSizesByBrand = (): Record<string, TagSizePreset[]> => {
  const grouped: Record<string, TagSizePreset[]> = {};

  TAG_SIZE_PRESETS.forEach((preset) => {
    const brand = preset.brand;
    if (!grouped[brand]) {
      grouped[brand] = [];
    }
    grouped[brand].push(preset);
  });

  return grouped;
};

/**
 * Get unique brands with their technology
 */
export interface BrandInfo {
  brand: string;
  technology: PrinterTechnology;
  model?: string;
}

export const getBrands = (): BrandInfo[] => {
  const brandMap = new Map<string, BrandInfo>();

  TAG_SIZE_PRESETS.forEach((preset) => {
    if (!brandMap.has(preset.brand)) {
      brandMap.set(preset.brand, {
        brand: preset.brand,
        technology: preset.technology,
        model: preset.model,
      });
    }
  });

  return Array.from(brandMap.values()).sort((a, b) => a.brand.localeCompare(b.brand));
};

/**
 * Get sizes for a specific brand
 */
export const getSizesByBrand = (brand: string): TagSizePreset[] => {
  return TAG_SIZE_PRESETS.filter((preset) => preset.brand === brand);
};

/**
 * Find a preset by ID
 */
export const getTagSizePreset = (id: string): TagSizePreset | undefined => {
  return TAG_SIZE_PRESETS.find((preset) => preset.id === id);
};








