"use strict";
// Utility functions for printing item tags with QR codes
// Integrates with printer service and QR code generation
Object.defineProperty(exports, "__esModule", { value: true });
exports.printItemTag = printItemTag;
exports.printItemTags = printItemTags;
const shared_1 = require("shared");
const printer_1 = require("./printer");
/**
 * Print a tag for an item with QR code
 * This is the main function to use when printing tags
 */
async function printItemTag(item, tagTemplate) {
    // Generate QR code data for the item
    const qrCodeData = (0, shared_1.generateItemQRCode)(item, tagTemplate);
    const printOptions = {
        item,
        tagTemplate,
        qrCodeData,
        includeQRCode: true,
    };
    return await printer_1.printerService.printTag(printOptions);
}
/**
 * Print multiple tags in batch
 */
async function printItemTags(items, tagTemplate) {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const item of items) {
        try {
            const result = await printItemTag(item, tagTemplate);
            if (result) {
                success++;
            }
            else {
                failed++;
                const status = printer_1.printerService.getStatus();
                errors.push({
                    item,
                    error: status.error || 'Unknown print error',
                });
            }
        }
        catch (error) {
            failed++;
            errors.push({
                item,
                error: error instanceof Error ? error.message : 'Print failed',
            });
        }
    }
    return { success, failed, errors };
}
