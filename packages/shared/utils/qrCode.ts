// QR Code utilities for gear swap app
// QR codes on sticker tags contain item information for org users and optionally sellers to scan

import { QR_CODE_PREFIX } from '../constants/config';
import type { Item } from '../types/models';
import type { GearTagTemplate } from '../types/models';

/** Organizer app scheme (see packages/organizer-app/app.json). */
export const ORGANIZER_APP_SCHEME = 'organizer';

/**
 * Path segment (no leading slash) for Expo Router route `/(event)/check-in/item-details`.
 * Groups like `(event)` are omitted from the public URL.
 */
export const ORGANIZER_ITEM_CHECKIN_PATH = 'check-in/item-details';

/**
 * Deep link for org staff to open a pre-registered item in the Organizer app (check-in item screen).
 * Stored on `items.qr_code` so the same payload works for manual entry, camera scan, and POS item lookup.
 */
export function buildOrganizerItemDeepLink(
  eventId: string,
  itemId: string,
  sellerId?: string
): string {
  const params = new URLSearchParams({ itemId, eventId });
  if (sellerId) params.set('sellerId', sellerId);
  return `${ORGANIZER_APP_SCHEME}://${ORGANIZER_ITEM_CHECKIN_PATH}?${params.toString()}`;
}

/**
 * When users paste from docs or email, the line may include a label before the URL.
 * Pull out an organizer item deep link so parsing still works.
 */
