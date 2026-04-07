-- Migration: Add price reduction control settings for organizations
-- Allows orgs to control who can set price reductions and timing

-- Add price reduction settings to organizations table
ALTER TABLE organizations 
  ADD COLUMN price_reduction_settings JSONB DEFAULT '{
    "sellerCanSetReduction": true,
    "sellerCanSetTime": true,
    "defaultReductionTime": null,
    "allowedReductionTimes": []
  }';

-- Update items table to support multiple price reduction times
ALTER TABLE items
  ADD COLUMN price_reduction_times JSONB DEFAULT '[]'; -- Array of {time: timestamp, price: number}
  -- Keep existing fields for backward compatibility
  -- reduced_price, enable_price_reduction, price_drop_time still exist

-- Create index for price reduction queries
CREATE INDEX idx_items_price_reduction_times ON items USING GIN(price_reduction_times);








