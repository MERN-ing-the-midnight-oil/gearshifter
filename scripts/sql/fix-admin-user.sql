-- Fix missing admin_users record for authenticated user
-- This script creates the admin_users record for user ID: 27179973-ea50-4ee7-8e49-d8220cc31bd5
-- 
-- Before running:
-- 1. First, run the query below to get your email from auth.users
-- 2. Update the email, first_name, and last_name in the INSERT statement
-- 3. Run this entire script in Supabase SQL Editor

-- First, let's check what email is associated with your auth user
SELECT 
  id,
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  created_at
FROM auth.users
WHERE id = '27179973-ea50-4ee7-8e49-d8220cc31bd5';

-- Ensure the organization exists (from seed data)
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- Create admin_users record for your authenticated user
-- ⚠️ UPDATE: Replace the email, first_name, and last_name with your actual information
INSERT INTO admin_users (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  permissions
)
VALUES (
  '27179973-ea50-4ee7-8e49-d8220cc31bd5',  -- Your auth user ID
  '11111111-1111-1111-1111-111111111111',  -- Bellingham Ski Swap org
  'Your',  -- ⚠️ REPLACE with your first name
  'Name',  -- ⚠️ REPLACE with your last name
  'your.email@example.com',  -- ⚠️ REPLACE with your email (must match auth.users email)
  '{"check_in": true, "pos": true, "pickup": true, "reports": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name;

-- Verify it worked
SELECT 
  au.id,
  au.email,
  au.first_name,
  au.last_name,
  o.name as organization_name,
  o.id as organization_id
FROM admin_users au
JOIN organizations o ON au.organization_id = o.id
WHERE au.id = '27179973-ea50-4ee7-8e49-d8220cc31bd5';

