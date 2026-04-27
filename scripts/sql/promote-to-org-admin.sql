-- Promote an organizer account to full admin (role + full org access).
-- Use when someone was created as volunteer or has mismatched is_org_admin.
-- Supabase → SQL Editor → replace email → Run.
--
-- Your display name (e.g. "Admin User") is just first_name/last_name; it does NOT set role.

-- Preview current row
SELECT id, email, first_name, last_name, role, is_org_admin, organization_id
FROM admin_users
WHERE email = 'merningthemidnightoil@gmail.com';

-- Promote to admin with full org powers (can invite staff, manage settings)
UPDATE admin_users
SET
  role = 'admin'::org_user_role,
  is_org_admin = true,
  permissions = jsonb_build_object(
    'stations',
    jsonb_build_object(
      'check_in', true,
      'pos', true,
      'pickup', true,
      'reports', true
    )
  )
WHERE email = 'merningthemidnightoil@gmail.com';

-- Verify
SELECT id, email, first_name, last_name, role, is_org_admin
FROM admin_users
WHERE email = 'merningthemidnightoil@gmail.com';
