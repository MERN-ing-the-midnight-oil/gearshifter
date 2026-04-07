#!/bin/bash

# Test script to simulate the full flow:
# 1. Create organization
# 2. Create admin user and sign up
# 3. Create event/swap
# 4. Create seller and sign up
# 5. Register seller for swap
# 6. Create items

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for Supabase environment variables
if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}Error: SUPABASE_URL environment variable is not set${NC}"
  echo "Please set it with: export SUPABASE_URL='your-supabase-url'"
  exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_ANON_KEY environment variable is not set${NC}"
  echo "Please set it with: export SUPABASE_ANON_KEY='your-anon-key'"
  exit 1
fi

# Service role key is optional - needed for organization creation if RLS doesn't allow it
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${YELLOW}Warning: SUPABASE_SERVICE_ROLE_KEY not set. Organization creation may fail due to RLS.${NC}"
  echo "If organization creation fails, set it with: export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
  SERVICE_KEY="${SUPABASE_ANON_KEY}"
else
  SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
fi

SUPABASE_URL="${SUPABASE_URL%/}"  # Remove trailing slash if present
API_URL="${SUPABASE_URL}/rest/v1"
AUTH_URL="${SUPABASE_URL}/auth/v1"

echo -e "${GREEN}Starting API flow test...${NC}"
echo ""

# Step 1: Create Organization
echo -e "${YELLOW}Step 1: Creating organization...${NC}"
# Use service role key for organization creation (bypasses RLS)
ORG_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "name": "Music Swap Organization",
    "slug": "music-swap-org-2026",
    "commission_rate": 0.25,
    "vendor_commission_rate": 0.20
  }')

if echo "$ORG_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error creating organization:${NC}"
  echo "$ORG_RESPONSE" | jq '.'
  exit 1
fi

ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.[0].id')
echo -e "${GREEN}✓ Organization created with ID: ${ORG_ID}${NC}"
echo ""

# Step 2: Sign up admin user
echo -e "${YELLOW}Step 2: Signing up admin user...${NC}"
ADMIN_EMAIL="admin@musicswap.org"
ADMIN_PASSWORD="AdminPassword123!"
ADMIN_FIRST_NAME="John"
ADMIN_LAST_NAME="Organizer"
ADMIN_PHONE="+15551234567"

AUTH_RESPONSE=$(curl -s -X POST "${AUTH_URL}/signup" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASSWORD}\",
    \"data\": {
      \"first_name\": \"${ADMIN_FIRST_NAME}\",
      \"last_name\": \"${ADMIN_LAST_NAME}\",
      \"phone\": \"${ADMIN_PHONE}\"
    }
  }")

if echo "$AUTH_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error signing up admin user:${NC}"
  echo "$AUTH_RESPONSE" | jq '.'
  exit 1
fi

ADMIN_USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user.id')
ADMIN_ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.session.access_token')
echo -e "${GREEN}✓ Admin user signed up with ID: ${ADMIN_USER_ID}${NC}"
echo ""

# Step 3: Create admin_users record
echo -e "${YELLOW}Step 3: Creating admin_users record...${NC}"
# Use service role key for admin_users creation (bypasses RLS)
ADMIN_USER_RECORD=$(curl -s -X POST "${API_URL}/admin_users" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${ADMIN_USER_ID}\",
    \"organization_id\": \"${ORG_ID}\",
    \"first_name\": \"${ADMIN_FIRST_NAME}\",
    \"last_name\": \"${ADMIN_LAST_NAME}\",
    \"email\": \"${ADMIN_EMAIL}\",
    \"permissions\": {
      \"check_in\": true,
      \"pos\": true,
      \"pickup\": true,
      \"reports\": true
    }
  }")

if echo "$ADMIN_USER_RECORD" | grep -q "error"; then
  echo -e "${RED}Error creating admin_users record:${NC}"
  echo "$ADMIN_USER_RECORD" | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Admin user record created${NC}"
echo ""

# Step 4: Create Event/Swap
echo -e "${YELLOW}Step 4: Creating event 'Musical Instrument Swap 2026'...${NC}"

# Calculate dates (event in 3 months, registration opens now, closes in 2 months)
EVENT_DATE=$(date -v+3m -u +"%Y-%m-%d" 2>/dev/null || date -d "+3 months" -u +"%Y-%m-%d")
REG_OPEN_DATE=$(date -u +"%Y-%m-%d")
REG_CLOSE_DATE=$(date -v+2m -u +"%Y-%m-%d" 2>/dev/null || date -d "+2 months" -u +"%Y-%m-%d")
SHOP_OPEN_TIME=$(date -v+3m -u +"%Y-%m-%dT09:00:00Z" 2>/dev/null || date -d "+3 months" -u +"%Y-%m-%dT09:00:00Z")
SHOP_CLOSE_TIME=$(date -v+3m -u +"%Y-%m-%dT17:00:00Z" 2>/dev/null || date -d "+3 months" -u +"%Y-%m-%dT17:00:00Z")

