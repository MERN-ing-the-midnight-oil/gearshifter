-- Link Axel test admin to Bellingham Ski Swap (after auth user exists).
-- Use if you created the user in Dashboard → Authentication → Users instead of `yarn create:axel-admin`.
--
-- 1. Create user in Supabase: email axel.admin@bellingham-skiswap.test, password asdfasdf.
-- 2. Run this in SQL Editor.

INSERT INTO admin_users (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  role,
  is_org_admin,
  permissions
)
SELECT
  au.id,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Axel',
  'Admin',
  'axel.admin@bellingham-skiswap.test',
  'admin'::org_user_role,
  true,
  '{"stations":{"check_in":true,"pos":true,"pickup":true,"reports":true}}'::jsonb
FROM auth.users au
WHERE au.email = 'axel.admin@bellingham-skiswap.test'
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_org_admin = EXCLUDED.is_org_admin,
  permissions = EXCLUDED.permissions;

SELECT id, email, first_name, last_name, role, is_org_admin FROM admin_users
WHERE email = 'axel.admin@bellingham-skiswap.test';
