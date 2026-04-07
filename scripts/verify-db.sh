#!/bin/bash

# Verification script to check if RLS fix and seed data were applied

SUPABASE_URL="https://spozqnkfwltgxqrokpaj.supabase.co"
SUPABASE_KEY="sb_publishable__2MqLALVBMuJkizWl7EoiA_LrmH61dh"

echo "🔍 Verifying Supabase database..."
echo ""

# Check events
echo "📅 Checking events..."
EVENTS_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/events?select=id,name,status&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if echo "$EVENTS_RESPONSE" | grep -q "infinite recursion"; then
  echo "❌ Still getting recursion error!"
  echo "   Make sure you ran apply-fix-and-seed.sql"
  exit 1
elif echo "$EVENTS_RESPONSE" | grep -q '"name"'; then
  echo "✅ Events found (no recursion error):"
  echo "$EVENTS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -20
else
  echo "⚠️  No events found or unexpected response:"
  echo "$EVENTS_RESPONSE"
fi

echo ""
echo "🏢 Checking organizations..."
ORGS_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/organizations?select=id,name&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if echo "$ORGS_RESPONSE" | grep -q '"name"'; then
  echo "✅ Organizations found:"
  echo "$ORGS_RESPONSE" | python3 -m json.tool 2>/dev/null
else
  echo "⚠️  No organizations found"
fi

echo ""
echo "👤 Checking sellers..."
SELLERS_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/sellers?select=id,first_name,last_name&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if echo "$SELLERS_RESPONSE" | grep -q '"first_name"'; then
  echo "✅ Sellers found:"
  echo "$SELLERS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -15
else
  echo "⚠️  No sellers found"
fi

echo ""
echo "📦 Checking items..."
ITEMS_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/items?select=id,item_number,category&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if echo "$ITEMS_RESPONSE" | grep -q "infinite recursion"; then
  echo "❌ Still getting recursion error on items!"
elif echo "$ITEMS_RESPONSE" | grep -q '"item_number"'; then
  echo "✅ Items found (no recursion error):"
  echo "$ITEMS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -15
else
  echo "⚠️  No items found or unexpected response"
fi

echo ""
echo "✨ Verification complete!"

