-- Optional staff photo at check-in / print time: stored in Supabase Storage, path on items row.
-- Org users with event access can upload/read/delete objects under `{item_id}/...`.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS check_in_photo_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS check_in_photo_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN public.items.check_in_photo_storage_path IS
  'Object path inside storage bucket item-check-in-photos (first segment = items.id).';
COMMENT ON COLUMN public.items.check_in_photo_captured_at IS
  'When staff captured the check-in photo (optional anti tag-switching reference at POS).';

-- Bucket (private; access via RLS on storage.objects)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-check-in-photos',
  'item-check-in-photos',
  false,
  6291456,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.org_user_can_access_item_check_in_photo_path(p_object_name text)
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
    WHERE i.id = item_id
      AND public.org_user_can_access_event(i.event_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.org_user_can_access_item_check_in_photo_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_user_can_access_item_check_in_photo_path(text) TO authenticated;

DROP POLICY IF EXISTS "item_check_in_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "item_check_in_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "item_check_in_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "item_check_in_photos_delete" ON storage.objects;

CREATE POLICY "item_check_in_photos_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'item-check-in-photos'
    AND public.org_user_can_access_item_check_in_photo_path(name)
  );

CREATE POLICY "item_check_in_photos_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-check-in-photos'
    AND public.org_user_can_access_item_check_in_photo_path(name)
  );

CREATE POLICY "item_check_in_photos_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'item-check-in-photos'
    AND public.org_user_can_access_item_check_in_photo_path(name)
  )
  WITH CHECK (
    bucket_id = 'item-check-in-photos'
    AND public.org_user_can_access_item_check_in_photo_path(name)
  );

CREATE POLICY "item_check_in_photos_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-check-in-photos'
    AND public.org_user_can_access_item_check_in_photo_path(name)
  );
