-- Migration to add buyer information to transactions
-- Records who purchased each item for contact and tracking purposes

ALTER TABLE transactions
  ADD COLUMN buyer_name TEXT,
  ADD COLUMN buyer_email TEXT,
  ADD COLUMN buyer_phone TEXT,
  ADD COLUMN buyer_contact_info JSONB DEFAULT '{}';

-- Add comments
COMMENT ON COLUMN transactions.buyer_name IS 'Name of the person who purchased the item';
COMMENT ON COLUMN transactions.buyer_email IS 'Email address of the buyer (optional)';
COMMENT ON COLUMN transactions.buyer_phone IS 'Phone number of the buyer (optional)';
COMMENT ON COLUMN transactions.buyer_contact_info IS 'Additional buyer contact information (JSON)';

-- Make payment_method nullable since we're not processing payments
ALTER TABLE transactions
  ALTER COLUMN payment_method DROP NOT NULL;