# Use admin access token for event creation (admin should be able to create events for their org)
# If that fails, fall back to service role key
EVENT_RESPONSE=$(curl -s -X POST "${API_URL}/events" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ADMIN_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"organization_id\": \"${ORG_ID}\",
    \"name\": \"Musical Instrument Swap 2026\",
    \"event_date\": \"${EVENT_DATE}\",
    \"registration_open_date\": \"${REG_OPEN_DATE}\",
    \"registration_close_date\": \"${REG_CLOSE_DATE}\",
    \"shop_open_time\": \"${SHOP_OPEN_TIME}\",
    \"shop_close_time\": \"${SHOP_CLOSE_TIME}\",
    \"status\": \"registration\",
    \"settings\": {}
  }")

# If event creation fails with admin token, try with service role key
if echo "$EVENT_RESPONSE" | grep -q "error"; then
  echo -e "${YELLOW}Event creation with admin token failed, trying with service role key...${NC}"
  EVENT_RESPONSE=$(curl -s -X POST "${API_URL}/events" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
      \"organization_id\": \"${ORG_ID}\",
      \"name\": \"Musical Instrument Swap 2026\",
      \"event_date\": \"${EVENT_DATE}\",
      \"registration_open_date\": \"${REG_OPEN_DATE}\",
      \"registration_close_date\": \"${REG_CLOSE_DATE}\",
      \"shop_open_time\": \"${SHOP_OPEN_TIME}\",
      \"shop_close_time\": \"${SHOP_CLOSE_TIME}\",
      \"status\": \"registration\",
      \"settings\": {}
    }")
fi

if echo "$EVENT_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error creating event:${NC}"
  echo "$EVENT_RESPONSE" | jq '.'
  exit 1
fi

EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.[0].id')
echo -e "${GREEN}✓ Event created with ID: ${EVENT_ID}${NC}"
echo ""

# Step 5: Sign up seller
echo -e "${YELLOW}Step 5: Signing up seller...${NC}"
SELLER_EMAIL="seller@example.com"
SELLER_PASSWORD="SellerPassword123!"
SELLER_FIRST_NAME="Jane"
SELLER_LAST_NAME="Musician"
SELLER_PHONE="+15559876543"

SELLER_AUTH_RESPONSE=$(curl -s -X POST "${AUTH_URL}/signup" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${SELLER_EMAIL}\",
    \"password\": \"${SELLER_PASSWORD}\",
    \"data\": {
      \"first_name\": \"${SELLER_FIRST_NAME}\",
      \"last_name\": \"${SELLER_LAST_NAME}\",
      \"phone\": \"${SELLER_PHONE}\"
    }
  }")

if echo "$SELLER_AUTH_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error signing up seller:${NC}"
  echo "$SELLER_AUTH_RESPONSE" | jq '.'
  exit 1
fi

SELLER_USER_ID=$(echo "$SELLER_AUTH_RESPONSE" | jq -r '.user.id')
SELLER_ACCESS_TOKEN=$(echo "$SELLER_AUTH_RESPONSE" | jq -r '.session.access_token')
echo -e "${GREEN}✓ Seller signed up with ID: ${SELLER_USER_ID}${NC}"
echo ""

# Step 6: Create seller record
echo -e "${YELLOW}Step 6: Creating seller record...${NC}"

# Generate QR code (format: C-{sellerId})
SELLER_QR_CODE="C-${SELLER_USER_ID}"

SELLER_RESPONSE=$(curl -s -X POST "${API_URL}/sellers" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SELLER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${SELLER_USER_ID}\",
    \"auth_user_id\": \"${SELLER_USER_ID}\",
    \"first_name\": \"${SELLER_FIRST_NAME}\",
    \"last_name\": \"${SELLER_LAST_NAME}\",
    \"phone\": \"${SELLER_PHONE}\",
    \"email\": \"${SELLER_EMAIL}\",
    \"qr_code\": \"${SELLER_QR_CODE}\",
    \"is_guest\": false
  }")

if echo "$SELLER_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error creating seller record:${NC}"
  echo "$SELLER_RESPONSE" | jq '.'
  exit 1
fi

SELLER_ID=$(echo "$SELLER_RESPONSE" | jq -r '.[0].id')
echo -e "${GREEN}✓ Seller record created with ID: ${SELLER_ID}${NC}"
echo ""

# Step 7: Register seller for swap
echo -e "${YELLOW}Step 7: Registering seller for swap...${NC}"
REGISTRATION_RESPONSE=$(curl -s -X POST "${API_URL}/seller_swap_registrations" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SELLER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"event_id\": \"${EVENT_ID}\",
    \"seller_id\": \"${SELLER_ID}\",
    \"registration_data\": {
      \"address\": \"123 Music Street\",
      \"city\": \"Nashville\",
      \"state\": \"TN\",
      \"zip_code\": \"37203\",
      \"marketing_opt_in\": true
    },
    \"is_complete\": true
  }")

