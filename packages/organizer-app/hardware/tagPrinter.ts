// Utility functions for printing item tags with QR codes
// Integrates with printer service and QR code generation

import { generateItemQRCode } from 'shared';
import type { Item, Event } from 'shared';
import type { GearTagTemplate } from 'shared';
import { printerService, type PrintOptions } from './printer';

/**
 * Print a tag for an item with QR code.
 * Pass event when available so the label can show reduced price and price_drop_time.
 */
export async function printItemTag(
  item: Item,
  tagTemplate?: GearTagTemplate,
  event?: Event | null
): Promise<boolean> {
  // Generate QR code data for the item
  const qrCodeData = generateItemQRCode(item, tagTemplate);

  const printOptions: PrintOptions = {
    item,
    tagTemplate,
    event,
    qrCodeData,
    includeQRCode: true,
  };

  return await printerService.printTag(printOptions);
}

/**
 * Print multiple tags in batch.
 * Pass event when available so labels can show reduced price and price_drop_time.
 */
export async function printItemTags(
  items: Item[],
  tagTemplate?: GearTagTemplate,
  event?: Event | null
): Promise<{ success: number; failed: number; errors: Array<{ item: Item; error: string }> }> {
  let success = 0;
  let failed = 0;
  const errors: Array<{ item: Item; error: string }> = [];

  for (const item of items) {
    try {
      const result = await printItemTag(item, tagTemplate, event);
      if (result) {
        success++;
      } else {
        failed++;
        const status = printerService.getStatus();
        errors.push({
          item,
          error: status.error || 'Unknown print error',
        });
      }
    } catch (error) {
      failed++;
      errors.push({
        item,
        error: error instanceof Error ? error.message : 'Print failed',
      });
    }
  }

  return { success, failed, errors };
}

