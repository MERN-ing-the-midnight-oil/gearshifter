# Seed Data Guide

This guide explains how to set up the fictional test data for the Gear Swap application.

## Fictional Data Created

### Organization
- **Name**: Bellingham Ski Swap
- **Slug**: bellingham-ski-swap
- **Commission Rate**: 25%
- **Vendor Commission Rate**: 20%
- **ID**: `11111111-1111-1111-1111-111111111111`

### Admin User
- **Name**: Alex Thompson
- **Email**: admin@bellinghamskiswap.com
- **ID**: `22222222-2222-2222-2222-222222222222`
- **Note**: You'll need to create this user via Supabase Auth with email/password

### Seller Accounts (5 sellers)
1. **Sarah Johnson**
   - Phone: +13605551234
   - Email: sarah.johnson@example.com
   - QR Code: SELLER-SG2025-001
   - ID: `33333333-3333-3333-3333-333333333333`
   - Items: 2 items (skis, boots)

2. **Mike Chen**
   - Phone: +13605551235
   - Email: mike.chen@example.com
   - QR Code: SELLER-SG2025-002
   - ID: `44444444-4444-4444-4444-444444444444`
   - Items: 2 items (skis, poles)

3. **Emily Rodriguez**
   - Phone: +13605551236
   - Email: emily.rodriguez@example.com
   - QR Code: SELLER-SG2025-003
   - ID: `55555555-5555-5555-5555-555555555555`
   - Items: 2 items (clothing, accessories)

4. **David Kim**
   - Phone: +13605551237
   - Email: david.kim@example.com
   - QR Code: SELLER-SG2025-004
   - ID: `66666666-6666-6666-6666-666666666666`
   - Items: 1 item (bindings)

5. **Lisa Anderson**
   - Phone: +13605551238
   - Email: lisa.anderson@example.com
   - QR Code: SELLER-SG2025-005
   - ID: `77777777-7777-7777-7777-777777777777`
   - Items: 2 items (skis, boots)

### Event
- **Name**: Spring 2025 Ski Swap
- **Date**: March 15, 2025
- **Registration Open**: February 1, 2025
- **Registration Close**: March 10, 2025
- **Shop Hours**: 9:00 AM - 5:00 PM
- **Price Drop Time**: 2:00 PM
- **Status**: registration
- **ID**: `88888888-8888-8888-8888-888888888888`
- **Total Items**: 9 items from 5 sellers

## Setup Instructions

### 1. Run Database Migrations
```bash
supabase db reset
# or
supabase migration up
```

### 2. Load Seed Data
```bash
# If using Supabase CLI locally
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql

# Or run the SQL directly in Supabase Studio
# Navigate to SQL Editor and paste the contents of supabase/seed.sql
```

### 3. Create Auth Users

**Important**: The seed data includes database records, but you need to create the actual auth users via Supabase Auth.

#### Create Admin User:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Email: `admin@bellinghamskiswap.com`
4. Password: (choose a password)
5. **Important**: Copy the User ID and ensure it matches `22222222-2222-2222-2222-222222222222`
   - If it doesn't match, update the `admin_users` table with the correct ID

#### Create Seller Users (Optional for testing):
For sellers, you can either:
- Create them via phone auth in the seller app
- Or create them manually in Supabase Auth and match the IDs

### 4. Test the Application

#### Organizer App:
1. Login with: `admin@bellinghamskiswap.com` and your password
2. You should see the "Spring 2025 Ski Swap" event in the dashboard
3. Click on the event to manage it

#### Seller App:
1. Login with any of the seller phone numbers (e.g., +13605551234)
2. Browse events and see the "Spring 2025 Ski Swap" event
3. View event details and add items

## Notes

- The seed data uses predictable UUIDs for easy reference
- All items are in "pending" status (not yet checked in)
- The event is in "registration" status, so sellers can still add items
- Commission rates are set at 25% for regular items and 20% for vendor items

## Troubleshooting

### Admin user not showing events:
- Verify the admin user ID in `admin_users` table matches the auth user ID
- Check that the `organization_id` in `admin_users` matches the organization ID

### Sellers can't see events:
- Ensure RLS policies are applied (run migrations)
- Verify sellers are authenticated

### Items not showing:
- Check that `event_id` and `seller_id` match the seeded data
- Verify RLS policies allow sellers to see their own items

