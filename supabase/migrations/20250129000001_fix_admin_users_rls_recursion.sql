-- Migration: Fix RLS recursion in admin_users policies
-- The policies were querying admin_users table directly, causing recursion
-- Use SECURITY DEFINER functions to bypass RLS when checking permissions

-- Create function to get user's organization_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_id UUID;
  org_id UUID;
BEGIN
  user_id := auth.uid();
  
  -- Get organization_id for current user (bypassing RLS)
  SELECT organization_id INTO org_id
  FROM admin_users 
  WHERE id = user_id;
  
  RETURN org_id;
END;
$$;

-- Create function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_id UUID;
  result BOOLEAN;
BEGIN
  user_id := auth.uid();
  
  -- Check if user is admin (bypassing RLS)
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND role = 'admin'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- Drop and recreate policies to use the new functions
DROP POLICY IF EXISTS "Admins can view org users in their organization" ON admin_users;
DROP POLICY IF EXISTS "Admins can create org users in their organization" ON admin_users;
DROP POLICY IF EXISTS "Admins can update org users in their organization" ON admin_users;
DROP POLICY IF EXISTS "Admins can delete org users in their organization" ON admin_users;

-- View: Users can see their own record, admins can see all org users in their organization
CREATE POLICY "Admins can view org users in their organization"
  ON admin_users FOR SELECT
  USING (
    is_user_admin() 
    AND organization_id = get_user_organization_id()
  );

-- Insert: Only admins can create new org user accounts
CREATE POLICY "Admins can create org users in their organization"
  ON admin_users FOR INSERT
  WITH CHECK (
    -- Allow if user is creating their own record (for first admin signup)
    id = auth.uid()
    OR
    -- Allow if user is an admin in the same organization (using function to avoid recursion)
    (is_user_admin() AND organization_id = get_user_organization_id())
  );

-- Update: Only admins can update org user records (including role changes)
CREATE POLICY "Admins can update org users in their organization"
  ON admin_users FOR UPDATE
  USING (
    is_user_admin() 
    AND organization_id = get_user_organization_id()
  );

-- Delete: Only admins can delete org user accounts
CREATE POLICY "Admins can delete org users in their organization"
  ON admin_users FOR DELETE
  USING (
    is_user_admin() 
    AND organization_id = get_user_organization_id()
  );

