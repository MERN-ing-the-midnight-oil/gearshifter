import { supabase } from './supabase';

async function getAuthUid(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Insert a payouts row and set paid_at on the given sold items.
 * Totals use transactions.seller_amount per item.
 */
async function recordPayoutAndMarkItemsPaid(
  itemIds: string[],
  checkNumber: string | null
): Promise<{ payoutId: string; itemsMarked: number }> {
  if (itemIds.length === 0) {
    return { payoutId: '', itemsMarked: 0 };
  }

  const issuedBy = await getAuthUid();

  const { data: rows, error: itemsErr } = await supabase
    .from('items')
    .select('id, event_id, seller_id, status, paid_at')
    .in('id', itemIds);

  if (itemsErr) throw itemsErr;
  if (!rows?.length) throw new Error('No items found');

  const eventId = rows[0].event_id;
  const sellerId = rows[0].seller_id;
  for (const r of rows) {
    if (r.event_id !== eventId || r.seller_id !== sellerId) {
      throw new Error('All items must belong to the same seller and event');
    }
    if (r.status !== 'sold') throw new Error('Only sold items can be marked as paid');
    if (r.paid_at) throw new Error('An item is already marked paid');
  }

  const { data: txns, error: txErr } = await supabase
    .from('transactions')
    .select('item_id, seller_amount')
    .in('item_id', itemIds);

  if (txErr) throw txErr;

  const txnByItem = new Map((txns || []).map((t) => [t.item_id as string, t]));
  let total = 0;
  for (const id of itemIds) {
    const t = txnByItem.get(id);
    if (!t) {
      throw new Error(`No sale transaction for item ${id}`);
    }
    total += Number(t.seller_amount) || 0;
  }

  const paidAt = new Date().toISOString();

  const trimmedCheck =
    checkNumber == null ? '' : String(checkNumber).trim();

  const { data: payout, error: payoutErr } = await supabase
    .from('payouts')
    .insert({
      event_id: eventId,
      seller_id: sellerId,
      total_amount: total,
      check_number: trimmedCheck === '' ? null : trimmedCheck,
      issued_by: issuedBy,
      signed_by_seller: false,
      paid_at: paidAt,
      items: itemIds,
    })
    .select('id')
    .single();

  if (payoutErr) throw payoutErr;

  const { error: updErr } = await supabase
    .from('items')
    .update({ paid_at: paidAt })
    .in('id', itemIds);

  if (updErr) throw updErr;

  return { payoutId: payout.id, itemsMarked: itemIds.length };
}

/**
 * Get estimated payout for a seller for a specific event
 * This calculates what the seller would receive if all for-sale items sold
 */
export const getEstimatedPayout = async (sellerId: string, eventId: string) => {
  // Get items for this event that are for sale
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, original_price, reduced_price, enable_price_reduction')
    .eq('seller_id', sellerId)
    .eq('event_id', eventId)
    .in('status', ['for_sale', 'checked_in']);

  if (itemsError) throw itemsError;

  // Get organization commission rate
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('organization_id')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('commission_rate')
    .eq('id', event.organization_id)
    .single();

  if (orgError) throw orgError;

  const commissionRate = org.commission_rate ?? 0; // Null means no commission

  // Calculate estimated earnings
  const estimatedTotal = items?.reduce((sum, item) => {
    const price = item.enable_price_reduction && item.reduced_price
      ? item.reduced_price
      : item.original_price;
    return sum + (price || 0);
  }, 0) || 0;

  const estimatedCommission = estimatedTotal * commissionRate;
  const estimatedPayout = estimatedTotal - estimatedCommission;

  return {
    estimatedTotal,
    estimatedCommission,
    estimatedPayout,
    commissionRate,
  };
};

/**
 * Get final payout for a seller for a specific event (from transactions)
 */
export const getFinalPayout = async (sellerId: string, eventId: string) => {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('seller_amount')
    .eq('seller_id', sellerId)
    .eq('event_id', eventId);

  if (error) throw error;

  const totalPayout = transactions?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;
  const itemsSold = transactions?.length || 0;

  return {
    totalPayout,
    itemsSold,
  };
};

/**
 * Mark a single item as paid
 * Inserts a payouts row (with optional check number) and sets paid_at on the item.
 */
export const markItemAsPaid = async (
  itemId: string,
  options?: { checkNumber?: string | null }
): Promise<void> => {
  const checkNumber = options?.checkNumber ?? null;
  await recordPayoutAndMarkItemsPaid([itemId], checkNumber);
};

/**
 * Mark all sold items for a seller as paid (bulk operation).
 * Inserts one payouts row (optional check number) and sets paid_at on each item.
 */
export const markSellerItemsAsPaid = async (
  sellerId: string,
  options?: { eventId?: string; checkNumber?: string | null }
): Promise<{ itemsMarked: number; payoutId?: string }> => {
  let query = supabase
    .from('items')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('status', 'sold')
    .is('paid_at', null);

  if (options?.eventId) {
    query = query.eq('event_id', options.eventId);
  }

  const { data: items, error: itemsError } = await query;

  if (itemsError) throw itemsError;

  if (!items || items.length === 0) {
    return { itemsMarked: 0 };
  }

  const itemIds = items.map((item) => item.id);
  const checkNumber = options?.checkNumber ?? null;
  const { payoutId, itemsMarked } = await recordPayoutAndMarkItemsPaid(itemIds, checkNumber);
  return { itemsMarked, payoutId };
};

/**
 * Get all paid items for a seller
 * Optionally filter by eventId
 */
export const getPaidItems = async (
  sellerId: string,
  options?: { eventId?: string }
) => {
  console.log('[getPaidItems] Starting', { sellerId, options });
  
  let query = supabase
    .from('items')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('status', 'sold')
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false });

  if (options?.eventId) {
    query = query.eq('event_id', options.eventId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getPaidItems] Error fetching paid items', { sellerId, options, error });
    throw error;
  }
  
  console.log('[getPaidItems] Success', { sellerId, itemCount: data?.length || 0 });
  return data || [];
};

