-- Sellers may delete their own items only while still pending (not yet handed in at check-in).
DROP POLICY IF EXISTS "Sellers can delete their own pending items" ON items;
CREATE POLICY "Sellers can delete their own pending items"
  ON items FOR DELETE
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
    AND status = 'pending'
  );

COMMENT ON POLICY "Sellers can delete their own pending items" ON items IS
  'Remove a registration before physical hand-in; org-owned inventory uses UPDATE after check-in.';
