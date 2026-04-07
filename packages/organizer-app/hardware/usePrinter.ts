// React hook for thermal printer functionality
// Provides easy access to printer service with state management

import { useState, useEffect, useCallback } from 'react';
import { printerService, type PrinterDevice, type PrinterStatus, type PrintOptions } from './printer';

export interface UsePrinterReturn {
  status: PrinterStatus;
  devices: PrinterDevice[];
  isScanning: boolean;
  scanForPrinters: () => Promise<void>;
  connect: (device: PrinterDevice) => Promise<boolean>;
  disconnect: () => Promise<void>;
  printTag: (options: PrintOptions) => Promise<boolean>;
  printTest: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for managing thermal printer connection and printing
 */
export function usePrinter(): UsePrinterReturn {
  const [status, setStatus] = useState<PrinterStatus>(printerService.getStatus());
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(printerService.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Scan for available printers
   */
  const scanForPrinters = useCallback(async () => {
    setIsScanning(true);
    try {
      const foundDevices = await printerService.scanForPrinters();
      setDevices(foundDevices);
    } catch (error) {
      console.error('Failed to scan for printers:', error);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * Connect to a printer
   */
  const connect = useCallback(async (device: PrinterDevice): Promise<boolean> => {
    const success = await printerService.connect(device);
    setStatus(printerService.getStatus());
    return success;
  }, []);

  /**
   * Disconnect from current printer
   */
  const disconnect = useCallback(async () => {
    await printerService.disconnect();
    setStatus(printerService.getStatus());
  }, []);

  /**
   * Print a tag for an item
   */
  const printTag = useCallback(async (options: PrintOptions): Promise<boolean> => {
    const success = await printerService.printTag(options);
    setStatus(printerService.getStatus());
    return success;
  }, []);

  /**
   * Print a test page
   */
  const printTest = useCallback(async (): Promise<boolean> => {
    const success = await printerService.printTest();
    setStatus(printerService.getStatus());
    return success;
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
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

