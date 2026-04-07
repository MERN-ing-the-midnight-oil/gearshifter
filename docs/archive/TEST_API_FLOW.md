# API Flow Test Script

This document describes how to test the complete API flow using curl commands.

## Prerequisites

1. **Supabase Environment Variables**
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended): Your Supabase service role key
     - Required for organization creation if RLS policies don't allow it
     - Get this from: Supabase Dashboard → Settings → API → service_role key

2. **Database Migrations**
   - Make sure all migrations are applied, including the new one:
     - `20250109000000_add_insert_policies_for_testing.sql`
   - This migration adds INSERT policies for organizations, events, and admin_users

3. **jq** (JSON processor)
   - Install with: `brew install jq` (macOS) or `apt-get install jq` (Linux)

## Running the Test

1. Set environment variables:
   ```bash
   export SUPABASE_URL='https://your-project.supabase.co'
   export SUPABASE_ANON_KEY='your-anon-key'
   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'  # Optional but recommended
   ```

2. Run the test script:
   ```bash
   ./test-api-flow.sh
   ```

## What the Script Tests

The script simulates the complete flow:

1. **Create Organization** - Creates "Music Swap Organization"
2. **Create Admin User** - Signs up admin user and creates admin_users record
3. **Create Event** - Creates "Musical Instrument Swap 2026" event
4. **Create Seller** - Signs up seller user and creates seller record
5. **Register Seller for Swap** - Registers seller for the event
6. **Create Items** - Creates 3 items (Guitar, Piano, Drums) for the seller

## API Functions Added

The following API functions were added to support this flow:

- `createOrganization()` in `packages/shared/api/organizations.ts`
- `createEvent()` in `packages/shared/api/events.ts`

## RLS Policies

The script uses the service role key for operations that require elevated permissions:
- Organization creation
- Admin user creation
- Event creation (falls back to service role if admin token fails)

All other operations use the appropriate user tokens (admin or seller).

## Troubleshooting

### Organization Creation Fails
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set
- Or ensure the INSERT policy for organizations is applied

### Event Creation Fails
- The script will automatically retry with service role key if admin token fails
- Make sure the admin user was created successfully

### Item Creation Fails
- Make sure the seller is registered for the event
- Check that item_number and qr_code are unique (they're auto-generated in production)

## Notes

- The script uses direct REST API calls, bypassing the TypeScript API functions
- In production, use the API functions which handle auto-generation of item numbers and QR codes
- The script creates test data that can be cleaned up manually from the Supabase dashboard






