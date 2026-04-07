# Apply Migrations - Quick Guide

## ✅ Combined Migration File Ready

The combined migration file has been created at: `supabase/combined_migration.sql`

This file contains all 9 migrations in the correct order.

## Method 1: Supabase Dashboard (Easiest - Recommended)

1. **Open SQL Editor**:
   - Go to: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new
   - Or: Dashboard → SQL Editor → New Query

2. **Copy the migration file**:
   ```bash
   cat supabase/combined_migration.sql
   ```
   Copy all the contents.

3. **Paste and Run**:
   - Paste into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter
   - Wait for it to complete (should take a few seconds)

4. **Verify**:
   - Go to: Table Editor
   - You should see tables: `organizations`, `events`, `sellers`, `items`, etc.

## Method 2: Supabase CLI (If you can login)

```bash
# Login to Supabase (interactive)
supabase login

# Link to your project
supabase link --project-ref spozqnkfwltgxqrokpaj

# Push migrations
supabase db push
```

## Method 3: Individual Migrations (If combined fails)

If the combined file is too large, apply migrations one at a time:

1. Go to SQL Editor
2. Apply each file in order:
   - `20250101000000_init_schema.sql`
   - `20250102000000_add_rls_policies.sql`
   - `20250103000000_add_dynamic_fields.sql`
   - `20250104000000_add_swap_registration_fields.sql`
   - `20250105000000_add_page_customization_and_tags.sql`
   - `20250106000000_add_price_reduction_settings.sql`
   - `20250107000000_support_guest_sellers.sql`
   - `20250108000000_add_buyer_info_to_transactions.sql`
   - `20250109000000_add_insert_policies_for_testing.sql`

## After Applying

Once migrations are applied, you can:
1. Run the API tests: `npx tsx test-api-functions.ts`
2. Test the frontend flows
3. Start using the application

## Troubleshooting

- **"relation already exists"**: Migrations may have been partially applied. Check which tables exist.
- **"permission denied"**: Make sure you're using the correct Supabase project.
- **"syntax error"**: Check that you copied the entire file correctly.






