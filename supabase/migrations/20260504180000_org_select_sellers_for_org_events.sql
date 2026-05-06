-- Organizer app lists registered sellers by loading seller_swap_registrations (allowed for org users)
-- then sellers by id. Sellers SELECT was only self + guest-phone-claim, so names never resolved.

CREATE POLICY "Org users can view sellers linked to their organization"
  ON sellers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM seller_swap_registrations ssr
      INNER JOIN events e ON e.id = ssr.event_id
      WHERE ssr.seller_id = sellers.id
        AND user_is_org_user_for_org(e.organization_id)
    )
    OR EXISTS (
      SELECT 1
      FROM items i
      INNER JOIN events e ON e.id = i.event_id
      WHERE i.seller_id = sellers.id
        AND user_is_org_user_for_org(e.organization_id)
    )
  );
