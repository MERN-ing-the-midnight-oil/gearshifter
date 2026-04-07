-- Create admin user record
-- Run this AFTER creating the auth user in Supabase Auth
-- 
-- Steps:
-- 1. Go to: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/auth/users
-- 2. Click "Add user" → "Create new user"
-- 3. Enter email and password, then click "Create user"
-- 4. Copy the User UID (UUID) from the user details page
-- 5. Replace 'YOUR_AUTH_USER_ID_HERE' below with that UUID
-- 6. Update the first_name, last_name, and email below
-- 7. Run this SQL script

-- Make sure organization exists
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- Create admin_users record
-- REPLACE 'YOUR_AUTH_USER_ID_HERE' with the UUID from Supabase Auth
-- REPLACE the name and email with your actual info
INSERT INTO admin_users (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  permissions
)
VALUES (
  'YOUR_AUTH_USER_ID_HERE',  -- ⚠️ REPLACE THIS with your auth user UUID
  '11111111-1111-1111-1111-111111111111',  -- Bellingham Ski Swap org
  'Your',  -- ⚠️ REPLACE with your first name
  'Name',  -- ⚠️ REPLACE with your last name
  'admin@example.com',  -- ⚠️ REPLACE with your email (must match auth.users email)
  '{"check_in": true, "pos": true, "pickup": true, "reports": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  email = EXCLUDED.email;

-- Verify it worked
SELECT 
  au.id,
  au.email,
  au.first_name,
  au.last_name,
  o.name as organization_name
FROM admin_users au
JOIN organizations o ON au.organization_id = o.id
WHERE au.id = 'YOUR_AUTH_USER_ID_HERE';  -- ⚠️ REPLACE with your auth user UUID

