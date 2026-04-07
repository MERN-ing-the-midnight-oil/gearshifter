-- Migration: Generate next item number without UNIQUE conflicts under RLS
-- Sellers generate item_numbers client-side, but RLS can hide other sellers' items.
-- This function bypasses RLS to compute the correct next number for an event.

CREATE OR REPLACE FUNCTION get_next_item_number(event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_year INTEGER;
  v_last_num INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;

  SELECT COALESCE(MAX((split_part(i.item_number, '-', 2))::int), 0)
  INTO v_last_num
  FROM items i
  WHERE i.event_id = event_id
    AND item_number LIKE ('SG' || v_year::text || '-%');

  RETURN 'SG' || v_year::text || '-' || lpad((v_last_num + 1)::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_item_number(UUID) TO authenticated;

