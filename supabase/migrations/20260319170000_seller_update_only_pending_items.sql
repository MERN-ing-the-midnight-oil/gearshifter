-- Sellers may only update items that are still pending (not yet handed in).
-- After check-in, org staff use org policies; sellers use delete/edit only while pending.
DROP POLICY IF EXISTS "Sellers can update their own items (before check-in)" ON items;
CREATE POLICY "Sellers can update their own pending items"
  ON items FOR UPDATE
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
    AND status = 'pending'
  );

COMMENT ON POLICY "Sellers can update their own pending items" ON items IS
  'Edit listing details before physical hand-in; org updates after check-in.';
