-- Optional friendly name chosen by the seller for the dashboard only (not printed on physical tags).
ALTER TABLE items ADD COLUMN IF NOT EXISTS seller_item_label TEXT;

COMMENT ON COLUMN items.seller_item_label IS 'Seller-chosen listing name for app/dashboard only; not shown on printed gear tags.';
