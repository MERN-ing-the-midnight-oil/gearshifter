# Supabase Setup Guide

## 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your "Gear Shifter" project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (the `anon` key, not the `service_role` key)

## 2. Set Up Environment Variables

Create `.env` files in both app directories with your credentials:

### Seller App
```bash
cd packages/seller-app
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=your-project-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_APP_VARIANT=seller
EXPO_PUBLIC_ENABLE_NOTIFICATIONS=true
EOF
```

### Organizer App
```bash
cd packages/organizer-app
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=your-project-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_APP_VARIANT=organizer
EXPO_PUBLIC_ENABLE_PRINTER=true
EXPO_PUBLIC_PRINTER_TYPE=zebra
EOF
```

## 3. Link Your Local Supabase Project

If you want to run Supabase locally for development:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your remote project
supabase link --project-ref your-project-ref-id
```

To find your project ref ID:
- Go to your project settings in Supabase dashboard
- Look for "Reference ID" in the General settings

## 4. Run Migrations

### Option A: Push migrations to remote project
```bash
supabase db push
```

### Option B: Apply migrations manually
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file in order:
   - `supabase/migrations/20250101000000_init_schema.sql`
   - `supabase/migrations/20250102000000_add_rls_policies.sql`
4. Run each migration

## 5. Generate TypeScript Types

After running migrations, generate TypeScript types from your database:

```bash
# For remote project
supabase gen types typescript --project-id your-project-ref-id > packages/shared/types/supabase.ts

# Or if linked locally
supabase gen types typescript --local > packages/shared/types/supabase.ts
```

## 6. Enable Phone Authentication

For seller app phone number login:

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable **Phone** provider
3. Configure Twilio (or use Supabase's built-in SMS for development)

## 7. Verify Setup

Test your connection:

```bash
# Start one of the apps
yarn seller:start

# The app should connect to Supabase without errors
```

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure `.env` files exist in both app directories
- Check that variable names start with `EXPO_PUBLIC_`
- Restart Expo after creating/updating `.env` files

### Migration errors
- Make sure you're running migrations in order
- Check that you have the correct permissions in Supabase
- Verify your project ref ID is correct

### Type generation errors
- Make sure migrations have been applied
- Check that you're using the correct project ref ID
- Try regenerating types after a few seconds (sometimes there's a delay)

