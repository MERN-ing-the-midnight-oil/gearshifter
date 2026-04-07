-- Fix RLS policy for sellers to use auth_user_id instead of id
-- The sellers table was migrated to support guest sellers, so id is no longer tied to auth.users
-- We need to check auth_user_id instead

-- Drop the old policy
DROP POLICY IF EXISTS "Sellers can browse all events" ON events;

-- Recreate the policy using auth_user_id
CREATE POLICY "Sellers can browse all events"
  ON events FOR SELECT
  USING (
    -- Allow if user is authenticated as a seller (has a seller record with matching auth_user_id)
    EXISTS (
      SELECT 1 FROM sellers WHERE auth_user_id = auth.uid()
    )
    -- Exclude admins (they use the admin policy above)
    AND NOT EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

-- Also fix the seller policies to use auth_user_id
DROP POLICY IF EXISTS "Users can view their own seller record" ON sellers;
DROP POLICY IF EXISTS "Users can insert their own seller record" ON sellers;
DROP POLICY IF EXISTS "Users can update their own seller record" ON sellers;

CREATE POLICY "Users can view their own seller record"
  ON sellers FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own seller record"
  ON sellers FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own seller record"
  ON sellers FOR UPDATE
  USING (auth_user_id = auth.uid());

