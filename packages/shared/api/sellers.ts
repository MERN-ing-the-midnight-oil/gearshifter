import { supabase } from './supabase';
import type { Seller } from '../types/models';
import { generateSellerQRCode } from '../utils/qrCode';

/**
 * Get current seller profile
 */
export const getCurrentSeller = async (userId: string): Promise<Seller | null> => {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('auth_user_id', userId) // Use auth_user_id to find seller by auth user
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data ? mapSellerFromDb(data) : null;
};

/**
 * Create a new seller profile (for authenticated sellers)
 * Email is taken from auth.users and is permanent
 */
export const createSeller = async (
  userId: string,
  sellerData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string; // Must match auth.users email
  }
): Promise<Seller> => {
  // Generate a new UUID for the seller (id is now independent of auth.users after guest sellers migration)
  const sellerId = generateUUID();
  
  // Generate QR code for seller (format: SELLER-{sellerId} for org users to scan)
  const qrCode = generateSellerQRCode(sellerId);

  const { data, error } = await supabase
    .from('sellers')
    .insert({
      id: sellerId, // Independent UUID (not tied to auth.users)
      auth_user_id: userId, // Link to auth account
      first_name: sellerData.firstName,
      last_name: sellerData.lastName,
      phone: sellerData.phone,
      email: sellerData.email, // Permanent, tied to account
      qr_code: qrCode,
      is_guest: false, // This seller has an authenticated account
    })
    .select()
    .single();

  if (error) throw error;
  return mapSellerFromDb(data);
};

/**
 * Generate a UUID v4 (for guest sellers)
 */
