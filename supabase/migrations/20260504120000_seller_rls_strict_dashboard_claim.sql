-- Strict seller dashboard: JWT must include app_metadata.seller_dashboard_event_id (no legacy null-claim path).
-- Remove redundant seller event SELECT policy (public invite policy still allows event reads where configured).

CREATE OR REPLACE FUNCTION public.seller_dashboard_event_scope_matches(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.auth_seller_dashboard_event_id() IS NOT NULL
    AND p_event_id = public.auth_seller_dashboard_event_id();
$$;

COMMENT ON FUNCTION public.seller_dashboard_event_scope_matches(uuid) IS
  'True only when JWT has seller_dashboard_event_id and row event_id matches.';

-- ========== catalog: scoped org only (no items-join fallback) ==========
DROP POLICY IF EXISTS "Sellers can view categories for their events" ON item_categories;
CREATE POLICY "Sellers can view categories for their events"
  ON item_categories FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    AND public.auth_seller_dashboard_event_id() IS NOT NULL
    AND public.organization_id_for_seller_dashboard_event() IS NOT NULL
    AND organization_id = public.organization_id_for_seller_dashboard_event()
  );

DROP POLICY IF EXISTS "Sellers can view field definitions for their events" ON item_field_definitions;
CREATE POLICY "Sellers can view field definitions for their events"
  ON item_field_definitions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    AND public.auth_seller_dashboard_event_id() IS NOT NULL
    AND public.organization_id_for_seller_dashboard_event() IS NOT NULL
    AND organization_id = public.organization_id_for_seller_dashboard_event()
  );

DROP POLICY IF EXISTS "Sellers can view tag templates for their events" ON gear_tag_templates;
CREATE POLICY "Sellers can view tag templates for their events"
  ON gear_tag_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.auth_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    AND public.auth_seller_dashboard_event_id() IS NOT NULL
    AND public.organization_id_for_seller_dashboard_event() IS NOT NULL
    AND organization_id = public.organization_id_for_seller_dashboard_event()
  );

DROP POLICY IF EXISTS "Sellers can view events they have items in" ON events;
