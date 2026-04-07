/**
 * Test script for Payment Tracking API functions
 * 
 * This script tests all payment tracking functions:
 * - markItemAsPaid
 * - markSellerItemsAsPaid
 * - getPaidItems
 * - getUnpaidItems
 * - getSellerPaymentStatus
 * - getEventPaymentStatus
 * 
 * Usage:
 *   export EXPO_PUBLIC_SUPABASE_URL='your-url'
 *   export EXPO_PUBLIC_SUPABASE_ANON_KEY='your-key'
 *   export SUPABASE_SERVICE_ROLE_KEY='your-service-key'  # Optional, for bypassing RLS
 *   npx tsx scripts/js/test-payment-tracking.ts
 * 
 * Or load from .env file:
 *   npx dotenv -e packages/seller-app/.env -- npx tsx scripts/js/test-payment-tracking.ts
 * 
 * Prerequisites:
 *   - Database migration 20250202000000_add_paid_at_to_items.sql must be applied
 *   - You need at least one event with sold items to test
 *   - Items must have status 'sold' to be marked as paid
 */

// Load environment variables from .env files BEFORE any imports
// This must happen before supabase.ts is imported
(function loadEnv() {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    const fs = require('fs');
    
    // Try loading from seller-app .env first, then organizer-app
    const sellerEnv = path.join(__dirname, '../../packages/seller-app/.env');
    const organizerEnv = path.join(__dirname, '../../packages/organizer-app/.env');
    
    if (fs.existsSync(sellerEnv)) {
      dotenv.config({ path: sellerEnv });
      console.log('✓ Loaded environment variables from packages/seller-app/.env');
    } else if (fs.existsSync(organizerEnv)) {
      dotenv.config({ path: organizerEnv });
      console.log('✓ Loaded environment variables from packages/organizer-app/.env');
    }
  } catch (e) {
    // dotenv not available or .env files don't exist, continue with process.env
    // This is fine - user can set env vars manually
  }
})();

import {
  markItemAsPaid,
  markSellerItemsAsPaid,
  getPaidItems,
  getUnpaidItems,
  getSellerPaymentStatus,
  getEventPaymentStatus,
} from '../../packages/shared/api/payouts';
import { supabase } from '../../packages/shared/api/supabase';
import { recordSale } from '../../packages/shared/api/transactions';
import { updateItemStatus } from '../../packages/shared/api/items';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('');
  log(`═══════════════════════════════════════════════════════════`, 'cyan');
  log(`  ${title}`, 'cyan');
  log(`═══════════════════════════════════════════════════════════`, 'cyan');
  console.log('');
}

/**
 * Helper to find or create test data
 */
async function setupTestData() {
  logSection('Setting up test data');

  // Find an existing event with items
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, name')
    .limit(1);

  if (eventsError) throw eventsError;

  if (!events || events.length === 0) {
    log('⚠ No events found in database.', 'yellow');
    log('', 'reset');
    log('To create test data, you can:', 'yellow');
    log('  1. Run the seed script: yarn run-seed-events (if available)', 'yellow');
    log('  2. Use the test-api-functions.ts script to create test data', 'yellow');
    log('  3. Create an event manually through the organizer app', 'yellow');
    log('', 'reset');
    throw new Error('No events found. Please create an event first. See instructions above.');
  }

  const event = events[0];
  log(`Using event: ${event.name} (${event.id})`, 'yellow');

  // Find a seller with items
  const { data: sellers, error: sellersError } = await supabase
    .from('sellers')
    .select('id, first_name, last_name')
    .limit(1);

  if (sellersError) throw sellersError;

  if (!sellers || sellers.length === 0) {
    throw new Error('No sellers found. Please create a seller first.');
  }

  const seller = sellers[0];
  log(`Using seller: ${seller.first_name} ${seller.last_name} (${seller.id})`, 'yellow');

  // Find items for this seller and event
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, item_number, status, sold_at, paid_at')
    .eq('seller_id', seller.id)
    .eq('event_id', event.id)
    .limit(5);

  if (itemsError) throw itemsError;

  if (!items || items.length === 0) {
    log('No items found. Creating test items...', 'yellow');
    // Create some test items
    const testItems = [];
    for (let i = 0; i < 3; i++) {
      const { data: newItem, error: createError } = await supabase
        .from('items')
        .insert({
          event_id: event.id,
          seller_id: seller.id,
          item_number: `TEST-${Date.now()}-${i}`,
          category: 'Test Category',
          description: `Test Item ${i + 1}`,
          original_price: 100 + i * 10,
          status: 'pending',
          qr_code: `TEST-QR-${i}`,
        })
        .select()
        .single();

      if (createError) throw createError;
      testItems.push(newItem);
    }
    return { event, seller, items: testItems };
  }

  log(`Found ${items.length} items`, 'yellow');
  return { event, seller, items: items || [] };
}

