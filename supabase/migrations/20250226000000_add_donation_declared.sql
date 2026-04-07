-- Add donation_declared_at to events for end-of-event donation flow.
-- When set, unclaimed donate_if_unsold items are treated as donated; other unsold items as not picked up.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS donation_declared_at TIMESTAMPTZ;

COMMENT ON COLUMN events.donation_declared_at IS 'When set, event is closed for donations: donate_if_unsold+for_sale items become donated; other for_sale items show as not picked up when scanned.';
