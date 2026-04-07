-- Add admin_users record by email (no need to look up UUID)
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run
--
-- To use for another user: replace 'merningthemidnightoil@gmail.com' with their email below.

-- Preview: show the auth user that will be linked
SELECT 
  id,
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  created_at
FROM auth.users
WHERE email = 'merningthemidnightoil@gmail.com';

-- Ensure the default organization exists
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- Create admin_users record (links your auth user to the organization)
-- Uses first_name/last_name from signup metadata if present
INSERT INTO admin_users (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  permissions,
  role
)
SELECT 
  au.id,
  '11111111-1111-1111-1111-111111111111',
  COALESCE(au.raw_user_meta_data->>'first_name', 'Admin') AS first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', 'User') AS last_name,
  au.email,
  '{"check_in": true, "pos": true, "pickup": true, "reports": true}'::jsonb,
  'admin'::org_user_role
FROM auth.users au
WHERE au.email = 'merningthemidnightoil@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  permissions = EXCLUDED.permissions,
  role = EXCLUDED.role;

-- Verify
SELECT 
  au.id,
  au.email,
  au.first_name,
  au.last_name,
  au.role,
  o.name AS organization_name
FROM admin_users au
JOIN organizations o ON au.organization_id = o.id
WHERE au.email = 'merningthemidnightoil@gmail.com';
