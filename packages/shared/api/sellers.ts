import { supabase } from './supabase';
import type { Seller } from '../types/models';

/**
 * Get current seller profile
 */
export const getCurrentSeller = async (userId: string): Promise<Seller | null> => {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data ? mapSellerFromDb(data) : null;
};

/**
 * Helper to map database seller to Seller model
 */
function mapSellerFromDb(dbSeller: any): Seller {
  return {
    id: dbSeller.id,
    firstName: dbSeller.first_name,
    lastName: dbSeller.last_name,
    phone: dbSeller.phone,
    email: dbSeller.email,
    qrCode: dbSeller.qr_code,
    createdAt: new Date(dbSeller.created_at),
  };
}

