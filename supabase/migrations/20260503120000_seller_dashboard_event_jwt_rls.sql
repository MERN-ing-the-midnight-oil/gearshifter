-- Seller dashboard scope: optional JWT app_metadata.seller_dashboard_event_id (UUID).
-- When set, seller row policies restrict rows to that event (one dashboard per auth session).
-- Different events/orgs use a new sign-in session with a new claim.

CREATE OR REPLACE FUNCTION public.auth_seller_dashboard_event_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  raw text;
BEGIN
  raw := auth.jwt() -> 'app_metadata' ->> 'seller_dashboard_event_id';
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN btrim(raw)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.auth_seller_dashboard_event_id() IS
  'UUID from JWT app_metadata.seller_dashboard_event_id; NULL if unset or invalid. Used by seller RLS.';

CREATE OR REPLACE FUNCTION public.seller_dashboard_event_scope_matches(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.auth_seller_dashboard_event_id() IS NULL
    OR p_event_id = public.auth_seller_dashboard_event_id();
$$;

CREATE OR REPLACE FUNCTION public.organization_id_for_seller_dashboard_event()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.organization_id
  FROM events e
  WHERE e.id = public.auth_seller_dashboard_event_id()
  LIMIT 1;
$$;

-- Browse-all list removed; public invite policy + "events they have items in" remain.
DROP POLICY IF EXISTS "Sellers can browse all events" ON events;

-- ========== items ==========
DROP POLICY IF EXISTS "Sellers can view their own items" ON items;
CREATE POLICY "Sellers can view their own items"
  ON items FOR SELECT
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

DROP POLICY IF EXISTS "Sellers can insert their own items" ON items;
CREATE POLICY "Sellers can insert their own items"
  ON items FOR INSERT
  WITH CHECK (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

DROP POLICY IF EXISTS "Sellers can update their own pending items" ON items;
CREATE POLICY "Sellers can update their own pending items"
  ON items FOR UPDATE
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND status = 'pending'
    AND public.seller_dashboard_event_scope_matches(event_id)
  )
  WITH CHECK (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND status = 'pending'
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

DROP POLICY IF EXISTS "Sellers can delete their own pending items" ON items;
CREATE POLICY "Sellers can delete their own pending items"
  ON items FOR DELETE
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND status = 'pending'
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

-- ========== transactions / payouts ==========
DROP POLICY IF EXISTS "Sellers can view their own transactions" ON transactions;
CREATE POLICY "Sellers can view their own transactions"
  ON transactions FOR SELECT
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

DROP POLICY IF EXISTS "Sellers can view their own payouts" ON payouts;
CREATE POLICY "Sellers can view their own payouts"
  ON payouts FOR SELECT
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

-- ========== swap registrations ==========
DROP POLICY IF EXISTS "Sellers can view their own swap registrations" ON seller_swap_registrations;
CREATE POLICY "Sellers can view their own swap registrations"
  ON seller_swap_registrations FOR SELECT
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

DROP POLICY IF EXISTS "Sellers can insert their own swap registrations" ON seller_swap_registrations;
CREATE POLICY "Sellers can insert their own swap registrations"
  ON seller_swap_registrations FOR INSERT
  WITH CHECK (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

DROP POLICY IF EXISTS "Sellers can update their own swap registrations" ON seller_swap_registrations;
CREATE POLICY "Sellers can update their own swap registrations"
  ON seller_swap_registrations FOR UPDATE
  USING (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  )
  WITH CHECK (
    seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND public.seller_dashboard_event_scope_matches(event_id)
  );

-- ========== catalog (org-scoped reads for add-item / register) ==========
-- With JWT scope: allow the scoped event's org (even before first item). Without scope: legacy path via items.
DROP POLICY IF EXISTS "Sellers can view categories for their events" ON item_categories;
CREATE POLICY "Sellers can view categories for their events"
  ON item_categories FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    AND (
      (
        public.auth_seller_dashboard_event_id() IS NOT NULL
        AND public.organization_id_for_seller_dashboard_event() IS NOT NULL
        AND organization_id = public.organization_id_for_seller_dashboard_event()
      )
      OR (
        public.auth_seller_dashboard_event_id() IS NULL
        AND organization_id IN (
          SELECT DISTINCT e.organization_id
          FROM events e
          JOIN items i ON e.id = i.event_id
          WHERE i.seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Sellers can view field definitions for their events" ON item_field_definitions;
CREATE POLICY "Sellers can view field definitions for their events"
  ON item_field_definitions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    AND (
      (
        public.auth_seller_dashboard_event_id() IS NOT NULL
        AND public.organization_id_for_seller_dashboard_event() IS NOT NULL
        AND organization_id = public.organization_id_for_seller_dashboard_event()
      )
      OR (
        public.auth_seller_dashboard_event_id() IS NULL
        AND organization_id IN (
          SELECT DISTINCT e.organization_id
          FROM events e
          JOIN items i ON e.id = i.event_id
          WHERE i.seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Sellers can view tag templates for their events" ON gear_tag_templates;
CREATE POLICY "Sellers can view tag templates for their events"
  ON gear_tag_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    AND (
      (
        public.auth_seller_dashboard_event_id() IS NOT NULL
        AND public.organization_id_for_seller_dashboard_event() IS NOT NULL
        AND organization_id = public.organization_id_for_seller_dashboard_event()
      )
      OR (
        public.auth_seller_dashboard_event_id() IS NULL
        AND organization_id IN (
          SELECT DISTINCT e.organization_id
          FROM events e
          JOIN items i ON e.id = i.event_id
          WHERE i.seller_id IN (SELECT s.id FROM sellers s WHERE s.auth_user_id = auth.uid())
        )
      )
    )
  );

-- ========== RPC: delete pending item respects dashboard scope ==========
CREATE OR REPLACE FUNCTION public.seller_delete_own_pending_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.items i
  WHERE i.id = p_item_id
    AND i.status = 'pending'
    AND i.seller_id IN (
      SELECT s.id FROM public.sellers s WHERE s.auth_user_id = auth.uid()
    )
    AND public.seller_dashboard_event_scope_matches(i.event_id);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;
