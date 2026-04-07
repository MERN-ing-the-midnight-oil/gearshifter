-- Add gear drop-off time window and place to events.
-- Org admins set when and where sellers can drop off gear for the event.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gear_drop_off_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gear_drop_off_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gear_drop_off_place TEXT;

COMMENT ON COLUMN events.gear_drop_off_start_time IS 'When sellers can start dropping off gear (optional).';
COMMENT ON COLUMN events.gear_drop_off_end_time IS 'When gear drop-off window ends (optional).';
COMMENT ON COLUMN events.gear_drop_off_place IS 'Where sellers drop off gear (e.g. address or room name).';
