import { supabase } from './supabase';

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

  const commissionRate = org.commission_rate || 0.25; // Default 25%

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

