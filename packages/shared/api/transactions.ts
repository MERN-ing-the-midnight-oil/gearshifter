import { supabase } from './supabase';
import type { Transaction, PaymentMethod } from '../types/models';

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

/**
 * Helper to map database transaction to Transaction model
 */
function mapTransactionFromDb(dbTransaction: any): Transaction {
  return {
    id: dbTransaction.id,
    eventId: dbTransaction.event_id,
    itemId: dbTransaction.item_id,
    sellerId: dbTransaction.seller_id,
    soldPrice: dbTransaction.sold_price,
    commissionAmount: dbTransaction.commission_amount,
    sellerAmount: dbTransaction.seller_amount,
    paymentMethod: dbTransaction.payment_method as PaymentMethod,
    processedBy: dbTransaction.processed_by,
    soldAt: new Date(dbTransaction.sold_at),
  };
}

