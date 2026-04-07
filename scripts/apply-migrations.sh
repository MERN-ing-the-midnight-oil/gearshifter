#!/bin/bash

# Script to apply database migrations to Supabase
# Uses the Supabase SQL API endpoint

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required environment variables
if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}Error: SUPABASE_URL environment variable is not set${NC}"
  echo "Please set it with: export SUPABASE_URL='your-supabase-url'"
  exit 1
fi

# Service role key is optional - only needed if applying via API
# For dashboard application, we just need to create the combined file

SUPABASE_URL="${SUPABASE_URL%/}"  # Remove trailing slash if present
API_URL="${SUPABASE_URL}/rest/v1/rpc"

echo -e "${GREEN}Applying database migrations...${NC}"
echo ""

# Migration files in order
MIGRATIONS=(
  "supabase/migrations/20250101000000_init_schema.sql"
  "supabase/migrations/20250102000000_add_rls_policies.sql"
  "supabase/migrations/20250103000000_add_dynamic_fields.sql"
  "supabase/migrations/20250104000000_add_swap_registration_fields.sql"
  "supabase/migrations/20250105000000_add_page_customization_and_tags.sql"
  "supabase/migrations/20250106000000_add_price_reduction_settings.sql"
  "supabase/migrations/20250107000000_support_guest_sellers.sql"
  "supabase/migrations/20250108000000_add_buyer_info_to_transactions.sql"
  "supabase/migrations/20250109000000_add_insert_policies_for_testing.sql"
)

# Actually, we need to use the SQL execution endpoint
# Supabase doesn't have a direct SQL API, so we'll need to use psql or the dashboard
# Let me create a script that uses the Supabase Management API or provides instructions

echo -e "${YELLOW}Note: Supabase migrations are best applied via:${NC}"
echo "1. Supabase Dashboard SQL Editor (recommended)"
echo "2. Supabase CLI (requires login)"
echo "3. Direct psql connection"
echo ""
echo -e "${YELLOW}Since we don't have direct SQL execution via REST API,${NC}"
echo "here's a script that will prepare the migrations for manual application:"
echo ""

# Create a combined migration file
COMBINED_MIGRATION="supabase/combined_migration.sql"
echo "-- Combined Migration File" > "$COMBINED_MIGRATION"
echo "-- Generated on $(date)" >> "$COMBINED_MIGRATION"
echo "-- Apply this file via Supabase Dashboard SQL Editor" >> "$COMBINED_MIGRATION"
echo "" >> "$COMBINED_MIGRATION"

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    echo -e "${YELLOW}Adding: ${migration}${NC}"
    echo "-- ========================================" >> "$COMBINED_MIGRATION"
    echo "-- Migration: $(basename $migration)" >> "$COMBINED_MIGRATION"
    echo "-- ========================================" >> "$COMBINED_MIGRATION"
    cat "$migration" >> "$COMBINED_MIGRATION"
    echo "" >> "$COMBINED_MIGRATION"
    echo "" >> "$COMBINED_MIGRATION"
  else
    echo -e "${RED}Warning: Migration file not found: ${migration}${NC}"
  fi
done

echo ""
echo -e "${GREEN}✓ Combined migration file created: ${COMBINED_MIGRATION}${NC}"
echo ""
echo -e "${YELLOW}To apply migrations:${NC}"
echo "1. Go to: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new"
echo "2. Copy and paste the contents of: ${COMBINED_MIGRATION}"
echo "3. Click 'Run'"
echo ""

