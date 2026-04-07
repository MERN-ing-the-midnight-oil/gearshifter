-- Migration to support guest/walk-in sellers who don't have the app
-- Allows org users to create seller records and item tags for sellers without accounts

-- Step 1: Add new columns for guest seller support
ALTER TABLE sellers
  ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN photo_id_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN photo_id_verified_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN photo_id_verified_at TIMESTAMPTZ;

-- Step 2: Migrate existing data
-- For existing sellers, auth_user_id = id (they have accounts)
-- is_guest = false (they have accounts)
UPDATE sellers SET auth_user_id = id, is_guest = false WHERE id IS NOT NULL;

-- Step 3: Drop the foreign key constraint on id
-- This allows id to be independent of auth.users
ALTER TABLE sellers DROP CONSTRAINT sellers_id_fkey;

-- Step 4: Create unique constraint on auth_user_id (only one seller per auth user)
CREATE UNIQUE INDEX idx_sellers_auth_user_id ON sellers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Step 5: Add indexes for faster lookups
CREATE INDEX idx_sellers_auth_user_id_lookup ON sellers(auth_user_id);
CREATE INDEX idx_sellers_is_guest ON sellers(is_guest);

-- Step 6: Make phone not unique (guest sellers might not have unique phones)
-- Actually, let's keep phone unique but allow NULL for guest sellers
-- Or we can make it unique only for non-guest sellers
-- For now, let's keep it unique but handle duplicates in application logic

-- Add comments explaining the structure
COMMENT ON COLUMN sellers.id IS 'Seller ID (UUID, primary key, independent of auth.users)';
COMMENT ON COLUMN sellers.auth_user_id IS 'Link to auth.users if seller has an authenticated account (nullable)';
COMMENT ON COLUMN sellers.is_guest IS 'True if seller does not have an authenticated account (walk-in seller)';

