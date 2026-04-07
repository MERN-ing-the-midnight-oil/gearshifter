-- Make event date/time fields optional to support flexible event configuration
-- This migration allows events to be created with minimal required information

-- Make registration and shop time fields nullable
ALTER TABLE events
  ALTER COLUMN registration_open_date DROP NOT NULL,
  ALTER COLUMN registration_close_date DROP NOT NULL,
  ALTER COLUMN shop_open_time DROP NOT NULL,
  ALTER COLUMN shop_close_time DROP NOT NULL;

-- Add comment explaining the settings JSONB structure for price drops
COMMENT ON COLUMN events.settings IS 'JSONB object containing event settings. Price drop settings structure:
{
  "priceDropTimes": ["2024-01-15T14:00:00Z", ...], // Array of ISO date strings for organization price drop times
  "priceDropAmountControl": "organization" | "seller", // Who sets the price drop amount/percentage
  "allowSellerPriceDrops": boolean, // Whether sellers can create their own price drop times
  "maxSellerPriceDrops": number, // Maximum number of price drops sellers can create (optional)
  "minTimeBetweenSellerPriceDrops": number // Minimum time in minutes between seller price drops (optional)
}';

