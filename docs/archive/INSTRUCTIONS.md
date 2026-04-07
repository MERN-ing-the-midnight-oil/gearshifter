# Apply RLS Fix and Load Seed Data

## Quick Steps

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new

2. **Copy and Run the SQL**
   - Open the file: `apply-fix-and-seed.sql`
   - Copy ALL contents
   - Paste into Supabase SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

3. **Verify It Worked**
   - Run the verification script: `./verify-db.sh`
   - Or check manually in Supabase Dashboard → Table Editor

## What This Does

### Step 1: Fixes RLS Recursion
- Removes the problematic "Sellers can view events they have items in" policy
- Creates SECURITY DEFINER functions to bypass RLS checks
- Fixes the circular dependency between events and items policies

### Step 2: Loads Seed Data
- Creates 1 organization: "Bellingham Ski Swap"
- Creates 1 admin user: Alex Thompson
- Creates 5 sellers with test data
- Creates 1 event: "Spring 2025 Ski Swap"
- Creates 9 items across the 5 sellers

## After Running

You should be able to:
- Query events without recursion errors
- See the "Spring 2025 Ski Swap" event in your app
- Browse events as a seller
- View items as an admin

## Troubleshooting

If you get errors:
- Make sure all previous migrations have been applied
- Check that the tables exist (run migrations first if needed)
- Verify you have the correct project selected in Supabase Dashboard