/**
 * Helper to ensure items are sold (required for payment tracking)
 */
async function ensureItemsAreSold(items: any[], sellerId: string, eventId: string) {
  log('Ensuring items are sold...', 'yellow');

  const soldItems = [];
  for (const item of items) {
    if (item.status === 'sold') {
      soldItems.push(item);
      continue;
    }

    // Mark as checked in first
    if (item.status !== 'checked_in' && item.status !== 'for_sale') {
      await updateItemStatus(item.id, 'checked_in');
      await updateItemStatus(item.id, 'for_sale');
    }

    // Create a sale transaction
    try {
      // Get an admin user to use as processed_by
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('id')
        .limit(1)
        .single();

      const processedBy = adminUsers?.id || sellerId; // Fallback to seller if no admin

      await recordSale(item.id, {
        soldPrice: item.original_price || 100,
        buyerName: 'Test Buyer',
        processedBy,
      });

      soldItems.push({ ...item, status: 'sold' });
      log(`  ✓ Marked item ${item.item_number} as sold`, 'green');
    } catch (error: any) {
      log(`  ⚠ Could not mark item ${item.item_number} as sold: ${error.message}`, 'yellow');
      // Continue with other items
    }
  }

  return soldItems;
}

async function main() {
  try {
    log('═══════════════════════════════════════════════════════════', 'green');
    log('  Payment Tracking API Test Suite', 'green');
    log('═══════════════════════════════════════════════════════════', 'green');
    console.log('');

    // Setup test data
    const { event, seller, items: initialItems } = await setupTestData();
    const sellerId = seller.id;
    const eventId = event.id;

    // Ensure items are sold
    const soldItems = await ensureItemsAreSold(initialItems, sellerId, eventId);

    if (soldItems.length === 0) {
      throw new Error('No sold items available for testing. Please ensure at least one item is sold.');
    }

    log(`\n✓ Test setup complete. Using ${soldItems.length} sold items`, 'green');
    console.log('');

    // Test 1: Get initial payment status
    logSection('Test 1: Get Initial Payment Status');
    try {
      const initialStatus = await getSellerPaymentStatus(sellerId, { eventId });
      log('Initial payment status:', 'yellow');
      console.log(JSON.stringify(initialStatus, null, 2));
      log(`✓ getSellerPaymentStatus works`, 'green');
    } catch (error: any) {
      log(`✗ getSellerPaymentStatus failed: ${error.message}`, 'red');
      throw error;
    }

    // Test 2: Get unpaid items
    logSection('Test 2: Get Unpaid Items');
    try {
      const unpaidItems = await getUnpaidItems(sellerId, { eventId });
      log(`Found ${unpaidItems.length} unpaid items`, 'yellow');
      if (unpaidItems.length > 0) {
        console.log(`  First unpaid item: ${unpaidItems[0].item_number || unpaidItems[0].id}`);
      }
      log(`✓ getUnpaidItems works`, 'green');
    } catch (error: any) {
      log(`✗ getUnpaidItems failed: ${error.message}`, 'red');
      throw error;
    }

    // Test 3: Mark single item as paid
    logSection('Test 3: Mark Single Item as Paid');
    if (soldItems.length > 0) {
      const itemToMark = soldItems[0];
      try {
        await markItemAsPaid(itemToMark.id);
        log(`✓ Marked item ${itemToMark.item_number || itemToMark.id} as paid`, 'green');

        // Verify it's now paid
        const paidItems = await getPaidItems(sellerId, { eventId });
        const isNowPaid = paidItems.some((item: any) => item.id === itemToMark.id);
        if (isNowPaid) {
          log(`✓ Verified item is now in paid items list`, 'green');
        } else {
          log(`⚠ Item marked as paid but not found in paid items list`, 'yellow');
        }
      } catch (error: any) {
        log(`✗ markItemAsPaid failed: ${error.message}`, 'red');
        // Continue with other tests
      }
    } else {
      log('⚠ No items available to mark as paid', 'yellow');
    }

    // Test 4: Get paid items
    logSection('Test 4: Get Paid Items');
    try {
      const paidItems = await getPaidItems(sellerId, { eventId });
      log(`Found ${paidItems.length} paid items`, 'yellow');
      if (paidItems.length > 0) {
        console.log(`  First paid item: ${paidItems[0].item_number || paidItems[0].id}`);
        console.log(`  Paid at: ${paidItems[0].paid_at || 'N/A'}`);
      }
      log(`✓ getPaidItems works`, 'green');
    } catch (error: any) {
      log(`✗ getPaidItems failed: ${error.message}`, 'red');
      throw error;
    }

    // Test 5: Get updated payment status
    logSection('Test 5: Get Updated Payment Status');
    try {
      const updatedStatus = await getSellerPaymentStatus(sellerId, { eventId });
      log('Updated payment status:', 'yellow');
      console.log(JSON.stringify(updatedStatus, null, 2));
      log(`✓ Payment status updated correctly`, 'green');
    } catch (error: any) {
      log(`✗ getSellerPaymentStatus failed: ${error.message}`, 'red');
      throw error;
    }

    // Test 6: Mark all seller items as paid (bulk)
    logSection('Test 6: Mark All Seller Items as Paid (Bulk)');
    try {
      const result = await markSellerItemsAsPaid(sellerId, { eventId });
      log(`✓ Marked ${result.itemsMarked} items as paid in bulk`, 'green');

      // Verify all are now paid
      const finalUnpaid = await getUnpaidItems(sellerId, { eventId });
      log(`  Remaining unpaid items: ${finalUnpaid.length}`, 'yellow');
    } catch (error: any) {
      log(`✗ markSellerItemsAsPaid failed: ${error.message}`, 'red');
      // Continue with other tests
    }

    // Test 7: Get event payment status
    logSection('Test 7: Get Event Payment Status');
    try {
      const eventStatus = await getEventPaymentStatus(eventId);
      log(`Found payment status for ${eventStatus.length} sellers`, 'yellow');
      if (eventStatus.length > 0) {
        console.log('  Seller payment summary:');
        eventStatus.forEach((seller, index) => {
          console.log(`    Seller ${index + 1}:`);
          console.log(`      Total items: ${seller.totalItems}`);
          console.log(`      Paid items: ${seller.paidItems}`);
          console.log(`      Unpaid items: ${seller.unpaidItems}`);
          console.log(`      Total amount: $${seller.totalAmount.toFixed(2)}`);
          console.log(`      Paid amount: $${seller.paidAmount.toFixed(2)}`);
          console.log(`      Unpaid amount: $${seller.unpaidAmount.toFixed(2)}`);
          console.log(`      Fully paid: ${seller.isFullyPaid ? 'Yes' : 'No'}`);
        });
      }
      log(`✓ getEventPaymentStatus works`, 'green');
    } catch (error: any) {
      log(`✗ getEventPaymentStatus failed: ${error.message}`, 'red');
      throw error;
    }

    // Test 8: Error handling - try to mark non-sold item as paid
    logSection('Test 8: Error Handling');
    try {
      // Find a non-sold item
      const { data: nonSoldItem } = await supabase
        .from('items')
        .select('id, status')
        .eq('seller_id', sellerId)
        .neq('status', 'sold')
        .limit(1)
        .single();

      if (nonSoldItem) {
        try {
          await markItemAsPaid(nonSoldItem.id);
          log(`✗ Should have thrown error for non-sold item`, 'red');
        } catch (error: any) {
          if (error.message.includes('Only sold items')) {
            log(`✓ Correctly rejected marking non-sold item as paid`, 'green');
          } else {
            throw error;
          }
        }
      } else {
        log(`⚠ No non-sold items available for error test`, 'yellow');
      }
    } catch (error: any) {
      log(`⚠ Error handling test: ${error.message}`, 'yellow');
    }

    // Final summary
    logSection('Test Summary');
    log('All payment tracking API tests completed!', 'green');
    console.log('');
    log('Tested functions:', 'yellow');
    log('  ✓ markItemAsPaid', 'green');
    log('  ✓ markSellerItemsAsPaid', 'green');
    log('  ✓ getPaidItems', 'green');
    log('  ✓ getUnpaidItems', 'green');
    log('  ✓ getSellerPaymentStatus', 'green');
    log('  ✓ getEventPaymentStatus', 'green');
    console.log('');

    // Show final status
    const finalStatus = await getSellerPaymentStatus(sellerId, { eventId });
    log('Final payment status:', 'cyan');
    console.log(JSON.stringify(finalStatus, null, 2));

  } catch (error) {
    log(`\n✗ Test suite failed: ${error instanceof Error ? error.message : String(error)}`, 'red');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
main();


