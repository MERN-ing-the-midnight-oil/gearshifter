import { supabase } from './supabase';
import { getItem } from './items';
import type { Item } from '../types/models';

export const ITEM_CHECK_IN_PHOTOS_BUCKET = 'item-check-in-photos';

function extFromMime(mime: string): 'jpg' | 'png' | 'webp' | 'heic' {
  const m = mime.toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  return 'jpg';
}

function normalizeContentType(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  if (m === 'image/heif') return 'image/heic';
  return m;
}

/**
 * Upload a check-in reference photo for an item (org staff only; enforced by Storage RLS + items RLS).
 * Replaces any previous photo for the same item (stable object key per extension).
 */
export async function uploadItemCheckInPhotoFromUri(
  itemId: string,
  fileUri: string,
  mimeType: string
): Promise<Item> {
  const ext = extFromMime(mimeType);
  const objectPath = `${itemId}/check-in.${ext}`;
  const res = await fetch(fileUri);
  if (!res.ok) {
    throw new Error('Could not read the photo file.');
  }
  const buf = await res.arrayBuffer();
  const contentType = normalizeContentType(mimeType);

  const { error: upErr } = await supabase.storage
    .from(ITEM_CHECK_IN_PHOTOS_BUCKET)
    .upload(objectPath, buf, {
      contentType,
      upsert: true,
    });

  if (upErr) {
    throw new Error(upErr.message || 'Photo upload failed');
  }

  const capturedAt = new Date().toISOString();
  const { error: dbErr } = await supabase
    .from('items')
    .update({
      check_in_photo_storage_path: objectPath,
      check_in_photo_captured_at: capturedAt,
    })
    .eq('id', itemId);

  if (dbErr) {
    throw new Error(dbErr.message || 'Failed to attach photo to item');
  }

  const fresh = await getItem(itemId);
  if (!fresh) {
    throw new Error('Item not found after photo upload');
  }
  return fresh;
}

/**
 * Short-lived URL for a private check-in photo: org stations, or sellers for their own items after `checked_in_at` is set (storage RLS).
 */
export async function getItemCheckInPhotoSignedUrl(
  storagePath: string | null | undefined,
  expiresSeconds = 3600
): Promise<string | null> {
  if (!storagePath?.trim()) return null;
  const { data, error } = await supabase.storage
    .from(ITEM_CHECK_IN_PHOTOS_BUCKET)
    .createSignedUrl(storagePath.trim(), expiresSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
