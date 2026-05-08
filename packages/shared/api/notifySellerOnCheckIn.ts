import { supabase } from './supabase';

/**
 * Fire-and-forget: texts the seller (Twilio) with a dashboard link after staff registers the item.
 * Requires Edge function `notify-seller-on-check-in` and org JWT; failures are logged only.
 */
export async function notifySellerOnCheckIn(itemId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-seller-on-check-in', {
      body: { item_id: itemId },
    });
    if (error) {
      console.warn('[notifySellerOnCheckIn]', error.message);
    }
  } catch (e) {
    console.warn('[notifySellerOnCheckIn]', e);
  }
}
