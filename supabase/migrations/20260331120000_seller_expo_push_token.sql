-- Expo push tokens for sale notifications (seller app registers; edge function reads via service role).

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
  ADD COLUMN IF NOT EXISTS expo_push_token_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN sellers.expo_push_token IS 'Expo push token for sale notifications; updated by authenticated seller app.';
COMMENT ON COLUMN sellers.expo_push_token_updated_at IS 'When the seller last registered a push token.';
