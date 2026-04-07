-- Replace admin user for cryptic.colors@gmail.com with fresh admin_users record
-- This keeps the same auth user and password, just recreates the admin_users record
-- 
-- Run this in Supabase SQL Editor

-- Step 1: Find the auth user by email and show their info
SELECT 
  id,
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  created_at
FROM auth.users
WHERE email = 'cryptic.colors@gmail.com';

-- Step 2: Delete any existing admin_users record for this email
-- (This will find the user by email and delete their admin_users record)
DELETE FROM admin_users
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'cryptic.colors@gmail.com'
);

-- Step 3: Ensure the organization exists (from seed data)
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- Step 4: Create fresh admin_users record
-- This uses the auth user's ID and email, with default permissions
INSERT INTO admin_users (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  permissions
)
SELECT 
  au.id,
  '11111111-1111-1111-1111-111111111111',  -- Bellingham Ski Swap org
  COALESCE(au.raw_user_meta_data->>'first_name', 'Admin') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', 'User') as last_name,
  au.email,
  '{"check_in": true, "pos": true, "pickup": true, "reports": true}'::jsonb
FROM auth.users au
WHERE au.email = 'cryptic.colors@gmail.com';

-- Step 5: Verify it worked
SELECT 
  au.id,
  au.email,
  au.first_name,
  au.last_name,
  o.name as organization_name,
  o.id as organization_id,
  au.permissions,
  au.created_at
FROM admin_users au
JOIN organizations o ON au.organization_id = o.id
WHERE au.email = 'cryptic.colors@gmail.com';

