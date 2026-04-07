#!/bin/bash

# Script to apply RLS fix and load seed data
# This requires running SQL in Supabase Dashboard SQL Editor

echo "=========================================="
echo "RLS Recursion Fix & Seed Data Loader"
echo "=========================================="
echo ""
echo "This script will help you:"
echo "1. Apply the RLS recursion fix migration"
echo "2. Load seed data into your database"
echo ""
echo "You'll need to run SQL in Supabase Dashboard:"
echo "https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new"
echo ""
echo "=========================================="
echo "STEP 1: Apply RLS Fix Migration"
echo "=========================================="
echo ""
echo "Copy the contents of: supabase/migrations/20250113000000_fix_rls_recursion.sql"
echo "Paste into Supabase SQL Editor and run it."
echo ""
read -p "Press Enter after you've applied the migration..."
echo ""
echo "=========================================="
echo "STEP 2: Load Seed Data"
echo "=========================================="
echo ""
echo "Copy the contents of: supabase/seed.sql"
echo "Paste into Supabase SQL Editor and run it."
echo ""
read -p "Press Enter after you've loaded the seed data..."
echo ""
echo "=========================================="
echo "Verifying data..."
echo "=========================================="

# Try to verify via API
echo "Checking events..."
EVENTS=$(curl -s "https://spozqnkfwltgxqrokpaj.supabase.co/rest/v1/events?select=id,name&limit=1" \
  -H "apikey: sb_publishable__2MqLALVBMuJkizWl7EoiA_LrmH61dh" \
  -H "Authorization: Bearer sb_publishable__2MqLALVBMuJkizWl7EoiA_LrmH61dh" 2>&1)

if echo "$EVENTS" | grep -q "infinite recursion"; then
  echo "❌ Still getting recursion error. Make sure migration was applied."
elif echo "$EVENTS" | grep -q '"name"'; then
  echo "✅ Events found! Migration and seed data loaded successfully."
  echo "$EVENTS" | python3 -m json.tool 2>/dev/null || echo "$EVENTS"
else
  echo "⚠️  Could not verify. Check manually in Supabase Dashboard."
  echo "Response: $EVENTS"
fi

echo ""
echo "Done! Check your Supabase Dashboard to verify all data was loaded."