/**
 * Get all unpaid items for a seller
 * Optionally filter by eventId
 */
export const getUnpaidItems = async (
  sellerId: string,
  options?: { eventId?: string }
) => {
  console.log('[getUnpaidItems] Starting', { sellerId, options });
  
  let query = supabase
    .from('items')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('status', 'sold')
    .is('paid_at', null)
    .order('sold_at', { ascending: false });

  if (options?.eventId) {
    query = query.eq('event_id', options.eventId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getUnpaidItems] Error fetching unpaid items', { sellerId, options, error });
    throw error;
  }
  
  console.log('[getUnpaidItems] Success', { sellerId, itemCount: data?.length || 0 });
  return data || [];
};

/**
 * Get payment status for a seller
 * Returns summary of paid vs unpaid items
 * Optionally filter by eventId
 */
export const getSellerPaymentStatus = async (
  sellerId: string,
  options?: { eventId?: string }
) => {
  console.log('[getSellerPaymentStatus] Starting', { sellerId, options });
  
  // Get all sold items
  let soldItemsQuery = supabase
    .from('items')
    .select('id, sold_price, paid_at, event_id')
    .eq('seller_id', sellerId)
    .eq('status', 'sold');

  if (options?.eventId) {
    soldItemsQuery = soldItemsQuery.eq('event_id', options.eventId);
  }

  const { data: soldItems, error: itemsError } = await soldItemsQuery;

  if (itemsError) {
    console.error('[getSellerPaymentStatus] Error fetching items', { sellerId, options, error: itemsError });
    throw itemsError;
  }

  const items = soldItems || [];

  // Calculate totals
  const paidItems = items.filter((item) => item.paid_at !== null);
  const unpaidItems = items.filter((item) => item.paid_at === null);

  const totalSoldAmount = items.reduce((sum, item) => sum + (item.sold_price || 0), 0);
  const paidAmount = paidItems.reduce((sum, item) => sum + (item.sold_price || 0), 0);
  const unpaidAmount = unpaidItems.reduce((sum, item) => sum + (item.sold_price || 0), 0);

  const status = {
    totalItemsSold: items.length,
    paidItemsCount: paidItems.length,
    unpaidItemsCount: unpaidItems.length,
    totalSoldAmount,
    paidAmount,
    unpaidAmount,
    isFullyPaid: unpaidItems.length === 0 && items.length > 0,
  };

  console.log('[getSellerPaymentStatus] Success', { sellerId, status });
  return status;
};

/**
 * Get payment status for all sellers in an event
 * Returns list of sellers with their payment status
 */
export const getEventPaymentStatus = async (eventId: string) => {
  console.log('[getEventPaymentStatus] Starting', { eventId });
  
  // Get all sold items for the event
  const { data: soldItems, error: itemsError } = await supabase
    .from('items')
    .select('id, seller_id, sold_price, paid_at')
    .eq('event_id', eventId)
    .eq('status', 'sold');

  if (itemsError) {
    console.error('[getEventPaymentStatus] Error fetching items', { eventId, error: itemsError });
    throw itemsError;
  }

  const items = soldItems || [];
  console.log('[getEventPaymentStatus] Found sold items', { eventId, itemCount: items.length });

  // Group by seller
  const sellerMap = new Map<string, {
    sellerId: string;
    totalItems: number;
    paidItems: number;
    unpaidItems: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
  }>();

  items.forEach((item) => {
    const sellerId = item.seller_id;
    const isPaid = item.paid_at !== null;
    const amount = item.sold_price || 0;

    if (!sellerMap.has(sellerId)) {
      sellerMap.set(sellerId, {
        sellerId,
        totalItems: 0,
        paidItems: 0,
        unpaidItems: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      });
    }

    const seller = sellerMap.get(sellerId)!;
    seller.totalItems += 1;
    seller.totalAmount += amount;

    if (isPaid) {
      seller.paidItems += 1;
      seller.paidAmount += amount;
    } else {
      seller.unpaidItems += 1;
      seller.unpaidAmount += amount;
    }
  });

  // Convert to array and add isFullyPaid flag
  const sellers = Array.from(sellerMap.values()).map((seller) => ({
    ...seller,
    isFullyPaid: seller.unpaidItems === 0 && seller.totalItems > 0,
  }));

  console.log('[getEventPaymentStatus] Success', { 
    eventId, 
    sellerCount: sellers.length,
    fullyPaidCount: sellers.filter(s => s.isFullyPaid).length
  });

  return sellers;
};







