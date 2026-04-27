-- Phone-authenticated sellers need to discover and claim an existing guest (walk-up)
-- seller row that was created with the same phone number. Default seller RLS only
-- exposes rows where auth_user_id = auth.uid(), which hides guest rows.

-- SELECT: allow the signed-in phone user to see a claimable guest row for their JWT phone.
CREATE POLICY "Users can view guest seller matching phone"
  ON sellers FOR SELECT
  USING (
    is_guest = true
    AND auth_user_id IS NULL
    AND phone IS NOT NULL
    AND phone = (auth.jwt() ->> 'phone')
  );

-- UPDATE: allow claiming that row by attaching auth.uid() and clearing guest flag.
CREATE POLICY "Users can link guest seller matching phone"
  ON sellers FOR UPDATE
  USING (
    is_guest = true
    AND auth_user_id IS NULL
    AND phone IS NOT NULL
    AND phone = (auth.jwt() ->> 'phone')
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    AND is_guest = false
  );