function generateUUID(): string {
  // Use crypto.randomUUID() if available (Node 14.17+, modern browsers)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  // Fallback: generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a guest seller (for walk-in sellers without the app)
 * Org users can create seller records and item tags for sellers who don't have accounts
 * Requires photo ID verification and full contact information
 */
export const createGuestSeller = async (
  sellerData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string; // Required for guest sellers during check-in
    address: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    photoIdVerifiedBy: string; // Admin user ID who verified the photo ID
  }
): Promise<Seller> => {
  // Generate a UUID for the guest seller
  const sellerId = generateUUID();

  // Generate QR code for seller
  const qrCode = generateSellerQRCode(sellerId);

  const { data, error } = await supabase
    .from('sellers')
    .insert({
      id: sellerId,
      auth_user_id: null, // No auth account
      first_name: sellerData.firstName,
      last_name: sellerData.lastName,
      phone: sellerData.phone,
      email: sellerData.email, // Required for guest sellers
      address: sellerData.address,
      address_line2: sellerData.addressLine2 || null,
      city: sellerData.city,
      state: sellerData.state,
      zip_code: sellerData.zipCode,
      country: sellerData.country || 'USA',
      qr_code: qrCode,
      is_guest: true,
      photo_id_verified: true, // Verified during check-in
      photo_id_verified_by: sellerData.photoIdVerifiedBy,
      photo_id_verified_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return mapSellerFromDb(data);
};

/**
 * Register or clear Expo push token for sale notifications (RLS: auth_user_id = auth.uid()).
 */
export const updateSellerPushToken = async (
  authUserId: string,
  expoPushToken: string | null
): Promise<void> => {
  const { error } = await supabase
    .from('sellers')
    .update({
      expo_push_token: expoPushToken,
      expo_push_token_updated_at: expoPushToken ? new Date().toISOString() : null,
    })
    .eq('auth_user_id', authUserId);

  if (error) throw error;
};

/**
 * Link a guest seller to an auth account (when they later create an account)
 */
export const linkGuestSellerToAccount = async (
  sellerId: string,
  authUserId: string
): Promise<Seller> => {
  const { data, error } = await supabase
    .from('sellers')
    .update({
      auth_user_id: authUserId,
      is_guest: false,
    })
    .eq('id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return mapSellerFromDb(data);
};

/**
 * Update seller profile
 * Email cannot be changed (it's permanent and tied to account)
 * First name, last name, and phone can be updated
 * Address and other optional fields can be updated from swap registration
 */
export const updateSeller = async (
  userId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePhotoUrl?: string;
    address?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    marketingOptIn?: boolean;
    contactInfo?: Record<string, unknown>;
  }
): Promise<Seller> => {
  const updateData: any = {};
  if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
  if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.profilePhotoUrl !== undefined) updateData.profile_photo_url = updates.profilePhotoUrl;
  if (updates.address !== undefined) updateData.address = updates.address;
  if (updates.addressLine2 !== undefined) updateData.address_line2 = updates.addressLine2;
  if (updates.city !== undefined) updateData.city = updates.city;
  if (updates.state !== undefined) updateData.state = updates.state;
  if (updates.zipCode !== undefined) updateData.zip_code = updates.zipCode;
  if (updates.country !== undefined) updateData.country = updates.country;
  if (updates.marketingOptIn !== undefined) updateData.marketing_opt_in = updates.marketingOptIn;
  if (updates.contactInfo !== undefined) updateData.contact_info = updates.contactInfo;

  const { data, error } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapSellerFromDb(data);
};

/**
 * Get seller by ID (for org users viewing event registrations, etc.)
 */
export const getSellerById = async (sellerId: string): Promise<Seller | null> => {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', sellerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapSellerFromDb(data) : null;
};

/**
 * Get multiple sellers by IDs (e.g. for event registration list)
 */
export const getSellersByIds = async (sellerIds: string[]): Promise<Seller[]> => {
  if (sellerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .in('id', sellerIds);

  if (error) throw error;
  return (data || []).map(mapSellerFromDb);
};

/**
 * Get seller by phone number (exact match, for duplicate check during registration).
 * Pass trimmed phone; DB stores whatever format was used at registration.
 */
export const getSellerByPhone = async (phone: string): Promise<Seller | null> => {
  const trimmed = phone.trim();
  if (!trimmed.length) return null;

  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('phone', trimmed)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSellerFromDb(data) : null;
};

/**
 * Create a full seller account via Edge Function (auth user + sellers row + QR code).
 * Used by organizer app for walk-up registration. Requires service role in the function.
 */
export const createSellerViaEdgeFunction = async (payload: {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}): Promise<Seller> => {
  const { data, error } = await supabase.functions.invoke('create-seller', {
    body: payload,
  });

  if (error) throw error;
  const result = data as { seller?: unknown; error?: string };
  if (result.error) throw new Error(result.error);
  if (!result.seller) throw new Error('No seller returned from create-seller');
  return mapSellerFromDb(result.seller as Parameters<typeof mapSellerFromDb>[0]);
};

/**
 * Get seller by QR code (for org users to scan seller QR codes)
 */
export const getSellerByQRCode = async (qrCode: string): Promise<Seller | null> => {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('qr_code', qrCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data ? mapSellerFromDb(data) : null;
};

/**
 * Search sellers by name, phone, or email (for org users to find sellers)
 */
export const searchSellers = async (query: string): Promise<Seller[]> => {
  const searchTerm = `%${query}%`;
  
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .or(`first_name.ilike."${searchTerm}",last_name.ilike."${searchTerm}",phone.ilike."${searchTerm}",email.ilike."${searchTerm}"`)
    .limit(50);

  if (error) throw error;
  return data.map(mapSellerFromDb);
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
    email: dbSeller.email, // Optional for guest sellers
    qrCode: dbSeller.qr_code,
    authUserId: dbSeller.auth_user_id,
    isGuest: dbSeller.is_guest || false,
    photoIdVerified: dbSeller.photo_id_verified || false,
    photoIdVerifiedBy: dbSeller.photo_id_verified_by,
    photoIdVerifiedAt: dbSeller.photo_id_verified_at ? new Date(dbSeller.photo_id_verified_at) : undefined,
    profilePhotoUrl: dbSeller.profile_photo_url,
    address: dbSeller.address,
    addressLine2: dbSeller.address_line2,
    city: dbSeller.city,
    state: dbSeller.state,
    zipCode: dbSeller.zip_code,
    country: dbSeller.country,
    marketingOptIn: dbSeller.marketing_opt_in || false,
    contactInfo: (dbSeller.contact_info as Record<string, unknown>) || undefined,
    createdAt: new Date(dbSeller.created_at),
  };
}


