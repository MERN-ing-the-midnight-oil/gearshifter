-- Migration: Fix infinite recursion in events INSERT policy (v2)
-- This version uses a simpler approach that avoids recursion entirely
-- by using a SECURITY DEFINER function that bypasses RLS

-- Drop ALL existing events INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can create events for their organization" ON events;

-- Drop any existing functions
DROP FUNCTION IF EXISTS is_admin_for_organization(UUID);
DROP FUNCTION IF EXISTS check_admin_for_org(UUID, UUID);

-- Create a function that uses SECURITY DEFINER to bypass RLS
-- This function runs with the privileges of the function owner (postgres)
CREATE OR REPLACE FUNCTION user_is_admin_for_org(org_id UUID)
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
  -- Get the current user ID
  user_id := auth.uid();
  
  -- SECURITY DEFINER means this runs as postgres, bypassing RLS
  -- Query admin_users directly without RLS checks
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND organization_id = org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_is_admin_for_org(UUID) TO authenticated;

-- Create the policy using the function
-- The function bypasses RLS, so no recursion occurs
CREATE POLICY "Admins can create events for their organization"
  ON events FOR INSERT
  WITH CHECK (user_is_admin_for_org(organization_id));

