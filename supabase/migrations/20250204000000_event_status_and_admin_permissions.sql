-- Migration: Simplify event status and redesign admin permissions
-- 1. Event status: active | closed only; add items_locked
-- 2. Admin users: add is_org_admin; permissions jsonb with stations { check_in, pos, pickup, reports }
-- 3. RLS: enforce pos permission for transactions INSERT, pickup permission for payouts INSERT

-- ============================================
-- 0. Drop policies that depend on events.status (before we alter it)
-- ============================================
DROP POLICY IF EXISTS "Sellers can view swap registration fields for events" ON swap_registration_field_definitions;
DROP POLICY IF EXISTS "Sellers can view page settings for events" ON swap_registration_page_settings;

-- ============================================
-- 1. Event status: new enum and migration
-- ============================================
CREATE TYPE event_status_new AS ENUM ('active', 'closed');

ALTER TABLE events ADD COLUMN status_new event_status_new;

UPDATE events
SET status_new = CASE
  WHEN status::text IN ('registration', 'checkin', 'shopping', 'pickup') THEN 'active'::event_status_new
  ELSE 'closed'::event_status_new
END;

ALTER TABLE events DROP COLUMN status;
ALTER TABLE events RENAME COLUMN status_new TO status;
ALTER TABLE events ALTER COLUMN status SET DEFAULT 'active';

DROP TYPE event_status;
ALTER TYPE event_status_new RENAME TO event_status;
CREATE INDEX idx_events_status ON events(status);

-- ============================================
-- 2. Events: add items_locked
-- ============================================
ALTER TABLE events
  ADD COLUMN items_locked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.items_locked IS 'When true, sellers cannot add or edit items (e.g. after physical check-in ends).';

-- ============================================
-- 3. Admin users: add is_org_admin
-- ============================================
ALTER TABLE admin_users
  ADD COLUMN is_org_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN admin_users.is_org_admin IS 'Org admins have full access including managing users and closing events.';

-- Set existing role=admin users as org admins so behavior is preserved
UPDATE admin_users SET is_org_admin = true WHERE role = 'admin';

-- ============================================
-- 4. Admin users: migrate permissions to new structure
-- ============================================
-- New shape: { "stations": { "check_in": bool, "pos": bool, "pickup": bool, "reports": bool } }
-- Migrate from old flat { "check_in", "pos", "pickup", "reports" } or already-nested shape
UPDATE admin_users
SET permissions = jsonb_build_object(
  'stations',
  jsonb_build_object(
    'check_in',  COALESCE((permissions->'stations'->>'check_in')::boolean, (permissions->>'check_in')::boolean, true),
    'pos',       COALESCE((permissions->'stations'->>'pos')::boolean, (permissions->>'pos')::boolean, true),
    'pickup',    COALESCE((permissions->'stations'->>'pickup')::boolean, (permissions->>'pickup')::boolean, true),
    'reports',   COALESCE((permissions->'stations'->>'reports')::boolean, (permissions->>'reports')::boolean, true)
  )
)
WHERE permissions IS NOT NULL;

-- Default for new rows (used by app on insert)
ALTER TABLE admin_users
  ALTER COLUMN permissions SET DEFAULT '{"stations":{"check_in":true,"pos":true,"pickup":true,"reports":true}}'::jsonb;

-- ============================================
-- 5. RLS helper: user has POS permission (or is org admin)
-- ============================================
CREATE OR REPLACE FUNCTION user_has_pos_permission()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT is_org_admin, permissions
  INTO rec
  FROM admin_users
  WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF rec.is_org_admin = true THEN
    RETURN true;
  END IF;
  RETURN COALESCE((rec.permissions->'stations'->>'pos')::boolean, false);
END;
$$;

-- ============================================
-- 6. RLS helper: user has pickup permission (or is org admin)
-- ============================================
CREATE OR REPLACE FUNCTION user_has_pickup_permission()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT is_org_admin, permissions
  INTO rec
  FROM admin_users
  WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF rec.is_org_admin = true THEN
    RETURN true;
  END IF;
  RETURN COALESCE((rec.permissions->'stations'->>'pickup')::boolean, false);
END;
$$;

GRANT EXECUTE ON FUNCTION user_has_pos_permission() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_pickup_permission() TO authenticated;

-- ============================================
-- 7. Transactions INSERT: require POS permission (or org admin)
-- ============================================
DROP POLICY IF EXISTS "Org users can insert transactions for their organization's events" ON transactions;

CREATE POLICY "Org users with POS permission can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    org_user_can_access_event(event_id)
    AND processed_by = auth.uid()
    AND user_has_pos_permission()
  );

-- ============================================
-- 8. Payouts INSERT: require pickup permission (or org admin)
-- ============================================
DROP POLICY IF EXISTS "Org users can insert payouts for their organization's events" ON payouts;

CREATE POLICY "Org users with pickup permission can insert payouts"
  ON payouts FOR INSERT
  WITH CHECK (
    org_user_can_access_event(event_id)
    AND issued_by = auth.uid()
    AND user_has_pickup_permission()
  );

-- ============================================
-- 9. Recreate seller policies with new status logic (active = event running)
-- ============================================
CREATE POLICY "Sellers can view swap registration fields for events"
  ON swap_registration_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT e.organization_id 
      FROM events e
      WHERE e.status = 'active'
    )
  );

CREATE POLICY "Sellers can view page settings for events"
  ON swap_registration_page_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT e.organization_id 
      FROM events e
      WHERE e.status = 'active'
    )
  );
