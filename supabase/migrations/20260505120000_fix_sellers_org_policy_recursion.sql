-- Fix: infinite recursion detected in policy for relation "sellers" (42P17)
-- Cause: "Org users can view sellers linked to their organization" used EXISTS over items.
-- Items RLS for sellers uses `seller_id IN (SELECT id FROM sellers WHERE auth_user_id = auth.uid())`,
-- which re-enters sellers RLS while the org policy is still evaluating -> recursion.
--
-- Fix: evaluate org↔seller linkage in a SECURITY DEFINER helper so items/events are read without RLS.

CREATE OR REPLACE FUNCTION public.org_user_can_select_seller_row(p_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.seller_swap_registrations ssr
      INNER JOIN public.events e ON e.id = ssr.event_id
      WHERE ssr.seller_id = p_seller_id
        AND public.user_is_org_user_for_org(e.organization_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.items i
      INNER JOIN public.events e ON e.id = i.event_id
      WHERE i.seller_id = p_seller_id
        AND public.user_is_org_user_for_org(e.organization_id)
    );
$$;

COMMENT ON FUNCTION public.org_user_can_select_seller_row(uuid) IS
  'Org staff may SELECT a seller row if linked via swap registration or item in an org event; SECURITY DEFINER avoids sellers↔items RLS recursion.';

GRANT EXECUTE ON FUNCTION public.org_user_can_select_seller_row(uuid) TO authenticated;

DROP POLICY IF EXISTS "Org users can view sellers linked to their organization" ON public.sellers;

CREATE POLICY "Org users can view sellers linked to their organization"
  ON public.sellers FOR SELECT
  USING (public.org_user_can_select_seller_row(sellers.id));
