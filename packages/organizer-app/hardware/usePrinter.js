"use strict";
// React hook for thermal printer functionality
// Provides easy access to printer service with state management
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrinter = usePrinter;
const react_1 = require("react");
const printer_1 = require("./printer");
/**
 * Hook for managing thermal printer connection and printing
 */
function usePrinter() {
    const [status, setStatus] = (0, react_1.useState)(printer_1.printerService.getStatus());
    const [devices, setDevices] = (0, react_1.useState)([]);
    const [isScanning, setIsScanning] = (0, react_1.useState)(false);
    // Update status periodically
    (0, react_1.useEffect)(() => {
        const interval = setInterval(() => {
            setStatus(printer_1.printerService.getStatus());
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    /**
     * Scan for available printers
     */
    const scanForPrinters = (0, react_1.useCallback)(async () => {
        setIsScanning(true);
        try {
            const foundDevices = await printer_1.printerService.scanForPrinters();
            setDevices(foundDevices);
        }
        catch (error) {
            console.error('Failed to scan for printers:', error);
        }
        finally {
            setIsScanning(false);
        }
    }, []);
    /**
     * Connect to a printer
     */
    const connect = (0, react_1.useCallback)(async (device) => {
        const success = await printer_1.printerService.connect(device);
        setStatus(printer_1.printerService.getStatus());
        return success;
    }, []);
    /**
     * Disconnect from current printer
     */
    const disconnect = (0, react_1.useCallback)(async () => {
        await printer_1.printerService.disconnect();
        setStatus(printer_1.printerService.getStatus());
    }, []);
    /**
     * Print a tag for an item
     */
    const printTag = (0, react_1.useCallback)(async (options) => {
        const success = await printer_1.printerService.printTag(options);
        setStatus(printer_1.printerService.getStatus());
        return success;
    }, []);
    /**
     * Print a test page
     */
    const printTest = (0, react_1.useCallback)(async () => {
        const success = await printer_1.printerService.printTest();
        setStatus(printer_1.printerService.getStatus());
        return success;
    }, []);
    /**
     * Clear error state
     */
    const clearError = (0, react_1.useCallback)(() => {
        setStatus((prev) => ({ ...prev, error: null }));
    }, []);
    return {
        status,
        devices,
        isScanning,
        scanForPrinters,
        connect,
        disconnect,
        printTag,
        printTest,
        clearError,
    };
}
