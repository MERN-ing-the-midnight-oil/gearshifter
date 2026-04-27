-- Soft-archive events: hide from discovery lists while keeping data.
-- Organizers set archived_at via the dashboard after the event has ended.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN events.archived_at IS 'When set, event is archived (hidden from public/seller discovery; org users still see via org policies).';

CREATE INDEX IF NOT EXISTS idx_events_archived_at ON events (archived_at)
  WHERE archived_at IS NOT NULL;

-- Public invite/discovery: do not expose archived events to anon/authenticated without org path.
DROP POLICY IF EXISTS "Public can view events for seller invites and discovery" ON events;
CREATE POLICY "Public can view events for seller invites and discovery"
  ON events FOR SELECT
  TO anon, authenticated
  USING (archived_at IS NULL);

-- Seller browse list: exclude archived (past events with items still use the other policy).
DROP POLICY IF EXISTS "Sellers can browse all events" ON events;
CREATE POLICY "Sellers can browse all events"
  ON events FOR SELECT
  USING (
    archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM sellers s
      WHERE s.auth_user_id = auth.uid() OR s.id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );
