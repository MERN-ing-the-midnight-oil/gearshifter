import { supabase } from './supabase';
import type { Item, ItemStatus } from '../types/models';
import { isItemDonatedToOrg } from '../constants/statuses';
import { buildOrganizerItemDeepLink } from '../utils/qrCode';
import { isUuidString } from '../utils/formatters';

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  statusCode?: string | number;
};

/** Verbose JSON payload logging (set EXPO_PUBLIC_DEBUG_ITEMS=1 in seller-app). */
function itemsVerbosePayloadLogging(): boolean {
  try {
    return (
      typeof process !== 'undefined' &&
      process.env?.EXPO_PUBLIC_DEBUG_ITEMS === '1'
    );
  } catch {
    return false;
  }
}

function summarizeInsertPayload(data: Record<string, unknown>) {
  const custom = data.custom_fields as Record<string, unknown> | undefined;
  const desc = data.description;
  const descSnippet =
    typeof desc === 'string'
      ? desc.length > 100
        ? `${desc.slice(0, 100)}…`
        : desc
      : desc;
  return {
    keys: Object.keys(data),
    event_id: data.event_id,
    seller_id: data.seller_id,
    category: data.category,
    category_id: data.category_id,
    description: descSnippet,
    original_price: data.original_price,
    reduced_price: data.reduced_price,
    enable_price_reduction: data.enable_price_reduction,
    status: data.status,
    donate_if_unsold: data.donate_if_unsold,
    custom_field_names:
      custom && typeof custom === 'object' ? Object.keys(custom) : [],
    price_reduction_times: data.price_reduction_times,
    qr_code_prefix:
      typeof data.qr_code === 'string' ? data.qr_code.slice(0, 32) : data.qr_code,
    seller_item_label: data.seller_item_label,
  };
}

function postgrestErrorRecord(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { raw: String(err) };
  const o = err as Record<string, unknown>;
  return {
    name: o.name,
    message: o.message,
    details: o.details,
    hint: o.hint,
    code: o.code,
    statusCode: o.statusCode,
    // Some Supabase / fetch layers use these names:
    status: o.status,
    body: o.body,
  };
}

function formatPostgrestError(err: unknown): string {
  if (err instanceof Error) {
    const any = err as PostgrestLikeError;
    const parts = [
      any.message,
      any.details,
      any.hint,
      any.code,
      any.statusCode != null ? `HTTP ${any.statusCode}` : '',
    ].filter(Boolean);
    return parts.join(' | ') || err.message;
  }
  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err as object));
  } catch {
    return String(err);
  }
}

/** PostgREST: column not in schema cache (migration not applied on remote DB). */
function isPgrstMissingColumn(error: unknown, columnSnakeCase: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as PostgrestLikeError;
  if (e.code !== 'PGRST204') return false;
  const blob = `${e.message || ''} ${e.details || ''} ${e.hint || ''}`;
  return (
    blob.includes(`'${columnSnakeCase}'`) || blob.includes(columnSnakeCase)
  );
}

/**
 * Get all items for the current seller
 */
export const getSellerItems = async (sellerId: string): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapItemFromDb);
};

/**
 * Get items for a specific event
 */
export const getSellerItemsByEvent = async (
  sellerId: string,
  eventId: string
): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapItemFromDb);
};

/**
 * Get a single item by ID
 */
export const getItem = async (itemId: string): Promise<Item | null> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error) throw error;
  return data ? mapItemFromDb(data) : null;
};

/**
 * Get seller statistics (total items, sold items, earnings, etc.)
 */
