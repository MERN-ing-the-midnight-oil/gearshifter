import { supabase } from './supabase';
import type { Json } from '../types/supabase';
import type { Transaction, PaymentMethod } from '../types/models';
import { getItem, updateItemStatus } from './items';
import { getEvent } from './events';

/**
 * Get all transactions for the current seller
 */
export const getSellerTransactions = async (sellerId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('seller_id', sellerId)
    .order('sold_at', { ascending: false });

  if (error) throw error;
  return data.map(mapTransactionFromDb);
};

/**
 * Get recent transactions (last 10)
 */
export const getRecentTransactions = async (sellerId: string, limit = 10): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('seller_id', sellerId)
    .order('sold_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data.map(mapTransactionFromDb);
};

export interface SellerSaleNotificationRow extends Transaction {
  itemNumber?: string;
  itemLabel?: string;
  itemDescription?: string;
}

/**
 * Seller's sales with item details for the notifications tab (RLS: own transactions + items).
 */
export const getSellerTransactionsWithItems = async (
  sellerId: string
): Promise<SellerSaleNotificationRow[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
      *,
      items (
        item_number,
        seller_item_label,
        description
      )
    `
    )
    .eq('seller_id', sellerId)
    .order('sold_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => {
    const t = mapTransactionFromDb(row);
    const item = row.items;
    return {
      ...t,
      itemNumber: item?.item_number,
      itemLabel: item?.seller_item_label ?? undefined,
      itemDescription: item?.description ?? undefined,
    };
  });
};

/**
 * Record a sale (mark item as sold and create transaction)
 */
export const recordSale = async (
  itemId: string,
  saleData: {
    soldPrice: number;
    buyerName: string;
    buyerEmail?: string;
    buyerPhone?: string;
    buyerContactInfo?: Record<string, unknown>;
    processedBy: string; // Admin user ID
  }
): Promise<Transaction> => {
  // Get the item to calculate commission
  const item = await getItem(itemId);
  
  if (!item) {
    throw new Error('Item not found');
  }

  if (item.status === 'sold') {
    throw new Error('Item is already sold');
  }

  // Get event with organization to get commission rate
  const event = await getEvent(item.eventId);
  if (!event || !event.organization) {
    throw new Error('Event or organization not found');
  }

  // Calculate commission and seller amount
  // Use organization commission rate (null means no commission)
  const commissionRate = event.organization.commissionRate ?? 0;
  const commissionAmount = saleData.soldPrice * commissionRate;
  const sellerAmount = saleData.soldPrice - commissionAmount;

  // Create transaction
  const { data: transactionData, error: transactionError } = await supabase
    .from('transactions')
    .insert({
      event_id: item.eventId,
      item_id: itemId,
      seller_id: item.sellerId,
      sold_price: saleData.soldPrice,
      commission_amount: commissionAmount,
      seller_amount: sellerAmount,
      payment_method: null, // Not processing payments
      processed_by: saleData.processedBy,
      sold_at: new Date().toISOString(),
      buyer_name: saleData.buyerName,
      buyer_email: saleData.buyerEmail || null,
      buyer_phone: saleData.buyerPhone || null,
      buyer_contact_info: (saleData.buyerContactInfo ?? {}) as Json,
    })
    .select()
    .single();

  if (transactionError) throw transactionError;

  // Update item status to sold
  await updateItemStatus(itemId, 'sold', {
    soldAt: new Date(),
    soldPrice: saleData.soldPrice,
  });

  const mapped = mapTransactionFromDb(transactionData);

  try {
    const { error: fnError } = await supabase.functions.invoke('notify-seller-on-sale', {
      body: { transaction_id: transactionData.id },
    });
    if (fnError) {
      console.warn('[recordSale] notify-seller-on-sale:', fnError.message);
    }
  } catch (e) {
    console.warn('[recordSale] notify-seller-on-sale failed:', e);
  }

  return mapped;
};

/**
 * Helper to map database transaction to Transaction model
 */
function mapTransactionFromDb(dbTransaction: any): Transaction {
  return {
    id: dbTransaction.id,
    eventId: dbTransaction.event_id,
    itemId: dbTransaction.item_id,
    sellerId: dbTransaction.seller_id,
    soldPrice: parseFloat(dbTransaction.sold_price),
    commissionAmount: parseFloat(dbTransaction.commission_amount),
    sellerAmount: parseFloat(dbTransaction.seller_amount),
    paymentMethod: dbTransaction.payment_method as PaymentMethod | undefined,
    processedBy: dbTransaction.processed_by,
    soldAt: new Date(dbTransaction.sold_at),
    buyerName: dbTransaction.buyer_name,
    buyerEmail: dbTransaction.buyer_email,
    buyerPhone: dbTransaction.buyer_phone,
    buyerContactInfo: (dbTransaction.buyer_contact_info as Record<string, unknown>) || undefined,
  };
}




