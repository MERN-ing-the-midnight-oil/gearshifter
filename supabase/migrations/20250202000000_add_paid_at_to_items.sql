-- Add paid_at column to items table for payment tracking
-- This tracks when an item was marked as paid (NULL = not paid yet)
-- Items can be "sold" (status = 'sold') but not yet "paid" (paid_at = NULL)
ALTER TABLE items ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add index for better query performance when filtering by payment status
CREATE INDEX IF NOT EXISTS idx_items_paid_at ON items(paid_at) WHERE paid_at IS NOT NULL;



