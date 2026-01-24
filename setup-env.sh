#!/bin/bash
# Quick setup script for Supabase environment variables

echo "Supabase Setup Script"
echo "====================="
echo ""
echo "You'll need your Supabase credentials from:"
echo "https://supabase.com/dashboard → Your Project → Settings → API"
echo ""

read -p "Enter your Supabase Project URL: " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_KEY

# Seller app
cat > packages/seller-app/.env << EOL
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
EXPO_PUBLIC_APP_VARIANT=seller
EXPO_PUBLIC_ENABLE_NOTIFICATIONS=true
EOL

# Organizer app
cat > packages/organizer-app/.env << EOL
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
EXPO_PUBLIC_APP_VARIANT=organizer
EXPO_PUBLIC_ENABLE_PRINTER=true
EXPO_PUBLIC_PRINTER_TYPE=zebra
EOL

echo ""
echo "✅ Environment files created!"
echo ""
echo "Next steps:"
echo "1. Run migrations: supabase db push"
echo "2. Generate types: supabase gen types typescript --project-id <your-project-id> > packages/shared/types/supabase.ts"
echo "3. Start developing: yarn seller:start or yarn organizer:start"
