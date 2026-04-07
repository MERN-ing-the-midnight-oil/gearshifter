// Price reduction utilities for displaying on tags and in QR codes

import type { Item, PriceReductionTime } from '../types/models';

/**
 * Get current price based on item and current time
 */
export const getCurrentPrice = (item: Item, currentTime?: Date): number => {
  const now = currentTime || new Date();
  
  if (!item.enablePriceReduction || !item.priceReductionTimes || item.priceReductionTimes.length === 0) {
    return item.originalPrice;
  }

  // Find the most recent price reduction that has occurred
  const sortedReductions = [...item.priceReductionTimes].sort((a, b) => {
    const timeA = parseTime(a.time);
    const timeB = parseTime(b.time);
    return timeB.getTime() - timeA.getTime(); // Sort descending
  });

  for (const reduction of sortedReductions) {
    const reductionTime = parseTime(reduction.time);
    if (now >= reductionTime) {
      // Calculate price based on whether it's a percentage or fixed amount
      if (reduction.isPercentage) {
        // Percentage reduction: price is the percentage off
        const discountAmount = item.originalPrice * (reduction.price / 100);
        return item.originalPrice - discountAmount;
      } else {
        // Fixed amount: price is the final price
        return reduction.price;
      }
    }
  }

  return item.originalPrice;
};

/**
 * Format price reduction times for display on tags
 */
export const formatPriceReductionForTag = (item: Item): string => {
  if (!item.enablePriceReduction || !item.priceReductionTimes || item.priceReductionTimes.length === 0) {
    return '';
  }

  if (item.priceReductionTimes.length === 1) {
    const reduction = item.priceReductionTimes[0];
    const priceStr = formatPrice(reduction.price, item.originalPrice, reduction.isPercentage);
    return `Reduces to ${priceStr} at ${reduction.time}`;
  }

  // Multiple reductions
  const reductions = item.priceReductionTimes
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((r) => {
      const priceStr = formatPrice(r.price, item.originalPrice, r.isPercentage);
      return `${r.time}: ${priceStr}`;
    })
    .join(', ');

  return `Reductions: ${reductions}`;
};

/**
 * Format price reduction schedule (multiple times)
 */
export const formatPriceReductionSchedule = (item: Item): string[] => {
  if (!item.enablePriceReduction || !item.priceReductionTimes || item.priceReductionTimes.length === 0) {
    return [];
  }

  return item.priceReductionTimes
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((reduction) => {
      const priceStr = formatPrice(reduction.price, item.originalPrice, reduction.isPercentage);
      return `${reduction.time} → ${priceStr}`;
    });
};

/**
 * Format price value (handles percentage or fixed amount)
 */
function formatPrice(price: number, originalPrice: number, isPercentage?: boolean): string {
  if (isPercentage) {
    return `${price}% off`;
  }
  return `$${price.toFixed(2)}`;
}

/**
 * Parse time string (HH:MM) to Date object (using today's date)
 */
function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

