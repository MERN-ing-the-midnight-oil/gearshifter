-- Allow unauthenticated (anon) and logged-in users without org/seller RLS paths to read event + org
-- metadata when opening seller invite links (e.g. /event/:id/register in browser before sign-up).
-- Without this, PostgREST returns 0 rows for events SELECT and .single() becomes HTTP 406.

CREATE POLICY "Public can view events for seller invites and discovery"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view organizations linked to events"
  ON organizations FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.organization_id = organizations.id
    )
  );
