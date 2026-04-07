-- Create admin user "Anthony Admin" (password: asdfasdf)
-- Run this AFTER creating the auth user in Supabase:
--   Dashboard → Authentication → Users → Add user → Create new user
--   Email: anthony.admin@example.com
--   Password: asdfasdf
-- Then run this script in SQL Editor.

-- Ensure default organization exists
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- Link auth user to admin_users (by email)
INSERT INTO admin_users (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  permissions,
  role,
  is_org_admin
)
SELECT 
  au.id,
  '11111111-1111-1111-1111-111111111111',
  'Anthony',
  'Admin',
  au.email,
  '{"stations": {"check_in": true, "pos": true, "pickup": true, "reports": true}}'::jsonb,
  'admin'::org_user_role,
  true
FROM auth.users au
WHERE au.email = 'anthony.admin@example.com'
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  permissions = EXCLUDED.permissions,
  role = EXCLUDED.role,
  is_org_admin = EXCLUDED.is_org_admin;

-- Verify
SELECT au.id, au.email, au.first_name, au.last_name, au.role, au.is_org_admin, o.name AS organization_name
FROM admin_users au
JOIN organizations o ON au.organization_id = o.id
WHERE au.email = 'anthony.admin@example.com';
