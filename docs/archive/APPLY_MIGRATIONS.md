# Apply Migrations to Supabase

The API tests are failing because the database migrations haven't been applied yet. Here's how to apply them:

## Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: **spozqnkfwltgxqrokpaj**
3. Navigate to **SQL Editor**
4. Run each migration file in order:

   **Migration 1: Initial Schema**
   - Copy contents of `supabase/migrations/20250101000000_init_schema.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 2: RLS Policies**
   - Copy contents of `supabase/migrations/20250102000000_add_rls_policies.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 3: Dynamic Fields**
   - Copy contents of `supabase/migrations/20250103000000_add_dynamic_fields.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 4: Swap Registration Fields**
   - Copy contents of `supabase/migrations/20250104000000_add_swap_registration_fields.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 5: Page Customization and Tags**
   - Copy contents of `supabase/migrations/20250105000000_add_page_customization_and_tags.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 6: Price Reduction Settings**
   - Copy contents of `supabase/migrations/20250106000000_add_price_reduction_settings.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 7: Guest Sellers**
   - Copy contents of `supabase/migrations/20250107000000_support_guest_sellers.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 8: Buyer Info**
   - Copy contents of `supabase/migrations/20250108000000_add_buyer_info_to_transactions.sql`
   - Paste into SQL Editor
   - Click "Run"

   **Migration 9: Insert Policies (for testing)**
   - Copy contents of `supabase/migrations/20250109000000_add_insert_policies_for_testing.sql`
   - Paste into SQL Editor
   - Click "Run"

## Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref spozqnkfwltgxqrokpaj

# Push all migrations
supabase db push
```

## Verify Migrations Applied

After applying migrations, you can verify by:

1. Going to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - `organizations`
   - `events`
   - `sellers`
   - `admin_users`
   - `items`
   - `transactions`
   - `payouts`
   - And others...

## Then Run Tests

Once migrations are applied, run the tests again:

```bash
export EXPO_PUBLIC_SUPABASE_URL="https://spozqnkfwltgxqrokpaj.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable__2MqLALVBMuJkizWl7EoiA_LrmH61dh"
npx tsx test-api-functions.ts
```






