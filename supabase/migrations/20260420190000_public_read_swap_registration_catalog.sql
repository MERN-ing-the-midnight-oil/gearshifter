-- Sellers read swap registration *templates* via organization_id. The older policy
-- "Sellers can view swap registration fields for events" only matched orgs that had
-- at least one row in `events` with status = 'active'. That hid all definitions when
-- every event was closed, or when status values did not line up, producing an empty
-- field list in the seller app even though rows existed.
--
-- These policies mirror the invite/discovery approach used for `events` / `organizations`:
-- anyone with a valid client key can read field *definitions* and optional page settings
-- for organizations that have at least one event (metadata only, not seller answers).

CREATE POLICY "Public read swap reg field defs for orgs with events"
  ON swap_registration_field_definitions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.organization_id = swap_registration_field_definitions.organization_id
    )
  );

CREATE POLICY "Public read swap reg page settings for orgs with events"
  ON swap_registration_page_settings FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.organization_id = swap_registration_page_settings.organization_id
    )
  );
