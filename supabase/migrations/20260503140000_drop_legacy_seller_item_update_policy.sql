-- If this database never applied 20260319170000_seller_update_only_pending_items.sql, the old UPDATE
-- policy name can still exist alongside the dashboard-scoped policy from 20260503120000. Postgres ORs
-- permissive policies, so the legacy policy would weaken RLS. Drop it if present.

DROP POLICY IF EXISTS "Sellers can update their own items (before check-in)" ON items;
