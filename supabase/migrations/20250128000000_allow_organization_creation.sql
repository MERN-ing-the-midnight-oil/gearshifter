-- Allow authenticated users to create organizations
-- This is needed for the organizer signup flow
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

