import { supabase } from './supabase';
import type { SellerSwapRegistration } from '../types/models';

/**
 * Get swap registration for a seller and event
 */
export const getSellerSwapRegistration = async (
  sellerId: string,
  eventId: string
): Promise<SellerSwapRegistration | null> => {
  const { data, error } = await supabase
    .from('seller_swap_registrations')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data ? mapRegistrationFromDb(data) : null;
};

/**
 * Get all swap registrations for a seller
 */
export const getSellerSwapRegistrations = async (
  sellerId: string
): Promise<SellerSwapRegistration[]> => {
  const { data, error } = await supabase
    .from('seller_swap_registrations')
    .select('*')
    .eq('seller_id', sellerId)
    .order('registered_at', { ascending: false });

  if (error) throw error;
  return data.map(mapRegistrationFromDb);
};

/**
 * Get all swap registrations for an event
 */
export const getEventSwapRegistrations = async (
  eventId: string
): Promise<SellerSwapRegistration[]> => {
  const { data, error } = await supabase
    .from('seller_swap_registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: false });

  if (error) throw error;
  return data.map(mapRegistrationFromDb);
};

/**
 * Create or update swap registration for a seller and event
 */
export const saveSellerSwapRegistration = async (
  sellerId: string,
  eventId: string,
  registrationData: Record<string, unknown>,
  requiredFields: string[]
): Promise<SellerSwapRegistration> => {
  // Check if all required fields are filled
  const isComplete = requiredFields.every(
    (fieldName) => registrationData[fieldName] !== undefined && registrationData[fieldName] !== null && registrationData[fieldName] !== ''
  );

  // Check if registration already exists
  const existing = await getSellerSwapRegistration(sellerId, eventId);

  if (existing) {
    // Update existing registration
    const { data, error } = await supabase
      .from('seller_swap_registrations')
      .update({
        registration_data: registrationData,
        is_complete: isComplete,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return mapRegistrationFromDb(data);
  } else {
    // Create new registration
    const { data, error } = await supabase
      .from('seller_swap_registrations')
      .insert({
        event_id: eventId,
        seller_id: sellerId,
        registration_data: registrationData,
        is_complete: isComplete,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRegistrationFromDb(data);
  }
};

/**
 * Helper to map database registration to SellerSwapRegistration model
 */
function mapRegistrationFromDb(dbRegistration: any): SellerSwapRegistration {
  return {
    id: dbRegistration.id,
    eventId: dbRegistration.event_id,
    sellerId: dbRegistration.seller_id,
    registrationData: (dbRegistration.registration_data as Record<string, unknown>) || {},
    isComplete: dbRegistration.is_complete,
    registeredAt: new Date(dbRegistration.registered_at),
    updatedAt: new Date(dbRegistration.updated_at),
  };
}








