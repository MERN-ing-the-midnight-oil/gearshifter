-- Opaque high-entropy token for seller dashboard deep links (exchange for Supabase session server-side).
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS access_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sellers_access_token_key
  ON sellers (access_token)
  WHERE access_token IS NOT NULL;

COMMENT ON COLUMN sellers.access_token IS 'Opaque seller dashboard token; exchange via Edge Function for a short-lived Supabase session.';