export const getSellerStats = async (sellerId: string) => {
  // Get all items
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, status, original_price, sold_price, reduced_price, enable_price_reduction')
    .eq('seller_id', sellerId);

  if (itemsError) throw itemsError;

  // Get transactions for earnings calculation
  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('seller_amount')
    .eq('seller_id', sellerId);

  if (transactionsError) throw transactionsError;

  const totalItems = items?.length || 0;
  const soldItems = items?.filter((item) => item.status === 'sold').length || 0;
  const pendingItems = items?.filter((item) => item.status === 'pending').length || 0;
  const forSaleItems = items?.filter((item) => item.status === 'for_sale').length || 0;
  
  const totalEarnings = transactions?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;

  const checkedInItems = items?.filter((item) => item.status === 'checked_in').length || 0;
  const donatedItems = items?.filter((item) => isItemDonatedToOrg(item.status as ItemStatus)).length || 0;

  return {
    totalItems,
    soldItems,
    pendingItems,
    checkedInItems,
    forSaleItems,
    donatedItems,
    totalEarnings,
  };
};

/**
 * Create a new item for an event
 * Supports both legacy fields and dynamic custom fields
 */
export const createItem = async (
  sellerId: string,
  eventId: string,
  itemData: {
    categoryId?: string;
    category?: string; // Legacy support
    description?: string; // Legacy support
    size?: string; // Legacy support
    originalPrice?: number; // Legacy support
    reducedPrice?: number; // Legacy support
    enablePriceReduction?: boolean; // Legacy support
    priceReductionTimes?: Array<{ time: string; price: number; isPercentage?: boolean }>; // Price reduction schedule
    donateIfUnsold?: boolean; // Legacy support
    /** Dashboard-only listing name; not printed on tags. */
    sellerItemLabel?: string;
    customFields?: Record<string, unknown>; // Dynamic fields
  }
): Promise<Item> => {
  // items.seller_id references sellers.id. Seller app passes auth user id; check-in passes sellers.id.
  const { data: sellerByAuth, error: sellerAuthError } = await supabase
    .from('sellers')
    .select('id')
    .eq('auth_user_id', sellerId)
    .maybeSingle();
  if (sellerAuthError) {
    throw new Error(
      `Failed to look up seller profile | ${sellerAuthError.message} | ${sellerAuthError.details || ''} | ${sellerAuthError.code || ''}`
    );
  }
  let resolvedSellerRowId = sellerByAuth?.id;
  if (!resolvedSellerRowId) {
    const { data: sellerById, error: sellerIdError } = await supabase
      .from('sellers')
      .select('id')
      .eq('id', sellerId)
      .maybeSingle();
    if (sellerIdError) {
      throw new Error(
        `Failed to look up seller profile | ${sellerIdError.message} | ${sellerIdError.details || ''} | ${sellerIdError.code || ''}`
      );
    }
    resolvedSellerRowId = sellerById?.id;
  }
  if (!resolvedSellerRowId) {
    throw new Error(
      'No seller profile found for this account. Please complete seller signup (or create the seller row) before adding items.'
    );
  }

  let custom: Record<string, unknown>;
  try {
    custom = JSON.parse(JSON.stringify(itemData.customFields || {})) as Record<string, unknown>;
  } catch {
    custom = {};
  }
  // Legacy NOT NULL columns: dynamic forms often only populate custom_fields
  const categoryText =
    itemData.category ??
    (typeof custom.category === 'string' ? custom.category : '');
  const descriptionText =
    itemData.description ??
    (typeof custom.description === 'string' ? custom.description : '');

  const year = new Date().getFullYear();
  const makeUniqueItemNumber = () => {
    const suffix =
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `SG${year}-${suffix}`;
  };

  const isUniqueViolation = (err: { code?: string } | null | undefined) =>
    err?.code === '23505';
  const formatError = (err: PostgrestLikeError) => {
    const parts = [
      err.message,
      err.details,
      err.hint,
      err.code,
      err.statusCode != null ? `HTTP ${err.statusCode}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  };

  // Build insert data with legacy fields and custom fields
  const rawPrice = itemData.originalPrice ?? 0;
  const safeOriginalPrice =
    typeof rawPrice === 'number' && !Number.isNaN(rawPrice) ? rawPrice : 0;

  const baseInsertData: any = {
    event_id: eventId,
    seller_id: resolvedSellerRowId,
    status: 'pending',
    custom_fields: custom,
    category: categoryText,
    description: descriptionText,
    original_price: safeOriginalPrice,
  };

  // Add legacy fields if provided (for backward compatibility)
  if (itemData.categoryId != null && String(itemData.categoryId).trim() !== '') {
    const cid = String(itemData.categoryId).trim();
    if (isUuidString(cid)) {
      baseInsertData.category_id = cid;
    } else if (!baseInsertData.category) {
      // Field was mis-mapped as categoryId but holds free text (common 400: invalid uuid)
      baseInsertData.category = cid;
    }
  }
  if (itemData.category) baseInsertData.category = itemData.category;
  if (itemData.description) baseInsertData.description = itemData.description;
  if (itemData.size) baseInsertData.size = itemData.size;
  if (itemData.originalPrice !== undefined) {
    const p = itemData.originalPrice;
    baseInsertData.original_price =
      typeof p === 'number' && !Number.isNaN(p) ? p : 0;
  }
  if (itemData.reducedPrice !== undefined) {
    const rp = itemData.reducedPrice;
    baseInsertData.reduced_price =
      typeof rp === 'number' && !Number.isNaN(rp) ? rp : null;
  }
  if (itemData.enablePriceReduction !== undefined)
    baseInsertData.enable_price_reduction = itemData.enablePriceReduction;
  if (itemData.priceReductionTimes !== undefined)
    baseInsertData.price_reduction_times = itemData.priceReductionTimes;
  if (itemData.donateIfUnsold !== undefined)
    baseInsertData.donate_if_unsold = itemData.donateIfUnsold;
  const trimmedLabel = itemData.sellerItemLabel?.trim();
  if (trimmedLabel) baseInsertData.seller_item_label = trimmedLabel;

  console.log('[gearshifter:createItem] resolved seller row', {
    authOrSellerLookupInput: sellerId,
    resolvedSellerRowId,
    eventId,
  });

  // Insert item
  const maxAttempts = 5;
  let lastInsertError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const itemNumber = makeUniqueItemNumber();
    const insertData = {
      ...baseInsertData,
      item_number: itemNumber,
      // qr_code is UNIQUE globally; include item_number so the placeholder is unique too
      qr_code: `PENDING:${itemNumber}`,
    };

    console.log('[gearshifter:createItem] attempting insert', {
      attempt: attempt + 1,
      summary: summarizeInsertPayload(insertData as Record<string, unknown>),
      ...(itemsVerbosePayloadLogging()
        ? { fullPayload: insertData }
        : {}),
    });

    const { data, error } = await supabase
      .from('items')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      lastInsertError = error;
      // PostgREST duplicate key → Postgres 23505
      if (isUniqueViolation(error)) {
        console.warn('[gearshifter:createItem] unique violation, retrying item_number', {
          attempt: attempt + 1,
          code: (error as PostgrestLikeError).code,
        });
        continue;
      }
      // Remote DB may not have seller_item_label until migration 20260319140000 is applied.
      if (
        isPgrstMissingColumn(error, 'seller_item_label') &&
        baseInsertData.seller_item_label !== undefined
      ) {
        console.warn(
          '[gearshifter:createItem] items.seller_item_label missing on database; retrying without it. Apply supabase/migrations/20260319140000_add_seller_item_label.sql (or `supabase db push`) to enable listing names.'
        );
        delete baseInsertData.seller_item_label;
        attempt -= 1;
        continue;
      }
      console.error('[gearshifter:createItem] insert failed (see PostgREST message/details)', {
        postgrest: postgrestErrorRecord(error),
        formatted: formatPostgrestError(error),
        payloadSummary: summarizeInsertPayload(insertData as Record<string, unknown>),
        ...(itemsVerbosePayloadLogging()
          ? { fullPayload: insertData }
          : {}),
      });
      throw new Error(formatError(error as PostgrestLikeError));
    }

    // Stored QR opens this item in the Organizer app (check-in) for staff; thermal tags still use
    // generateItemQRCode() at print time with full JSON payload.
    const finalQrCode = buildOrganizerItemDeepLink(eventId, data.id, resolvedSellerRowId);
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update({ qr_code: finalQrCode })
      .eq('id', data.id)
      .select()
      .single();

    if (updateError) {
      console.error('[gearshifter:createItem] QR update failed after insert', {
        postgrest: postgrestErrorRecord(updateError),
        formatted: formatPostgrestError(updateError),
        itemId: data?.id,
      });
      throw new Error(formatError(updateError as PostgrestLikeError));
    }
    return mapItemFromDb(updatedItem);
  }

  if (lastInsertError) {
    console.error('[gearshifter:createItem] exhausted retries (unique violations)', {
      postgrest: postgrestErrorRecord(lastInsertError),
      formatted: formatPostgrestError(lastInsertError),
    });
    throw new Error(formatError(lastInsertError));
  }
  throw new Error('Failed to add item');
};

/**
 * Update an item (only allowed before check-in)
 * Supports both legacy fields and dynamic custom fields
 */
export const updateItem = async (
  itemId: string,
  sellerId: string,
  updates: {
    categoryId?: string;
    category?: string; // Legacy support
    description?: string; // Legacy support
    size?: string; // Legacy support
    originalPrice?: number; // Legacy support
    reducedPrice?: number; // Legacy support
    enablePriceReduction?: boolean; // Legacy support
    priceReductionTimes?: Array<{ time: string; price: number; isPercentage?: boolean }>; // Price reduction schedule
    donateIfUnsold?: boolean; // Legacy support
    /** Dashboard listing name only */
    sellerItemLabel?: string | null;
    customFields?: Record<string, unknown>; // Dynamic fields
  }
): Promise<Item> => {
  const updateData: any = {};
  
  // Legacy fields
  if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.size !== undefined) updateData.size = updates.size;
  if (updates.originalPrice !== undefined) updateData.original_price = updates.originalPrice;
  if (updates.reducedPrice !== undefined) updateData.reduced_price = updates.reducedPrice;
  if (updates.enablePriceReduction !== undefined)
    updateData.enable_price_reduction = updates.enablePriceReduction;
  if (updates.priceReductionTimes !== undefined)
    updateData.price_reduction_times = updates.priceReductionTimes;
  if (updates.donateIfUnsold !== undefined) updateData.donate_if_unsold = updates.donateIfUnsold;
  if (updates.sellerItemLabel !== undefined) {
    updateData.seller_item_label = updates.sellerItemLabel?.trim() || null;
  }
  
  // Custom fields - merge with existing custom fields
  if (updates.customFields !== undefined) {
    // Get current item to merge custom fields
    const { data: currentItem } = await supabase
      .from('items')
      .select('custom_fields')
      .eq('id', itemId)
      .single();
    
    const existingFields = (currentItem?.custom_fields as Record<string, unknown>) || {};
    updateData.custom_fields = { ...existingFields, ...updates.customFields };
  }

  let { data, error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .eq('seller_id', sellerId)
    .select()
    .single();

  if (
    error &&
    isPgrstMissingColumn(error, 'seller_item_label') &&
    Object.prototype.hasOwnProperty.call(updateData, 'seller_item_label')
  ) {
    console.warn(
      '[gearshifter:updateItem] items.seller_item_label missing on database; retrying update without it. Apply migration 20260319140000_add_seller_item_label.sql.'
    );
    delete updateData.seller_item_label;
    const retry = await supabase
      .from('items')
      .update(updateData)
      .eq('id', itemId)
      .eq('seller_id', sellerId)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return mapItemFromDb(data);
};

/**
 * Seller removes an item they registered but have not yet handed in to the org.
 * Only `pending` items can be deleted (before check-in). RLS enforces the same.
 */
export const deleteSellerPendingItem = async (itemId: string): Promise<void> => {
  const item = await getItem(itemId);
  if (!item) {
    throw new Error('Item not found');
  }
  if (item.status !== 'pending') {
    throw new Error(
      'You can only remove an item before it is handed in at the event. After check-in, contact the organizer if you need help.'
    );
  }

  // Prefer RPC: direct DELETE from the client is often a no-op under RLS (policy drift, hosted DB
  // missing migrations). RPC is SECURITY DEFINER and applies the same ownership + pending rules.
  const { data: deleted, error } = await supabase.rpc('seller_delete_own_pending_item', {
    p_item_id: itemId,
  });

  if (error) throw new Error(error.message || 'Failed to remove item');
  if (!deleted) {
    throw new Error(
      'Could not remove this item. It may already be checked in, or you may not have permission to remove it.'
    );
  }
};

/**
 * Update item status (for org users during check-in, POS, etc.)
 * Lifecycle includes terminal states: picked_up, donated, donated_abandoned, unclaimed, withdrawn, lost, damaged.
 */
export const updateItemStatus = async (
  itemId: string,
  status: ItemStatus,
  options?: {
    checkedInAt?: Date;
    soldAt?: Date;
    soldPrice?: number;
  }
): Promise<Item> => {
  const updateData: any = {
    status,
  };

  if (status === 'checked_in' && options?.checkedInAt) {
    updateData.checked_in_at = options.checkedInAt.toISOString();
  }
  if (status === 'sold' && options?.soldAt) {
    updateData.sold_at = options.soldAt.toISOString();
  }
  if (status === 'sold' && options?.soldPrice !== undefined) {
    updateData.sold_price = options.soldPrice;
  }

  const { data, error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return mapItemFromDb(data);
};

/**
 * Mark multiple items as "for_sale" (after labels are printed and affixed)
 */
export const markItemsForSale = async (itemIds: string[]): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .update({ status: 'for_sale' })
    .in('id', itemIds)
    .select();

  if (error) throw error;
  return data.map(mapItemFromDb);
};

/**
 * Get count of items eligible for bulk "mark as donated" (donate_if_unsold + for_sale).
 * Used by admin UI to show how many items will be affected before calling processDonations.
 */
export const getEligibleDonationCount = async (eventId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('donate_if_unsold', true)
    .eq('status', 'for_sale');

  if (error) throw error;
  return count ?? 0;
};

/**
 * Process opt-in donations: set status = `donated` for items with donate_if_unsold + for_sale.
 * Call after declareEventClosed(eventId). Policy abandonment (no opt-in) is `donated_abandoned` — set elsewhere, not here.
 */
export const processDonations = async (eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('items')
    .update({ status: 'donated' })
    .eq('event_id', eventId)
    .eq('donate_if_unsold', true)
    .eq('status', 'for_sale');

  if (error) throw error;
};

/**
 * Helper to map database item to Item model
 */
function mapItemFromDb(dbItem: any): Item {
  return {
    id: dbItem.id,
    eventId: dbItem.event_id,
    sellerId: dbItem.seller_id,
    itemNumber: dbItem.item_number,
    sellerItemLabel: dbItem.seller_item_label ?? undefined,
    categoryId: dbItem.category_id,
    category: dbItem.category, // Legacy field
    description: dbItem.description, // Legacy field
    size: dbItem.size, // Legacy field
    originalPrice: dbItem.original_price, // Legacy field
    reducedPrice: dbItem.reduced_price, // Legacy field
    enablePriceReduction: dbItem.enable_price_reduction, // Legacy field
    priceReductionTimes: (dbItem.price_reduction_times as any) || undefined,
    donateIfUnsold: dbItem.donate_if_unsold, // Legacy field
    customFields: (dbItem.custom_fields as Record<string, unknown>) || {},
    status: dbItem.status as ItemStatus,
    qrCode: dbItem.qr_code,
    checkedInAt: dbItem.checked_in_at ? new Date(dbItem.checked_in_at) : undefined,
    soldAt: dbItem.sold_at ? new Date(dbItem.sold_at) : undefined,
    soldPrice: dbItem.sold_price,
    paidAt: dbItem.paid_at ? new Date(dbItem.paid_at) : undefined,
    createdAt: new Date(dbItem.created_at),
  };
}

