-- After physical check-in, sellers may view their item's check-in reference photo (storage SELECT only).

CREATE OR REPLACE FUNCTION public.seller_own_checked_in_item_check_in_photo_readable(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  item_id uuid;
BEGIN
  IF p_object_name IS NULL OR length(trim(p_object_name)) = 0 THEN
    RETURN false;
  END IF;
  BEGIN
    item_id := split_part(p_object_name, '/', 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1
    FROM public.items i
    INNER JOIN public.sellers s ON s.id = i.seller_id
    WHERE i.id = item_id
      AND s.auth_user_id = auth.uid()
      AND i.checked_in_at IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.seller_own_checked_in_item_check_in_photo_readable(text) IS
  'True when the storage object path belongs to an item the current user owns as seller and the item has been checked in.';

REVOKE ALL ON FUNCTION public.seller_own_checked_in_item_check_in_photo_readable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_own_checked_in_item_check_in_photo_readable(text) TO authenticated;

DROP POLICY IF EXISTS "item_check_in_photos_select" ON storage.objects;
CREATE POLICY "item_check_in_photos_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'item-check-in-photos'
    AND (
      public.org_user_can_access_item_check_in_photo_path(name)
      OR public.seller_own_checked_in_item_check_in_photo_readable(name)
    )
  );
