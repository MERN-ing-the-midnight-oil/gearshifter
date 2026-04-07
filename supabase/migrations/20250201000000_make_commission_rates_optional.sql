-- Make commission rates optional (nullable)
-- Organizations can have no commissions, or one, or both

ALTER TABLE organizations
  ALTER COLUMN commission_rate DROP NOT NULL,
  ALTER COLUMN vendor_commission_rate DROP NOT NULL;

-- Remove default values since they're now optional
ALTER TABLE organizations
  ALTER COLUMN commission_rate DROP DEFAULT,
  ALTER COLUMN vendor_commission_rate DROP DEFAULT;

