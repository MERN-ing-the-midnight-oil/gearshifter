"use strict";
// Thermal printer service for Phomemo M110 and other ESC/POS compatible printers
// This service wraps react-native-thermal-printer with Phomemo-specific handling
//
// Phomemo M110 Specifications:
// - Resolution: 203 DPI (8 dots per mm)
// - Paper width: 58mm (standard)
// - ESC/POS compatible
// - Supports absolute positioning via ESC $ command
//
// NOTE: react-native-thermal-printer API may vary. If you encounter issues:
// 1. Check the actual package documentation for method names
// 2. Common methods: getBluetoothDeviceList, connectBluetooth, printText, cutPaper
// 3. Phomemo M110 may require image-based printing fallback for QR codes (see printQRCodeAsImage)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printerService = void 0;
const react_native_thermal_printer_1 = __importDefault(require("react-native-thermal-printer"));
class PrinterService {
    currentDevice = null;
    isPrinting = false;
    error = null;
    /**
     * Scan for available Bluetooth printers
     */
    async scanForPrinters() {
        try {
            const devices = await react_native_thermal_printer_1.default.getBluetoothDeviceList();
            return devices.map((device) => ({
                id: device.address || device.id,
                name: device.name || 'Unknown Printer',
                address: device.address || device.id,
                isConnected: false,
            }));
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : 'Failed to scan for printers';
            console.error('Printer scan error:', err);
            return [];
        }
    }
    /**
     * Connect to a printer device
     */
    async connect(device) {
        try {
            this.error = null;
            const success = await react_native_thermal_printer_1.default.connectBluetooth(device.address);
            if (success) {
                this.currentDevice = { ...device, isConnected: true };
                return true;
            }
            else {
                this.error = 'Failed to connect to printer';
                return false;
            }
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : 'Connection failed';
            console.error('Printer connection error:', err);
            return false;
        }
    }
    /**
     * Disconnect from current printer
     */
    async disconnect() {
        try {
            if (this.currentDevice) {
                await react_native_thermal_printer_1.default.disconnectBluetooth();
                this.currentDevice = null;
            }
        }
        catch (err) {
            console.error('Printer disconnect error:', err);
        }
    }
    /**
     * Get current printer status
     */
    getStatus() {
        return {
            isConnected: this.currentDevice?.isConnected || false,
            currentDevice: this.currentDevice,
            isPrinting: this.isPrinting,
            error: this.error,
        };
    }
    /**
     * Print a formatted tag for an item
     * This method formats the tag according to the template and prints it
     */
    async printTag(options) {
        if (!this.currentDevice?.isConnected) {
            this.error = 'No printer connected';
            return false;
        }
        if (this.isPrinting) {
            this.error = 'Print job already in progress';
            return false;
        }
        try {
            this.isPrinting = true;
            this.error = null;
            // Format the tag content
            const tagContent = this.formatTagContent(options);
            // Print using ESC/POS commands
            // Note: Phomemo M110 may have quirks, so we try standard ESC/POS first
            await react_native_thermal_printer_1.default.printText(tagContent);
            // Cut paper (ESC/POS command)
            await react_native_thermal_printer_1.default.cutPaper();
            this.isPrinting = false;
            return true;
        }
        catch (err) {
            this.isPrinting = false;
            this.error = err instanceof Error ? err.message : 'Print failed';
            console.error('Print error:', err);
            // If standard ESC/POS fails, we might need to try image-based printing
            // This would be a fallback for Phomemo quirks
            return false;
        }
    }
    /**
     * Format tag content based on template and item data
     * Uses absolute positioning for Phomemo M110 and other ESC/POS printers
     */
    formatTagContent(options) {
        const { item, tagTemplate, qrCodeData } = options;
        const template = tagTemplate;
        let content = '';
        // Initialize printer (ESC/POS commands)
        content += '\x1B\x40'; // ESC @ - Initialize printer
        // Set character spacing and line spacing for better control
        content += '\x1B\x20\x00'; // ESC SP 0 - Set character spacing to 0
        content += '\x1B\x33\x18'; // ESC 3 24 - Set line spacing to 24 dots (3mm)
        // If we have a template with tag fields, use flow layout (fields in array order, word wrap)
        if (template?.tagFields && template.tagFields.length > 0) {
            // Use array order - no position sorting
            const fields = template.tagFields;
            fields.forEach((field) => {
                const value = this.getFieldValue(item, field.field);
                if (value !== null && value !== undefined) {
                    const label = field.label || field.field;
                    const formattedValue = this.formatFieldValue(value, field.format);
                    let fieldText = `${label}: ${formattedValue}`;
                    // Truncate if maxLength specified
                    const maxLen = field.maxLength ?? 50;
                    if (fieldText.length > maxLen) {
                        fieldText = fieldText.substring(0, maxLen - 3) + '...';
                    }
                    // Set font size if specified
                    if (field.fontSize) {
                        let sizeByte = 0;
                        if (field.fontSize >= 16) {
                            sizeByte = 0x11; // Double width and height
                        }
                        else if (field.fontSize >= 12) {
                            sizeByte = 0x10; // Double height only
                        }
                        if (sizeByte > 0) {
                            content += `\x1B\x21${String.fromCharCode(sizeByte)}`;
                        }
                    }
                    // Set font weight
                    if (field.fontWeight === 'bold') {
                        content += '\x1B\x45\x01'; // ESC E 1 - Bold on
                    }
                    // Print the field text (flows left to right, top to bottom)
                    content += fieldText;
                    // Reset formatting
                    if (field.fontWeight === 'bold') {
                        content += '\x1B\x45\x00'; // ESC E 0 - Bold off
                    }
                    if (field.fontSize && field.fontSize >= 12) {
                        content += '\x1B\x21\x00'; // ESC ! 0 - Normal size
                    }
                    // Move to next line after field
                    content += '\n';
                }
            });
            // Add QR code at specified position if enabled
            if (template.qrCodeEnabled && qrCodeData) {
                const DOTS_PER_MM = 8;
                const qrSize = template.qrCodeSize || 15;
                // Calculate QR code position
                let qrX = 0;
                let qrY = 0;
                switch (template.qrCodePosition) {
                    case 'top-left':
                        qrX = 5 * DOTS_PER_MM;
                        qrY = 5 * DOTS_PER_MM;
                        break;
                    case 'top-right':
                        qrX = Math.round((template.widthMm - qrSize - 5) * DOTS_PER_MM);
                        qrY = 5 * DOTS_PER_MM;
                        break;
                    case 'bottom-left':
                        qrX = 5 * DOTS_PER_MM;
                        qrY = Math.round((template.heightMm - qrSize - 5) * DOTS_PER_MM);
                        break;
                    case 'bottom-right':
                        qrX = Math.round((template.widthMm - qrSize - 5) * DOTS_PER_MM);
                        qrY = Math.round((template.heightMm - qrSize - 5) * DOTS_PER_MM);
                        break;
                    case 'center':
                        qrX = Math.round((template.widthMm - qrSize) / 2 * DOTS_PER_MM);
                        qrY = Math.round((template.heightMm - qrSize) / 2 * DOTS_PER_MM);
                        break;
                }
                // Position for QR code
                const qrNL = qrX & 0xFF;
                const qrNH = (qrX >> 8) & 0xFF;
                content += `\x1B\x24${String.fromCharCode(qrNL)}${String.fromCharCode(qrNH)}`;
                // Print QR code placeholder (actual QR code printing would use ESC/POS QR commands)
                // For now, we'll print a text representation
                content += `\n[QR: ${qrCodeData.substring(0, 20)}...]\n`;
            }
        }
        else {
            // Fallback: Sequential layout if no template or no positioned fields
            content += '\x1B\x61\x01'; // ESC a 1 - Center align
            // Print header/title if template has one
            if (template?.name) {
                content += `\x1B\x45\x01`; // ESC E 1 - Bold on
                content += `${template.name}\n`;
                content += `\x1B\x45\x00`; // ESC E 0 - Bold off
            }
            // Print item number (always include)
            content += '\x1B\x61\x00'; // ESC a 0 - Left align
            content += `\x1B\x45\x01`; // Bold
            content += `Item #: ${item.itemNumber}\n`;
            content += `\x1B\x45\x00`; // Bold off
            // Default fields if no template
            if (item.description) {
                content += `Description: ${item.description}\n`;
            }
            if (item.originalPrice) {
                content += `Price: $${item.originalPrice.toFixed(2)}\n`;
            }
            if (item.size) {
                content += `Size: ${item.size}\n`;
            }
            // Add QR code data if provided
            if (qrCodeData) {
                content += '\n';
                content += 'QR Code Data:\n';
                content += qrCodeData.substring(0, 30) + '...\n';
            }
        }
        // Reset to default settings
        content += '\x1B\x61\x00'; // Left align
        content += '\x1B\x21\x00'; // Normal size
        content += '\x1B\x45\x00'; // Normal weight
        return content;
    }
    /**
     * Get field value from item
     */
    getFieldValue(item, fieldName) {
        switch (fieldName) {
            case 'item_number':
                return item.itemNumber;
            case 'description':
                return item.description || item.customFields?.description || '';
            case 'size':
                return item.size || item.customFields?.size || '';
            case 'original_price':
                return item.originalPrice;
            case 'reduced_price':
                return item.reducedPrice || null;
            case 'current_price':
                return item.reducedPrice || item.originalPrice;
            case 'category':
                return item.category || item.customFields?.category || '';
            case 'status':
                return item.status;
            default:
                // Check custom fields
                if (item.customFields && item.customFields[fieldName] !== undefined) {
                    return item.customFields[fieldName];
                }
                return null;
        }
    }
    /**
     * Format field value according to format string
     */
    formatFieldValue(value, format) {
        if (value === null || value === undefined) {
            return '';
        }
        if (format) {
            // Simple format string support (e.g., "$%.2f" for price)
            if (format.includes('$') && typeof value === 'number') {
                return `$${value.toFixed(2)}`;
            }
            if (format.includes('%') && typeof value === 'number') {
                return `${value}%`;
            }
        }
        return String(value);
    }
    /**
     * Print QR code as image (fallback for Phomemo quirks)
     * This would be used if standard ESC/POS QR code commands don't work
     */
    async printQRCodeAsImage(qrCodeImageBase64) {
        if (!this.currentDevice?.isConnected) {
            this.error = 'No printer connected';
            return false;
        }
        try {
            // Convert base64 to buffer and print as image
            // This is a workaround for Phomemo's non-standard ESC/POS implementation
            await react_native_thermal_printer_1.default.printImageBase64(qrCodeImageBase64);
            return true;
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : 'QR code print failed';
            console.error('QR code print error:', err);
            return false;
        }
    }
    /**
     * Test print - prints a test page
     */
    async printTest() {
        if (!this.currentDevice?.isConnected) {
            this.error = 'No printer connected';
            return false;
        }
        try {
            this.isPrinting = true;
            this.error = null;
            let content = '';
            content += '\x1B\x40'; // Initialize
            content += '\x1B\x61\x01'; // Center align
            content += '\x1B\x45\x01'; // Bold
            content += 'TEST PRINT\n';
            content += '\x1B\x45\x00'; // Bold off
            content += '\x1B\x61\x00'; // Left align
            content += 'Printer: ' + (this.currentDevice.name || 'Unknown') + '\n';
            content += 'Date: ' + new Date().toLocaleString() + '\n';
            content += '─'.repeat(32) + '\n';
            content += 'If you can read this, the printer is working correctly.\n';
            await react_native_thermal_printer_1.default.printText(content);
            await react_native_thermal_printer_1.default.cutPaper();
            this.isPrinting = false;
            return true;
        }
        catch (err) {
            this.isPrinting = false;
            this.error = err instanceof Error ? err.message : 'Test print failed';
            console.error('Test print error:', err);
            return false;
        }
    }
}
// Export singleton instance
exports.printerService = new PrinterService();
