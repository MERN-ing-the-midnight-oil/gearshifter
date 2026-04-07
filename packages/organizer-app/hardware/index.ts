// Thermal printer hardware module exports
// Provides printer service, hooks, and utilities for Phomemo M110 and other ESC/POS printers

export { printerService } from './printer';
export { usePrinter } from './usePrinter';
export { printItemTag, printItemTags } from './tagPrinter';
export type {
  PrinterDevice,
  PrinterStatus,
  PrintOptions,
} from './printer';
export type { UsePrinterReturn } from './usePrinter';

