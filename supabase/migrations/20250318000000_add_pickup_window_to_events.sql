-- Add pickup window (seller pickup of unsold equipment) to events.
-- Org admins set when sellers can pick up unsold items (typically after shop closes).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS pickup_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_end_time TIMESTAMPTZ;

COMMENT ON COLUMN events.pickup_start_time IS 'When sellers can start picking up unsold equipment (optional).';
COMMENT ON COLUMN events.pickup_end_time IS 'When seller pickup window ends (optional).';
