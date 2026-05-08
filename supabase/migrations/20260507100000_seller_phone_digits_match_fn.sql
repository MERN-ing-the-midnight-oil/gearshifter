-- Match sellers by phone digits only (handles mixed formatting in `sellers.phone`).
-- Called from Edge Functions with the service role only.

CREATE OR REPLACE FUNCTION public.seller_ids_matching_phone_digits(p_digits text)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.sellers s
  WHERE length(regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g')) >= 10
    AND regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_digits, ''), '[^0-9]', '', 'g');
$$;

REVOKE ALL ON FUNCTION public.seller_ids_matching_phone_digits(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_ids_matching_phone_digits(text) TO service_role;

COMMENT ON FUNCTION public.seller_ids_matching_phone_digits(text) IS
  'Returns seller row ids whose phone matches the given number when compared digit-only; for staff-initiated SMS signup duplicate checks.';
