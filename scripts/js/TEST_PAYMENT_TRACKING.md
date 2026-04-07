# Payment Tracking API Testing Guide

This guide explains how to test the Payment Tracking API functions.

## Prerequisites

1. **Apply the database migration**:
   ```bash
   # Make sure migration 20250202000000_add_paid_at_to_items.sql is applied
   # This adds the paid_at column to the items table
   ```

2. **Set up environment variables**:
   ```bash
   export EXPO_PUBLIC_SUPABASE_URL='your-supabase-url'
   export EXPO_PUBLIC_SUPABASE_ANON_KEY='your-anon-key'
   export SUPABASE_SERVICE_ROLE_KEY='your-service-key'  # Optional, for bypassing RLS
   ```

3. **Have test data ready**:
   - At least one event
   - At least one seller
   - At least one item with status 'sold' (items must be sold before they can be marked as paid)

## Running the Test Script

### Option 1: Using tsx (Recommended)

```bash
npx tsx scripts/js/test-payment-tracking.ts
```

### Option 2: Using ts-node

```bash
npx ts-node scripts/js/test-payment-tracking.ts
```

## What the Test Script Does

The test script performs the following tests:

1. **Setup Test Data**: Finds or creates test data (event, seller, items)
2. **Ensure Items Are Sold**: Marks items as sold if needed (required for payment tracking)
3. **Get Initial Payment Status**: Tests `getSellerPaymentStatus`
4. **Get Unpaid Items**: Tests `getUnpaidItems`
5. **Mark Single Item as Paid**: Tests `markItemAsPaid`
6. **Get Paid Items**: Tests `getPaidItems`
7. **Get Updated Payment Status**: Verifies status updates correctly
8. **Mark All Items as Paid (Bulk)**: Tests `markSellerItemsAsPaid`
9. **Get Event Payment Status**: Tests `getEventPaymentStatus` for all sellers
10. **Error Handling**: Tests that non-sold items cannot be marked as paid

## Manual Testing

You can also test the functions manually in your app or using a Node.js REPL:

### Example: Mark an item as paid

```typescript
import { markItemAsPaid } from './packages/shared/api/payouts';

// Mark a single item as paid
await markItemAsPaid('item-id-here');
```

### Example: Mark all items for a seller as paid

```typescript
import { markSellerItemsAsPaid } from './packages/shared/api/payouts';

// Mark all unpaid sold items for a seller
const result = await markSellerItemsAsPaid('seller-id-here', { 
  eventId: 'event-id-here' // Optional
});
console.log(`Marked ${result.itemsMarked} items as paid`);
```

### Example: Get payment status

```typescript
import { getSellerPaymentStatus } from './packages/shared/api/payouts';

const status = await getSellerPaymentStatus('seller-id-here', { 
  eventId: 'event-id-here' // Optional
});

console.log(`Total items sold: ${status.totalItemsSold}`);
console.log(`Paid items: ${status.paidItemsCount}`);
console.log(`Unpaid items: ${status.unpaidItemsCount}`);
console.log(`Total amount: $${status.totalSoldAmount}`);
console.log(`Paid amount: $${status.paidAmount}`);
console.log(`Unpaid amount: $${status.unpaidAmount}`);
console.log(`Fully paid: ${status.isFullyPaid}`);
```

### Example: Get paid/unpaid items

```typescript
import { getPaidItems, getUnpaidItems } from './packages/shared/api/payouts';

// Get all paid items
const paidItems = await getPaidItems('seller-id-here', { 
  eventId: 'event-id-here' // Optional
});

// Get all unpaid items
const unpaidItems = await getUnpaidItems('seller-id-here', { 
  eventId: 'event-id-here' // Optional
});
```

### Example: Get event payment status

```typescript
import { getEventPaymentStatus } from './packages/shared/api/payouts';

// Get payment status for all sellers in an event
const eventStatus = await getEventPaymentStatus('event-id-here');

eventStatus.forEach(seller => {
  console.log(`Seller ${seller.sellerId}:`);
  console.log(`  Total: ${seller.totalItems} items, $${seller.totalAmount}`);
  console.log(`  Paid: ${seller.paidItems} items, $${seller.paidAmount}`);
  console.log(`  Unpaid: ${seller.unpaidItems} items, $${seller.unpaidAmount}`);
  console.log(`  Fully paid: ${seller.isFullyPaid}`);
});
```

## Testing in the Organizer App

The payment tracking functions are designed to be used in the Pickup Station screen:

1. **Pickup Station** (`packages/organizer-app/app/(event)/pickup/index.tsx`):
   - Scan seller QR code
   - Display sold items with paid/unpaid status
   - Allow marking individual items as paid
   - Allow marking all items for seller as paid (bulk)

2. **Payment Tracking Report** (`packages/organizer-app/app/(event)/reports/payments.tsx`):
   - Use `getEventPaymentStatus` to show all sellers' payment status
   - Filter by paid/unpaid status
   - Export to CSV

## Logging

All payment tracking functions include detailed logging:

- Function entry with parameters
- Success messages with results
- Error messages with context
- State changes (items marked as paid, etc.)

Logs use the format: `[functionName] message { context }`

Example log output:
```
[markItemAsPaid] Starting { itemId: 'abc-123' }
[markItemAsPaid] Marking item as paid { itemId: 'abc-123', paidAt: '2025-02-02T10:30:00Z' }
[markItemAsPaid] Successfully marked item as paid { itemId: 'abc-123', paidAt: '2025-02-02T10:30:00Z' }
```

## Troubleshooting

### Error: "Only sold items can be marked as paid"
- Items must have status 'sold' before they can be marked as paid
- Use the POS station to mark items as sold first
- Or use `updateItemStatus(itemId, 'sold', { soldAt: new Date(), soldPrice: 100 })`

### Error: "Item not found"
- Verify the item ID is correct
- Check that the item exists in the database
- Ensure RLS policies allow you to access the item

### Error: Column "paid_at" does not exist
- The migration `20250202000000_add_paid_at_to_items.sql` has not been applied
- Run: `supabase migration up` or apply the migration manually

### No items showing up in queries
- Verify items have status 'sold'
- Check that seller_id and event_id are correct
- Ensure RLS policies allow you to query the items

## Next Steps

After testing the API functions:

1. **Integrate into Pickup Station**: Use these functions in the pickup screen UI
2. **Add to Reports**: Include payment status in reports
3. **Update Seller Dashboard**: Show paid/unpaid status to sellers
4. **Add Notifications**: Notify sellers when items are marked as paid



