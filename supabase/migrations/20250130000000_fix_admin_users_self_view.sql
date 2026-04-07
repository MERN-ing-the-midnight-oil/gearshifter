-- Migration: Fix admin_users SELECT policy to allow users to view their own record
-- The previous migration removed the policy that allows users to see their own admin_users record
-- This is needed for the app to load user info on login

-- Add policy to allow users to view their own admin_users record
-- This must come BEFORE the admin policy so users can see their own record
CREATE POLICY IF NOT EXISTS "Users can view their own admin_users record"
  ON admin_users FOR SELECT
  USING (id = auth.uid());

-- Note: The "Admins can view org users in their organization" policy from the previous migration
-- will still work for admins viewing other users, but now regular users can also see their own record

