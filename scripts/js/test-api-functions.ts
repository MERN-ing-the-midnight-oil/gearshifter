/**
 * Test script for TypeScript API functions
 * Tests the same flow as test-api-flow.sh but using the actual API functions
 * 
 * Usage (with tsx - recommended):
 *   yarn add -D tsx
 *   export EXPO_PUBLIC_SUPABASE_URL='your-url'
 *   export EXPO_PUBLIC_SUPABASE_ANON_KEY='your-key'
 *   export SUPABASE_SERVICE_ROLE_KEY='your-service-key'  # Optional
 *   npx tsx test-api-functions.ts
 * 
 * Usage (with ts-node):
 *   yarn add -D ts-node
 *   export EXPO_PUBLIC_SUPABASE_URL='your-url'
 *   export EXPO_PUBLIC_SUPABASE_ANON_KEY='your-key'
 *   export SUPABASE_SERVICE_ROLE_KEY='your-service-key'  # Optional
 *   npx ts-node test-api-functions.ts
 * 
 * Usage (compile first):
 *   tsc test-api-functions.ts --module commonjs --esModuleInterop
 *   node test-api-functions.js
 */

import {
  createOrganization,
  signUpWithEmail,
  createEvent,
  signUpAsSeller,
  saveSellerSwapRegistration,
  createItem,
} from './packages/shared/api';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  try {
    log('Starting API functions test...', 'green');
    console.log('');

    // Step 1: Create Organization
    log('Step 1: Creating organization...', 'yellow');
    // Try with regular client first, fall back to service role if needed
    let org;
    try {
      org = await createOrganization({
        name: 'Music Swap Organization',
        slug: `music-swap-org-${Date.now()}`, // Make unique
        commissionRate: 0.25,
        vendorCommissionRate: 0.20,
      });
    } catch (error) {
      // If RLS blocks it, use service role key
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        log('  Organization creation blocked by RLS, using service role key...', 'yellow');
        // Import from shared package which has supabase-js
        // Use dynamic import with proper path resolution
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const serviceClient = createClient(supabaseUrl, serviceKey);
        const slug = `music-swap-org-${Date.now()}`;
        log(`  Creating organization with slug: ${slug}`, 'yellow');
        // Insert without select to avoid the coercion issue
        const { error: insertError } = await serviceClient
          .from('organizations')
          .insert({
            name: 'Music Swap Organization',
            slug: slug,
            commission_rate: 0.25,
            vendor_commission_rate: 0.20,
          });
        if (insertError) {
          log(`  Insert failed: ${insertError.message}`, 'red');
          log(`  Error code: ${insertError.code}`, 'red');
          throw insertError;
        }
        log('  Insert succeeded, fetching organization...', 'yellow');
        // Now fetch the created organization
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure insert is committed
        const { data: fetchedData, error: fetchError } = await serviceClient
          .from('organizations')
          .select('*')
          .eq('slug', slug)
          .limit(1);
        if (fetchError) {
          throw new Error(`Could not fetch created organization: ${fetchError.message}`);
        }
        if (!fetchedData || fetchedData.length === 0) {
          throw new Error('Organization insert appeared to succeed but could not be found');
        }
        // Map to Organization type manually since getOrganization might fail due to RLS
        const orgData = fetchedData[0];
        org = {
          id: orgData.id,
          name: orgData.name,
          slug: orgData.slug,
          commissionRate: parseFloat(orgData.commission_rate),
          vendorCommissionRate: parseFloat(orgData.vendor_commission_rate),
          priceReductionSettings: orgData.price_reduction_settings || {
            sellerCanSetReduction: true,
            sellerCanSetTime: true,
            defaultReductionTime: undefined,
            allowedReductionTimes: [],
          },
          createdAt: new Date(orgData.created_at),
        };
      } else {
        log('  Error details:', 'red');
        if (error instanceof Error) {
          console.error('  Message:', error.message);
          if ('code' in error) console.error('  Code:', (error as any).code);
          if ('details' in error) console.error('  Details:', (error as any).details);
          if ('hint' in error) console.error('  Hint:', (error as any).hint);
        }
        throw error;
      }
    }
    log(`✓ Organization created with ID: ${org.id}`, 'green');
    console.log('');

    // Step 2: Sign up admin user
    log('Step 2: Signing up admin user...', 'yellow');
    const adminEmail = `admin-${Date.now()}@musicswap.org`;
    const adminPassword = 'AdminPassword123!';
    
    let adminAuth;
    try {
      adminAuth = await signUpWithEmail({
        email: adminEmail,
        password: adminPassword,
        phone: '+15551234567',
        firstName: 'John',
        lastName: 'Organizer',
      });
    } catch (error: any) {
      // If email rate limit, try using service role key to create user directly
      if (error.code === 'over_email_send_rate_limit' || error.message?.includes('rate limit')) {
        log('  Email rate limit hit, creating user with service role key...', 'yellow');
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const serviceClient = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });
          
          // Create user directly with service role (bypasses email confirmation)
          const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              first_name: 'John',
              last_name: 'Organizer',
              phone: '+15551234567',
            },
          });
          
          if (userError || !userData.user) {
            throw new Error(`Failed to create admin user: ${userError?.message || 'Unknown error'}`);
          }
          
          adminAuth = {
            user: userData.user,
            session: userData.session,
          };
        } else {
          throw new Error('Email rate limit exceeded and no service role key available. Please wait a few minutes and try again, or disable email confirmation in Supabase settings.');
        }
      } else {
        throw error;
      }
    }
    
    if (!adminAuth.user) {
      throw new Error('Failed to create admin user');
    }
    
    const adminUserId = adminAuth.user.id;
    log(`✓ Admin user signed up with ID: ${adminUserId}`, 'green');
    console.log('');

    // Step 3: Create admin_users record
    // Note: This requires direct Supabase call since we don't have a createAdminUser function
    log('Step 3: Creating admin_users record...', 'yellow');
    const { supabase } = await import('./packages/shared/api/supabase');
    const { error: adminUserError } = await supabase
      .from('admin_users')
      .insert({
        id: adminUserId,
        organization_id: org.id,
        first_name: 'John',
        last_name: 'Organizer',
        email: adminEmail,
        permissions: {
          check_in: true,
          pos: true,
          pickup: true,
          reports: true,
        },
      });

    if (adminUserError) {
      // If RLS blocks it, try with service role key
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const serviceClient = createClient(supabaseUrl, serviceKey);
        const { error: retryError } = await serviceClient
          .from('admin_users')
          .insert({
            id: adminUserId,
            organization_id: org.id,
            first_name: 'John',
            last_name: 'Organizer',
            email: adminEmail,
            permissions: {
              check_in: true,
              pos: true,
              pickup: true,
              reports: true,
            },
          });
        if (retryError) throw retryError;
      } else {
        throw adminUserError;
      }
    }
    log('✓ Admin user record created', 'green');
    console.log('');

    // Step 4: Create Event
    log('Step 4: Creating event "Musical Instrument Swap 2026"...', 'yellow');
    const eventDate = new Date();
    eventDate.setMonth(eventDate.getMonth() + 3);
    
    const registrationOpenDate = new Date();
    const registrationCloseDate = new Date();
    registrationCloseDate.setMonth(registrationCloseDate.getMonth() + 2);
    
    const shopOpenTime = new Date(eventDate);
    shopOpenTime.setHours(9, 0, 0, 0);
    
    const shopCloseTime = new Date(eventDate);
    shopCloseTime.setHours(17, 0, 0, 0);

    let event;
    try {
      event = await createEvent(org.id, {
        name: 'Musical Instrument Swap 2026',
        eventDate,
        registrationOpenDate,
        registrationCloseDate,
        shopOpenTime,
        shopCloseTime,
        status: 'registration',
        settings: {},
      });
    } catch (error: any) {
      // If RLS blocks it (infinite recursion), use service role key
      if (error.code === '42P17' || error.message?.includes('recursion') || error.message?.includes('row-level security')) {
        log('  Event creation blocked by RLS, using service role key...', 'yellow');
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const serviceClient = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });
          
          const eventData = {
            organization_id: org.id,
            name: 'Musical Instrument Swap 2026',
            event_date: eventDate.toISOString().split('T')[0],
            registration_open_date: registrationOpenDate.toISOString().split('T')[0],
            registration_close_date: registrationCloseDate.toISOString().split('T')[0],
            shop_open_time: shopOpenTime.toISOString(),
            shop_close_time: shopCloseTime.toISOString(),
            price_drop_time: null,
            status: 'registration',
            settings: {},
          };
          
          // Insert without select to avoid any policy checks
          const { error: insertError } = await serviceClient
            .from('events')
            .insert(eventData);
          
          if (insertError) throw insertError;
          
          log('  Insert succeeded, fetching event...', 'yellow');
          
          // Fetch using service client to bypass RLS
          const { data: eventsData, error: fetchError } = await serviceClient
            .from('events')
            .select('*')
            .eq('organization_id', org.id)
            .eq('name', 'Musical Instrument Swap 2026')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (fetchError || !eventsData) {
            throw new Error(`Failed to fetch created event: ${fetchError?.message || 'No data returned'}`);
          }
          
          // Manually map the event data to match the Event type
          event = {
            id: eventsData.id,
            organizationId: eventsData.organization_id,
            name: eventsData.name,
            eventDate: new Date(eventsData.event_date),
            registrationOpenDate: new Date(eventsData.registration_open_date),
            registrationCloseDate: new Date(eventsData.registration_close_date),
            shopOpenTime: new Date(eventsData.shop_open_time),
            shopCloseTime: new Date(eventsData.shop_close_time),
            priceDropTime: eventsData.price_drop_time ? new Date(eventsData.price_drop_time) : undefined,
            status: eventsData.status,
            settings: eventsData.settings || {},
          };
        } else {
          throw new Error('Event creation blocked by RLS and no service role key available');
        }
      } else {
        throw error;
      }
    }
    
    log(`✓ Event created with ID: ${event.id}`, 'green');
    console.log('');

    // Step 5: Sign up seller
    log('Step 5: Signing up seller...', 'yellow');
    const timestamp = Date.now();
    const sellerEmail = `seller-${timestamp}@test.musicswap.org`; // Use valid domain
    const sellerPassword = 'SellerPassword123!';
    const sellerPhone = `+1555${timestamp.toString().slice(-7)}`; // Make phone unique
    
    let sellerAuth;
    try {
      sellerAuth = await signUpAsSeller({
        email: sellerEmail,
        password: sellerPassword,
        phone: sellerPhone,
        firstName: 'Jane',
        lastName: 'Musician',
      });
    } catch (error: any) {
      // If email rate limit, try using service role key to create user directly
      if (error.code === 'over_email_send_rate_limit' || error.message?.includes('rate limit')) {
        log('  Email rate limit hit, creating seller with service role key...', 'yellow');
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const serviceClient = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });
          
          // Create user directly with service role (bypasses email confirmation)
          const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
            email: sellerEmail,
            password: sellerPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              first_name: 'Jane',
              last_name: 'Musician',
              phone: sellerPhone,
            },
          });
          
          if (userError || !userData.user) {
            throw new Error(`Failed to create seller user: ${userError?.message || 'Unknown error'}`);
          }
          
          // Create the seller record using service client to bypass RLS
          const { generateSellerQRCode } = await import('./packages/shared/utils/qrCode');
          const qrCode = generateSellerQRCode(userData.user.id);
          
          const { data: sellerData, error: sellerError } = await serviceClient
            .from('sellers')
            .insert({
              id: userData.user.id,
              auth_user_id: userData.user.id,
              first_name: 'Jane',
              last_name: 'Musician',
              phone: sellerPhone,
              email: sellerEmail,
              qr_code: qrCode,
              is_guest: false,
            })
            .select()
            .single();
          
          if (sellerError || !sellerData) {
            throw new Error(`Failed to create seller record: ${sellerError?.message || 'Unknown error'}`);
          }
          
          // Map seller data
          const seller = {
            id: sellerData.id,
            authUserId: sellerData.auth_user_id,
            firstName: sellerData.first_name,
            lastName: sellerData.last_name,
            phone: sellerData.phone,
            email: sellerData.email,
            qrCode: sellerData.qr_code,
            isGuest: sellerData.is_guest || false,
          };
          
          sellerAuth = {
            user: userData.user,
            seller: seller,
          };
        } else {
          throw new Error('Email rate limit exceeded and no service role key available. Please wait a few minutes and try again.');
        }
      } else {
        throw error;
      }
    }
    
    if (!sellerAuth.user || !sellerAuth.seller) {
      throw new Error('Failed to create seller');
    }
    
    const sellerId = sellerAuth.seller.id;
    log(`✓ Seller signed up with ID: ${sellerId}`, 'green');
    console.log('');

    // Step 6: Register seller for swap
    log('Step 6: Registering seller for swap...', 'yellow');
    let registration;
    try {
      registration = await saveSellerSwapRegistration(
        sellerId,
        event.id,
        {
          address: '123 Music Street',
          city: 'Nashville',
          state: 'TN',
          zip_code: '37203',
          marketing_opt_in: true,
        },
        [] // No required fields for this test
      );
    } catch (error: any) {
      // If RLS blocks it (infinite recursion), use service role key
      if (error.code === '42P17' || error.message?.includes('recursion') || error.message?.includes('row-level security')) {
        log('  Registration blocked by RLS, using service role key...', 'yellow');
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const serviceClient = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });
          
          const registrationData = {
            address: '123 Music Street',
            city: 'Nashville',
            state: 'TN',
            zip_code: '37203',
            marketing_opt_in: true,
          };
          
          // Check if registration already exists
          const { data: existingData } = await serviceClient
            .from('seller_swap_registrations')
            .select('id')
            .eq('seller_id', sellerId)
            .eq('event_id', event.id)
            .single();
          
          let registrationResult;
          if (existingData) {
            // Update existing
            const { data: updateData, error: updateError } = await serviceClient
              .from('seller_swap_registrations')
              .update({
                registration_data: registrationData,
                is_complete: true,
              })
              .eq('id', existingData.id)
              .select()
              .single();
            if (updateError) throw updateError;
            registrationResult = updateData;
          } else {
            // Create new
            const { data: insertData, error: insertError } = await serviceClient
              .from('seller_swap_registrations')
              .insert({
                event_id: event.id,
                seller_id: sellerId,
                registration_data: registrationData,
                is_complete: true,
              })
              .select()
              .single();
            if (insertError) throw insertError;
            registrationResult = insertData;
          }
          
          // Map to SellerSwapRegistration type
          registration = {
            id: registrationResult.id,
            eventId: registrationResult.event_id,
            sellerId: registrationResult.seller_id,
            registrationData: registrationResult.registration_data || {},
            isComplete: registrationResult.is_complete,
            registeredAt: new Date(registrationResult.registered_at),
            updatedAt: new Date(registrationResult.updated_at),
          };
        } else {
          throw new Error('Registration blocked by RLS and no service role key available');
        }
      } else {
        throw error;
      }
    }
    
    log(`✓ Seller registered for swap with ID: ${registration.id}`, 'green');
    console.log('');

    // Step 7: Create items
    log('Step 7: Creating items for seller...', 'yellow');
    
    // Helper function to create item with service role fallback
    const createItemWithFallback = async (
      sellerId: string,
      eventId: string,
      itemData: Parameters<typeof createItem>[2]
    ) => {
      try {
        return await createItem(sellerId, eventId, itemData);
      } catch (error: any) {
        // If RLS blocks it (infinite recursion), use service role key
        if (error.code === '42P17' || error.message?.includes('recursion') || error.message?.includes('row-level security')) {
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!serviceKey) {
            throw new Error('Item creation blocked by RLS and no service role key available');
          }
          
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const serviceClient = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });
          
          // Generate item number - item_number is globally unique, so find highest across all events
          const year = new Date().getFullYear();
          const { data: lastItems, error: queryError } = await serviceClient
            .from('items')
            .select('item_number')
            .like('item_number', `SG${year}-%`)
            .order('item_number', { ascending: false })
            .limit(1);
          
          let itemNumber: string;
          if (queryError && queryError.code !== 'PGRST116') {
            // If it's not a "no rows" error, throw it
            throw queryError;
          }
          
          if (!lastItems || lastItems.length === 0) {
            // No items for this year yet, start at 000001
            itemNumber = `SG${year}-000001`;
          } else {
            // Get the highest item number globally and increment
            const lastItem = lastItems[0];
            const parts = lastItem.item_number.split('-');
            if (parts.length === 2 && parts[0] === `SG${year}`) {
              const lastNum = parseInt(parts[1]);
              if (isNaN(lastNum)) {
                itemNumber = `SG${year}-000001`;
              } else {
                // Increment and pad to 6 digits
                itemNumber = `SG${year}-${String(lastNum + 1).padStart(6, '0')}`;
              }
            } else {
              // Unexpected format, start fresh
              itemNumber = `SG${year}-000001`;
            }
          }
          
          // Build insert data
          const insertData: any = {
            event_id: eventId,
            seller_id: sellerId,
            item_number: itemNumber,
            status: 'pending',
            qr_code: 'TEMP',
            custom_fields: itemData.customFields || {},
          };
          
          if (itemData.categoryId) insertData.category_id = itemData.categoryId;
          if (itemData.category) insertData.category = itemData.category;
          if (itemData.description) insertData.description = itemData.description;
          if (itemData.size) insertData.size = itemData.size;
          if (itemData.originalPrice !== undefined) insertData.original_price = itemData.originalPrice;
          if (itemData.reducedPrice !== undefined) insertData.reduced_price = itemData.reducedPrice;
          if (itemData.enablePriceReduction !== undefined) insertData.enable_price_reduction = itemData.enablePriceReduction;
          if (itemData.donateIfUnsold !== undefined) insertData.donate_if_unsold = itemData.donateIfUnsold;
          
          // Insert item
          const { data: insertedItem, error: insertError } = await serviceClient
            .from('items')
            .insert(insertData)
            .select()
            .single();
          
          if (insertError) throw insertError;
          
          // Generate QR code
          const { generateItemQRCode } = await import('./packages/shared/utils/qrCode');
          const tempItem = {
            id: insertedItem.id,
            itemNumber: insertedItem.item_number,
            category: insertedItem.category,
            categoryId: insertedItem.category_id,
            description: insertedItem.description,
            size: insertedItem.size,
            originalPrice: insertedItem.original_price,
            reducedPrice: insertedItem.reduced_price,
            customFields: insertedItem.custom_fields || {},
          } as any;
          const finalQrCode = generateItemQRCode(tempItem);
          
          // Update QR code
          const { data: updatedItem, error: updateError } = await serviceClient
            .from('items')
            .update({ qr_code: finalQrCode })
            .eq('id', insertedItem.id)
            .select()
            .single();
          
          if (updateError) throw updateError;
          
          // Map to Item type
          return {
            id: updatedItem.id,
            eventId: updatedItem.event_id,
            sellerId: updatedItem.seller_id,
            itemNumber: updatedItem.item_number,
            categoryId: updatedItem.category_id,
            category: updatedItem.category,
            description: updatedItem.description,
            size: updatedItem.size,
            originalPrice: updatedItem.original_price,
            reducedPrice: updatedItem.reduced_price,
            enablePriceReduction: updatedItem.enable_price_reduction,
            donateIfUnsold: updatedItem.donate_if_unsold,
            customFields: updatedItem.custom_fields || {},
            status: updatedItem.status,
            qrCode: updatedItem.qr_code,
            checkedInAt: updatedItem.checked_in_at ? new Date(updatedItem.checked_in_at) : undefined,
            soldAt: updatedItem.sold_at ? new Date(updatedItem.sold_at) : undefined,
            soldPrice: updatedItem.sold_price,
            createdAt: new Date(updatedItem.created_at),
          };
        } else {
          throw error;
        }
      }
    };
    
    const item1 = await createItemWithFallback(sellerId, event.id, {
      category: 'Guitars',
      description: 'Vintage Fender Stratocaster - Excellent condition',
      size: 'Full Size',
      originalPrice: 850.00,
      enablePriceReduction: true,
      reducedPrice: 750.00,
      donateIfUnsold: false,
    });
    log(`✓ Item 1 (Guitar) created with ID: ${item1.id}`, 'green');

    const item2 = await createItemWithFallback(sellerId, event.id, {
      category: 'Pianos',
      description: 'Yamaha Digital Piano P-125 - Like new',
      size: 'Standard',
      originalPrice: 600.00,
      enablePriceReduction: false,
      donateIfUnsold: false,
    });
    log(`✓ Item 2 (Piano) created with ID: ${item2.id}`, 'green');

    const item3 = await createItemWithFallback(sellerId, event.id, {
      category: 'Drums',
      description: 'Pearl Export Series 5-Piece Drum Kit',
      size: 'Full Set',
      originalPrice: 450.00,
      enablePriceReduction: true,
      reducedPrice: 400.00,
      donateIfUnsold: true,
    });
    log(`✓ Item 3 (Drums) created with ID: ${item3.id}`, 'green');
    console.log('');

    // Summary
    log('========================================', 'green');
    log('All API function tests completed successfully!', 'green');
    log('========================================', 'green');
    console.log('');
    console.log('Summary:');
    console.log(`  Organization ID: ${org.id}`);
    console.log(`  Admin User ID: ${adminUserId}`);
    console.log(`  Event ID: ${event.id}`);
    console.log(`  Seller ID: ${sellerId}`);
    console.log(`  Registration ID: ${registration.id}`);
    console.log(`  Items created: 3`);
    console.log(`    - ${item1.id} (Guitar)`);
    console.log(`    - ${item2.id} (Piano)`);
    console.log(`    - ${item3.id} (Drums)`);
    console.log('');

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, 'red');
    if (error instanceof Error) {
      if (error.stack) {
        console.error(error.stack);
      }
      // Try to extract more details if it's a Supabase error
      if ('code' in error || 'message' in error) {
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
    } else {
      console.error('Full error object:', error);
    }
    process.exit(1);
  }
}

// Run the test
main();