export function extractOrganizerItemDeepLinkFromText(raw: string): string {
  const t = raw.trim();
  if (!t) return t;

  const org = t.match(/organizer:\/\/[^\s<>"']+/);
  if (org) return org[0].replace(/[),.;]+$/, '');

  const http = t.match(/https?:\/\/[^\s<>"']+/g);
  if (http) {
    const hit = http.find((u) => u.includes('item-details'));
    if (hit) return hit.replace(/[),.;]+$/, '');
  }

  return t;
}

/**
 * Parse organizer item deep link from QR (custom scheme or https).
 */
export function parseOrganizerItemDeepLink(
  qr: string
): { itemId: string; eventId?: string; sellerId?: string } | null {
  const t = extractOrganizerItemDeepLinkFromText(qr).trim();
  if (!t) return null;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t)) {
    const schemeEnd = t.indexOf('://');
    const rest = t.slice(schemeEnd + 3);
    const qIdx = rest.indexOf('?');
    const path = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
    const query = qIdx >= 0 ? rest.slice(qIdx + 1) : '';
    if (!path.includes('item-details')) return null;
    const params = new URLSearchParams(query);
    const itemId = params.get('itemId');
    if (!itemId) return null;
    return {
      itemId,
      eventId: params.get('eventId') || undefined,
      sellerId: params.get('sellerId') || undefined,
    };
  }

  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const u = new URL(t);
      if (!u.pathname.includes('item-details')) return null;
      const itemId = u.searchParams.get('itemId');
      if (!itemId) return null;
      return {
        itemId,
        eventId: u.searchParams.get('eventId') || undefined,
        sellerId: u.searchParams.get('sellerId') || undefined,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Generate QR code data for an item
 * Can include configured data fields based on tag template
 * Format: JSON string with itemId and selected fields
 */
export const generateItemQRCode = (
  item: Item,
  tagTemplate?: GearTagTemplate
): string => {
  // Base QR code data - always includes item ID
  const qrData: Record<string, unknown> = {
    itemId: item.id,
    itemNumber: item.itemNumber,
  };

  // Add configured fields from tag template if provided
  if (tagTemplate && tagTemplate.qrCodeDataFields) {
    tagTemplate.qrCodeDataFields.forEach((fieldName) => {
      switch (fieldName) {
        case 'item_id':
          qrData.itemId = item.id;
          break;
        case 'item_number':
          qrData.itemNumber = item.itemNumber;
          break;
        case 'category':
          qrData.category = item.category || item.categoryId;
          break;
        case 'description':
          qrData.description = item.description;
          break;
        case 'size':
          qrData.size = item.size;
          break;
        case 'original_price':
          qrData.originalPrice = item.originalPrice;
          break;
        case 'reduced_price':
          qrData.reducedPrice = item.reducedPrice;
          break;
        case 'current_price':
          // Calculate current price based on time
          qrData.currentPrice = getCurrentPrice(item);
          break;
        case 'price_drop_time':
          // Get from price reduction times or event settings
          if (item.priceReductionTimes && item.priceReductionTimes.length > 0) {
            qrData.priceDropTime = item.priceReductionTimes[0].time;
          }
          break;
        case 'price_reduction_times':
          qrData.priceReductionTimes = item.priceReductionTimes;
          break;
        case 'price_reduction_time':
          // Single time from first reduction
          if (item.priceReductionTimes && item.priceReductionTimes.length > 0) {
            qrData.priceReductionTime = item.priceReductionTimes[0].time;
          }
          break;
        case 'enable_price_reduction':
          qrData.enablePriceReduction = item.enablePriceReduction;
          break;
        case 'status':
          qrData.status = item.status;
          break;
        case 'donate_if_unsold':
          qrData.donateIfUnsold = item.donateIfUnsold;
          break;
        case 'checked_in_at':
          qrData.checkedInAt = item.checkedInAt;
          break;
        // Custom fields
        default:
          if (item.customFields && item.customFields[fieldName] !== undefined) {
            qrData[fieldName] = item.customFields[fieldName];
          }
          break;
      }
    });
  }

  // Return as JSON string (QR codes can handle JSON)
  return JSON.stringify(qrData);
};

/**
 * Generate QR code data for seller access (limited fields)
 */
export const generateItemQRCodeForSeller = (
  item: Item,
  tagTemplate?: GearTagTemplate
): string | null => {
  if (!tagTemplate || !tagTemplate.qrCodeSellerAccess || tagTemplate.qrCodeSellerAccess.length === 0) {
    return null; // Sellers don't have access
  }

  const qrData: Record<string, unknown> = {
    itemId: item.id,
    itemNumber: item.itemNumber,
  };

  // Only include fields allowed for sellers
  tagTemplate.qrCodeSellerAccess.forEach((fieldName) => {
    switch (fieldName) {
      case 'item_number':
        qrData.itemNumber = item.itemNumber;
        break;
      case 'original_price':
        qrData.originalPrice = item.originalPrice;
        break;
      case 'reduced_price':
        qrData.reducedPrice = item.reducedPrice;
        break;
      case 'current_price':
        qrData.currentPrice = getCurrentPrice(item);
        break;
      case 'price_drop_time':
        qrData.priceDropTime = null;
        break;
      case 'photos':
      case 'photo_urls':
        // Would need to get from item photos if available
        qrData.photos = [];
        break;
      // Add other seller-accessible fields
      default:
        if (item.customFields && item.customFields[fieldName] !== undefined) {
          qrData[fieldName] = item.customFields[fieldName];
        }
        break;
    }
  });

  return JSON.stringify(qrData);
};

/**
 * Get current price based on item and time
 */
function getCurrentPrice(item: Item): number {
  // If price reduction is enabled and time has passed, return reduced price
  // Otherwise return original price
  // This is a simplified version - actual implementation would check event priceDropTime
  if (item.enablePriceReduction && item.reducedPrice) {
    // TODO: Check if price drop time has passed
    return item.reducedPrice;
  }
  return item.originalPrice;
}

/**
 * Parse QR code data (can be JSON or legacy format)
 * Returns parsed data object or null if invalid
 */
export const parseItemQRCode = (qrCodeData: string): { itemId: string; data?: Record<string, unknown> } | null => {
  const fromLink = parseOrganizerItemDeepLink(qrCodeData);
  if (fromLink) {
    const data: Record<string, unknown> = {};
    if (fromLink.eventId) data.eventId = fromLink.eventId;
    if (fromLink.sellerId) data.sellerId = fromLink.sellerId;
    return { itemId: fromLink.itemId, data: Object.keys(data).length ? data : undefined };
  }

  try {
    // Try to parse as JSON first (new format)
    const parsed = JSON.parse(qrCodeData);
    if (parsed.itemId) {
      return parsed;
    }
  } catch {
    // Not JSON, try legacy format
    const prefix = `${QR_CODE_PREFIX.ITEM}-`;
    if (qrCodeData.startsWith(prefix)) {
      return {
        itemId: qrCodeData.substring(prefix.length),
      };
    }
  }
  return null;
};

/**
 * Generate QR code data for a seller
 * Format: SELLER-{sellerId}
 */
export const generateSellerQRCode = (sellerId: string): string => {
  return `${QR_CODE_PREFIX.SELLER}-${sellerId}`;
};

/**
 * Parse QR code data to extract seller ID
 * Returns null if QR code format is invalid
 */
export const parseSellerQRCode = (qrCodeData: string): string | null => {
  const prefix = `${QR_CODE_PREFIX.SELLER}-`;
  if (qrCodeData.startsWith(prefix)) {
    return qrCodeData.substring(prefix.length);
  }
  return null;
};

/**
 * Check if QR code is for an item
 * Handles both JSON format and legacy format
 */
export const isItemQRCode = (qrCodeData: string): boolean => {
  if (parseOrganizerItemDeepLink(qrCodeData)) return true;
  // Check legacy format
  if (qrCodeData.startsWith(`${QR_CODE_PREFIX.ITEM}-`)) {
    return true;
  }
  // Check JSON format
  try {
    const parsed = JSON.parse(qrCodeData);
    return parsed.itemId !== undefined;
  } catch {
    return false;
  }
};

/**
 * Check if QR code is for a seller
 */
export const isSellerQRCode = (qrCodeData: string): boolean => {
  return qrCodeData.startsWith(`${QR_CODE_PREFIX.SELLER}-`);
};

/**
 * Get QR code type (item or seller)
 */
export const getQRCodeType = (qrCodeData: string): 'item' | 'seller' | 'unknown' => {
  if (isItemQRCode(qrCodeData)) return 'item';
  if (isSellerQRCode(qrCodeData)) return 'seller';
  return 'unknown';
};

/**
 * Extract data from QR code for org users (full access)
 */
export const getQRCodeDataForOrg = (qrCodeData: string): Record<string, unknown> | null => {
  const parsed = parseItemQRCode(qrCodeData);
  if (!parsed) return null;
  return parsed as Record<string, unknown>;
};

/**
 * Extract data from QR code for sellers (limited access based on template)
 */
export const getQRCodeDataForSeller = (
  qrCodeData: string,
  tagTemplate?: GearTagTemplate
): Record<string, unknown> | null => {
  if (!tagTemplate || !tagTemplate.qrCodeSellerAccess || tagTemplate.qrCodeSellerAccess.length === 0) {
    return null; // No seller access
  }

  const fullData = getQRCodeDataForOrg(qrCodeData);
  if (!fullData) return null;

  // Filter to only include seller-accessible fields
  const sellerData: Record<string, unknown> = {
    itemId: fullData.itemId,
    itemNumber: fullData.itemNumber,
  };

  tagTemplate.qrCodeSellerAccess.forEach((fieldName) => {
    if (fullData[fieldName] !== undefined) {
      sellerData[fieldName] = fullData[fieldName];
    }
  });

  return sellerData;
};

