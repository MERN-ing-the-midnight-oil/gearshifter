-- Pending POS sales for QR handoff: volunteer shows signed URL QR; buyer photographs; volunteer completes manually.

CREATE TYPE public.pos_sale_intent_status AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE public.pos_sale_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  sold_price NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  seller_amount NUMERIC(10, 2) NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT,
  buyer_phone TEXT,
  processed_by UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  status public.pos_sale_intent_status NOT NULL DEFAULT 'pending',
  completed_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL
);

CREATE INDEX idx_pos_sale_intents_pending_item ON public.pos_sale_intents (item_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.pos_sale_intents IS 'Short-lived POS sale payloads for QR receipt handoff (no SMS). Finalized when volunteer marks receipt received.';

ALTER TABLE public.pos_sale_intents ENABLE ROW LEVEL SECURITY;
