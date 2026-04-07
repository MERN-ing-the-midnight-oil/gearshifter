-- Guest-seller migration made sellers.id independent of auth.users (items.seller_id -> sellers.id).
-- Legacy RLS still required items.seller_id = auth.uid() and sellers.id = auth.uid(), which breaks
-- authenticated sellers whose profile row id != auth user id.

-- Helper used by some policies / clients: must match sellers.id, not auth uid
CREATE OR REPLACE FUNCTION seller_has_items_in_event(event_id UUID)
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
  SELECT EXISTS (
    SELECT 1
    FROM items i
    WHERE i.event_id = seller_has_items_in_event.event_id
      AND i.seller_id IN (
        SELECT s.id FROM sellers s WHERE s.auth_user_id = user_id
      )
  )
  INTO result;
  RETURN COALESCE(result, false);
END;
$$;

-- ========== sellers: own row by auth link ==========
DROP POLICY IF EXISTS "Users can view their own seller record" ON sellers;
CREATE POLICY "Users can view their own seller record"
  ON sellers FOR SELECT
  USING (auth_user_id = auth.uid() OR id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own seller record" ON sellers;
CREATE POLICY "Users can insert their own seller record"
  ON sellers FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own seller record" ON sellers;
CREATE POLICY "Users can update their own seller record"
  ON sellers FOR UPDATE
  USING (auth_user_id = auth.uid() OR id = auth.uid());

-- ========== items: seller access via sellers.auth_user_id ==========
DROP POLICY IF EXISTS "Sellers can view their own items" ON items;
CREATE POLICY "Sellers can view their own items"
  ON items FOR SELECT
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can insert their own items" ON items;
CREATE POLICY "Sellers can insert their own items"
  ON items FOR INSERT
  WITH CHECK (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can update their own items (before check-in)" ON items;
CREATE POLICY "Sellers can update their own items (before check-in)"
  ON items FOR UPDATE
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
    AND status IN ('pending', 'checked_in')
  );

-- ========== events: browsing + "items in event" ==========
DROP POLICY IF EXISTS "Sellers can browse all events" ON events;
CREATE POLICY "Sellers can browse all events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sellers s
      WHERE s.auth_user_id = auth.uid() OR s.id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can view events they have items in" ON events;
CREATE POLICY "Sellers can view events they have items in"
  ON events FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT i.event_id
      FROM items i
      WHERE i.seller_id IN (
        SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
      )
    )
  );

-- ========== transactions / payouts: seller_id -> sellers.id ==========
DROP POLICY IF EXISTS "Sellers can view their own transactions" ON transactions;
CREATE POLICY "Sellers can view their own transactions"
  ON transactions FOR SELECT
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can view their own payouts" ON payouts;
CREATE POLICY "Sellers can view their own payouts"
  ON payouts FOR SELECT
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );

-- ========== catalog / registration: joins that used items.seller_id = auth.uid() ==========
DROP POLICY IF EXISTS "Sellers can view categories for their events" ON item_categories;
CREATE POLICY "Sellers can view categories for their events"
  ON item_categories FOR SELECT
  USING (
    organization_id IN (
      SELECT DISTINCT e.organization_id
      FROM events e
      JOIN items i ON e.id = i.event_id
      WHERE i.seller_id IN (
        SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Sellers can view field definitions for their events" ON item_field_definitions;
CREATE POLICY "Sellers can view field definitions for their events"
  ON item_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT DISTINCT e.organization_id
      FROM events e
      JOIN items i ON e.id = i.event_id
      WHERE i.seller_id IN (
        SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Sellers can view tag templates for their events" ON gear_tag_templates;
CREATE POLICY "Sellers can view tag templates for their events"
  ON gear_tag_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT DISTINCT e.organization_id
      FROM events e
      JOIN items i ON e.id = i.event_id
      WHERE i.seller_id IN (
        SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Sellers can view their own swap registrations" ON seller_swap_registrations;
CREATE POLICY "Sellers can view their own swap registrations"
  ON seller_swap_registrations FOR SELECT
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can insert their own swap registrations" ON seller_swap_registrations;
CREATE POLICY "Sellers can insert their own swap registrations"
  ON seller_swap_registrations FOR INSERT
  WITH CHECK (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can update their own swap registrations" ON seller_swap_registrations;
CREATE POLICY "Sellers can update their own swap registrations"
  ON seller_swap_registrations FOR UPDATE
  USING (
    seller_id IN (
      SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid()
    )
  );
