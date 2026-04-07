# Printer Integration Example

Here's how to integrate the thermal printer into your check-in flow:

## Example: Adding Print Button to Check-In Screen

```typescript
// In your check-in screen (e.g., app/(event)/check-in/index.tsx)
import { usePrinter, printItemTag } from '../../hardware';
import type { Item } from 'shared';

export default function CheckInScreen() {
  const { status: printerStatus } = usePrinter();
  // ... your existing code ...

  const handlePrintTag = async (item: Item) => {
    if (!printerStatus.isConnected) {
      Alert.alert(
        'Printer Not Connected',
        'Please connect to a printer first in Settings',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Dashboard', onPress: () => router.push('/(dashboard)') }
        ]
      );
      return;
    }

    try {
      const success = await printItemTag(item, tagTemplate);
      if (success) {
        Alert.alert('Success', 'Tag printed successfully');
      } else {
        Alert.alert('Error', printerStatus.error || 'Failed to print tag');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Print failed');
    }
  };

  // Add print button to item card
  return (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/(event)/check-in/item-details?itemId=${item.id}`)}
    >
      {/* ... existing item display ... */}
      <TouchableOpacity
        style={styles.printButton}
        onPress={() => handlePrintTag(item)}
        disabled={!printerStatus.isConnected}
      >
        <Text style={styles.printButtonText}>
          {printerStatus.isConnected ? 'Print Tag' : 'Connect Printer'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
```

## Example: Adding Printer Settings to Dashboard

```typescript
// In app/(dashboard)/index.tsx or a settings screen - add PrinterConnection component
import PrinterConnection from '../../components/PrinterConnection';

export default function SettingsScreen() {
  return (
    <ScrollView>
      {/* ... other settings ... */}
      <PrinterConnection />
    </ScrollView>
  );
}
```

## Example: Batch Printing After Check-In

```typescript
import { printItemTags } from '../../hardware';

const handleCheckInComplete = async (items: Item[]) => {
  // After checking in items, print all tags
  const result = await printItemTags(items, tagTemplate);
  
  if (result.failed > 0) {
    Alert.alert(
      'Printing Complete',
      `Printed ${result.success} tags. ${result.failed} failed.`,
      [{ text: 'View Errors', onPress: () => console.log(result.errors) }]
    );
  } else {
    Alert.alert('Success', `Printed ${result.success} tags successfully`);
  }
};
```

