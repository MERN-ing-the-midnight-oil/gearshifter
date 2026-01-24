import { supabase } from './supabase';
import type { Item, ItemStatus } from '../types/models';

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
  const donatedItems = items?.filter((item) => item.status === 'donated').length || 0;

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
 */
export const createItem = async (
  sellerId: string,
  eventId: string,
  itemData: {
    category: string;
    description: string;
    size?: string;
    originalPrice: number;
    reducedPrice?: number;
    enablePriceReduction: boolean;
    donateIfUnsold: boolean;
  }
): Promise<Item> => {
  // Generate item number (format: SG2025-001234)
  const year = new Date().getFullYear();
  const { data: lastItem, error: lastItemError } = await supabase
    .from('items')
    .select('item_number')
    .eq('event_id', eventId)
    .order('item_number', { ascending: false })
    .limit(1)
    .single();

  let itemNumber: string;
  if (lastItemError || !lastItem) {
    itemNumber = `SG${year}-000001`;
  } else {
    const lastNum = parseInt(lastItem.item_number.split('-')[1]);
    itemNumber = `SG${year}-${String(lastNum + 1).padStart(6, '0')}`;
  }

  // Insert item (QR code will be updated after we get the ID)
  const { data, error } = await supabase
    .from('items')
    .insert({
      event_id: eventId,
      seller_id: sellerId,
      item_number: itemNumber,
      category: itemData.category,
      description: itemData.description,
      size: itemData.size || null,
      original_price: itemData.originalPrice,
      reduced_price: itemData.reducedPrice || null,
      enable_price_reduction: itemData.enablePriceReduction,
      donate_if_unsold: itemData.donateIfUnsold,
      status: 'pending',
      qr_code: 'TEMP', // Temporary, will be updated
    })
    .select()
    .single();

  if (error) throw error;
  
  // Update QR code with actual item ID
  const finalQrCode = `ITEM-${data.id}`;
  const { data: updatedItem, error: updateError } = await supabase
    .from('items')
    .update({ qr_code: finalQrCode })
    .eq('id', data.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return mapItemFromDb(updatedItem);
};

/**
 * Update an item (only allowed before check-in)
 */
export const updateItem = async (
  itemId: string,
  sellerId: string,
  updates: {
    category?: string;
    description?: string;
    size?: string;
    originalPrice?: number;
    reducedPrice?: number;
    enablePriceReduction?: boolean;
    donateIfUnsold?: boolean;
  }
): Promise<Item> => {
  const updateData: any = {};
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.size !== undefined) updateData.size = updates.size;
  if (updates.originalPrice !== undefined) updateData.original_price = updates.originalPrice;
  if (updates.reducedPrice !== undefined) updateData.reduced_price = updates.reducedPrice;
  if (updates.enablePriceReduction !== undefined) updateData.enable_price_reduction = updates.enablePriceReduction;
  if (updates.donateIfUnsold !== undefined) updateData.donate_if_unsold = updates.donateIfUnsold;

  const { data, error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .eq('seller_id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return mapItemFromDb(data);
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
    category: dbItem.category,
    description: dbItem.description,
    size: dbItem.size,
    originalPrice: dbItem.original_price,
    reducedPrice: dbItem.reduced_price,
    enablePriceReduction: dbItem.enable_price_reduction,
    donateIfUnsold: dbItem.donate_if_unsold,
    status: dbItem.status as ItemStatus,
    qrCode: dbItem.qr_code,
    checkedInAt: dbItem.checked_in_at ? new Date(dbItem.checked_in_at) : undefined,
    soldAt: dbItem.sold_at ? new Date(dbItem.sold_at) : undefined,
    soldPrice: dbItem.sold_price,
    createdAt: new Date(dbItem.created_at),
  };
}

