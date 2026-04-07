-- Migration: Fix infinite recursion in admin_users policies
-- The original policies caused recursion because they checked admin_users table
-- while trying to insert/select from admin_users

-- Drop all problematic admin_users policies
DROP POLICY IF EXISTS "Admins can create admin_users in their organization" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admins in their organization" ON admin_users;

-- Create a policy that allows users to create their own admin_users record
-- This is needed for the first admin user creation
CREATE POLICY "Users can create their own admin_users record"
  ON admin_users FOR INSERT
  WITH CHECK (id = auth.uid());

-- Create a simpler SELECT policy that doesn't cause recursion
-- Allow users to see their own admin_users record
CREATE POLICY "Users can view their own admin_users record"
  ON admin_users FOR SELECT
  USING (id = auth.uid());

-- For viewing other admins in the organization, we'll need a different approach
-- This can be done via a database function or service role key
-- For now, admins can only see their own record via RLS
-- Additional admins can be viewed via service role or a function