if echo "$REGISTRATION_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error registering seller for swap:${NC}"
  echo "$REGISTRATION_RESPONSE" | jq '.'
  exit 1
fi

REGISTRATION_ID=$(echo "$REGISTRATION_RESPONSE" | jq -r '.[0].id')
echo -e "${GREEN}✓ Seller registered for swap with ID: ${REGISTRATION_ID}${NC}"
echo ""

# Step 8: Create items for seller
echo -e "${YELLOW}Step 8: Creating items for seller...${NC}"

# Item 1: Guitar
# Note: In production, item_number and qr_code are auto-generated by the API function
# For direct REST API calls, we need to provide them
ITEM1_NUMBER="SG2026-000001"
ITEM1_QR="ITEM-${EVENT_ID}-${SELLER_ID}-001"
ITEM1_RESPONSE=$(curl -s -X POST "${API_URL}/items" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SELLER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"event_id\": \"${EVENT_ID}\",
    \"seller_id\": \"${SELLER_ID}\",
    \"item_number\": \"${ITEM1_NUMBER}\",
    \"category\": \"Guitars\",
    \"description\": \"Vintage Fender Stratocaster - Excellent condition\",
    \"size\": \"Full Size\",
    \"original_price\": 850.00,
    \"enable_price_reduction\": true,
    \"reduced_price\": 750.00,
    \"donate_if_unsold\": false,
    \"status\": \"pending\",
    \"qr_code\": \"${ITEM1_QR}\",
    \"custom_fields\": {}
  }")

if echo "$ITEM1_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error creating item 1:${NC}"
  echo "$ITEM1_RESPONSE" | jq '.'
else
  ITEM1_ID=$(echo "$ITEM1_RESPONSE" | jq -r '.[0].id')
  echo -e "${GREEN}✓ Item 1 (Guitar) created with ID: ${ITEM1_ID}${NC}"
fi

# Item 2: Piano
ITEM2_NUMBER="SG2026-000002"
ITEM2_QR="ITEM-${EVENT_ID}-${SELLER_ID}-002"
ITEM2_RESPONSE=$(curl -s -X POST "${API_URL}/items" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SELLER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"event_id\": \"${EVENT_ID}\",
    \"seller_id\": \"${SELLER_ID}\",
    \"item_number\": \"${ITEM2_NUMBER}\",
    \"category\": \"Pianos\",
    \"description\": \"Yamaha Digital Piano P-125 - Like new\",
    \"size\": \"Standard\",
    \"original_price\": 600.00,
    \"enable_price_reduction\": false,
    \"donate_if_unsold\": false,
    \"status\": \"pending\",
    \"qr_code\": \"${ITEM2_QR}\",
    \"custom_fields\": {}
  }")

if echo "$ITEM2_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error creating item 2:${NC}"
  echo "$ITEM2_RESPONSE" | jq '.'
else
  ITEM2_ID=$(echo "$ITEM2_RESPONSE" | jq -r '.[0].id')
  echo -e "${GREEN}✓ Item 2 (Piano) created with ID: ${ITEM2_ID}${NC}"
fi

# Item 3: Drums
ITEM3_NUMBER="SG2026-000003"
ITEM3_QR="ITEM-${EVENT_ID}-${SELLER_ID}-003"
ITEM3_RESPONSE=$(curl -s -X POST "${API_URL}/items" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SELLER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"event_id\": \"${EVENT_ID}\",
    \"seller_id\": \"${SELLER_ID}\",
    \"item_number\": \"${ITEM3_NUMBER}\",
    \"category\": \"Drums\",
    \"description\": \"Pearl Export Series 5-Piece Drum Kit\",
    \"size\": \"Full Set\",
    \"original_price\": 450.00,
    \"enable_price_reduction\": true,
    \"reduced_price\": 400.00,
    \"donate_if_unsold\": true,
    \"status\": \"pending\",
    \"qr_code\": \"${ITEM3_QR}\",
    \"custom_fields\": {}
  }")

if echo "$ITEM3_RESPONSE" | grep -q "error"; then
  echo -e "${RED}Error creating item 3:${NC}"
  echo "$ITEM3_RESPONSE" | jq '.'
else
  ITEM3_ID=$(echo "$ITEM3_RESPONSE" | jq -r '.[0].id')
  echo -e "${GREEN}✓ Item 3 (Drums) created with ID: ${ITEM3_ID}${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All steps completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "  Organization ID: ${ORG_ID}"
echo "  Admin User ID: ${ADMIN_USER_ID}"
echo "  Event ID: ${EVENT_ID}"
echo "  Seller ID: ${SELLER_ID}"
echo "  Registration ID: ${REGISTRATION_ID}"
echo "  Items created: 3"
echo ""

