-- Client DELETE on `items` can be a no-op under RLS (missing policy, RETURNING quirks, etc.).
-- This RPC runs as definer, enforces the same rules in SQL, and returns whether a row was deleted.

CREATE OR REPLACE FUNCTION public.seller_delete_own_pending_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.items i
  WHERE i.id = p_item_id
    AND i.status = 'pending'
    AND i.seller_id IN (
      SELECT s.id FROM public.sellers s WHERE s.auth_user_id = auth.uid()
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_delete_own_pending_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_delete_own_pending_item(uuid) TO authenticated;

COMMENT ON FUNCTION public.seller_delete_own_pending_item(uuid) IS
  'Authenticated seller removes their own pending item before check-in; bypasses RLS while matching delete policy rules.';
