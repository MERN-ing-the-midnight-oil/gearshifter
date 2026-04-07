-- Extra lifecycle states (withdrawn, inventory issues, post-pickup outcomes, policy donation).
-- Run on hosted Supabase before relying on new values from the app.

ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'unclaimed';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'lost';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'damaged';
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'donated_abandoned';

COMMENT ON TYPE item_status IS 'Item lifecycle: pending→checked_in→for_sale→sold|picked_up|donated|donated_abandoned|unclaimed|withdrawn|lost|damaged';
