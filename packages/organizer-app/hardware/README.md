# Thermal Printer Integration

This module provides thermal printer support for the organizer app, specifically designed for the **Phomemo M110** and other ESC/POS compatible thermal printers.

## Overview

The printer integration consists of:
- **Printer Service** (`printer.ts`) - Core service for printer communication
- **React Hook** (`usePrinter.ts`) - React hook for easy printer management
- **Tag Printer** (`tagPrinter.ts`) - Utilities for printing item tags with QR codes
- **UI Component** (`../components/PrinterConnection.tsx`) - Ready-to-use printer connection UI

## Setup

### 1. Installation

The `react-native-thermal-printer` package is already installed. However, note that this is a **native module** and requires:

- **Development Build**: You'll need to use `expo-dev-client` or create a custom build (not Expo Go)
- **Bluetooth Permissions**: Already configured in `app.json` for both iOS and Android

### 2. Building the App

Since this uses native modules, you cannot use Expo Go. You need to:

```bash
# Install expo-dev-client if not already installed
yarn add expo-dev-client

# Create a development build
npx expo prebuild
npx expo run:ios  # or run:android
```

## Usage

### Basic Usage with Hook

```typescript
import { usePrinter, printItemTag } from '../hardware';
import type { Item } from 'shared';

function MyComponent() {
  const { status, devices, scanForPrinters, connect, printTag } = usePrinter();

  // Scan for printers
  useEffect(() => {
    scanForPrinters();
  }, []);

  // Connect to a printer
  const handleConnect = async (device) => {
    await connect(device);
  };

  // Print a tag
  const handlePrint = async (item: Item) => {
    await printItemTag(item, tagTemplate);
  };

  return (
    // Your UI
  );
}
```

### Using the Printer Connection Component

```typescript
import PrinterConnection from '../components/PrinterConnection';

function SettingsScreen() {
  return <PrinterConnection />;
}
```

### Printing Item Tags

```typescript
import { printItemTag, printItemTags } from '../hardware';
import type { Item } from 'shared';

// Print a single tag
await printItemTag(item, tagTemplate);

// Print multiple tags
const result = await printItemTags(items, tagTemplate);
console.log(`Printed ${result.success} tags, ${result.failed} failed`);
```

## Phomemo M110 Specific Notes

The Phomemo M110 claims ESC/POS support but may have quirks:

1. **First Try**: Standard ESC/POS commands (current implementation)
2. **If That Fails**: The service includes a fallback for image-based printing
3. **Last Resort**: May need to use `react-native-ble-plx` for raw Bluetooth communication

The current implementation tries standard ESC/POS first. If you encounter issues:

1. Check the printer service error messages
2. Try the test print function to verify basic connectivity
3. If text printing fails, we may need to implement image-based printing

## API Reference

### `printerService`

Main service singleton with methods:
- `scanForPrinters()` - Scan for available Bluetooth printers
- `connect(device)` - Connect to a printer
- `disconnect()` - Disconnect from current printer
- `printTag(options)` - Print a formatted tag
- `printTest()` - Print a test page
- `getStatus()` - Get current printer status

### `usePrinter()` Hook

Returns:
- `status` - Current printer status
- `devices` - List of available printers
- `isScanning` - Whether currently scanning
- `scanForPrinters()` - Scan for printers
- `connect(device)` - Connect to printer
- `disconnect()` - Disconnect from printer
- `printTag(options)` - Print a tag
- `printTest()` - Print test page
- `clearError()` - Clear error state

### `printItemTag(item, tagTemplate?)`

Prints a tag for an item with QR code data.

### `printItemTags(items, tagTemplate?)`

Prints multiple tags in batch, returns success/failure counts.

## Troubleshooting

### Printer Not Found
- Ensure Bluetooth is enabled on device
- Ensure printer is turned on and in pairing mode
- Try scanning again
- Check that printer is within range (typically 10 meters)

### Connection Fails
- Try turning printer off and on
- Unpair and re-pair the printer
- Check that no other app is connected to the printer

### Print Fails
- Verify printer is connected (check status)
- Try test print first
- Check printer paper/ink levels
- If ESC/POS commands fail, may need image-based printing fallback

### Build Issues
- Ensure you're using a development build (not Expo Go)
- Run `npx expo prebuild` to regenerate native code
- Clear build cache: `npx expo start -c`

## Future Enhancements

- [ ] Image-based printing fallback for Phomemo quirks
- [ ] QR code image generation and printing
- [ ] Printer settings persistence
- [ ] Batch printing with progress indicator
- [ ] Support for multiple printer types/configurations

