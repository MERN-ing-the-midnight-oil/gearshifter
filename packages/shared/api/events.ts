import { supabase } from './supabase';
import type { Event, EventStatus, Organization } from '../types/models';

export interface EventWithOrganization extends Event {
  organization?: Organization;
}

/**
 * Get all events (for browsing) with organization info
 */
export const getEvents = async (): Promise<EventWithOrganization[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      organizations (
        id,
        name,
        slug,
        commission_rate,
        vendor_commission_rate
      )
    `)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data.map(mapEventWithOrgFromDb);
};

/**
 * Get upcoming events (registration open or in progress) with organization info
 */
export const getUpcomingEvents = async (): Promise<EventWithOrganization[]> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      organizations (
        id,
        name,
        slug,
        commission_rate,
        vendor_commission_rate
      )
    `)
    .or(`status.eq.registration,status.eq.checkin,status.eq.shopping`)
    .gte('event_date', now.split('T')[0])
    .order('event_date', { ascending: true })
    .limit(5);

  if (error) throw error;
  return data.map(mapEventWithOrgFromDb);
};

/**
 * Get a single event by ID with organization info
 */
export const getEvent = async (eventId: string): Promise<EventWithOrganization | null> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      organizations (
        id,
        name,
        slug,
        commission_rate,
        vendor_commission_rate
      )
    `)
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data ? mapEventWithOrgFromDb(data) : null;
};

/**
 * Get current/active event for a seller
 * Returns event where seller has items, or next upcoming event
 */
export const getCurrentEventForSeller = async (sellerId: string): Promise<Event | null> => {
  // First, try to find an event where the seller has items
  const { data: itemsWithEvents, error: itemsError } = await supabase
    .from('items')
    .select('event_id')
    .eq('seller_id', sellerId)
    .limit(1);

  if (itemsError) throw itemsError;

  if (itemsWithEvents && itemsWithEvents.length > 0) {
    const eventId = itemsWithEvents[0].event_id;
    const event = await getEvent(eventId);
    if (event) return event;
  }

  // If no items, get the next upcoming event
  const now = new Date().toISOString();
  const { data: nextEvent, error: eventError } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', now.split('T')[0])
    .order('event_date', { ascending: true })
    .limit(1)
    .single();

  if (eventError) {
    // No upcoming events
    return null;
  }

  return nextEvent ? mapEventFromDb(nextEvent) : null;
};

/**
 * Get organization for the current admin user
 */
export const getAdminOrganization = async (adminUserId: string): Promise<Organization | null> => {
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('organization_id')
    .eq('id', adminUserId)
    .single();

  if (adminError) throw adminError;
  if (!adminUser) return null;

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', adminUser.organization_id)
    .single();

  if (orgError) throw orgError;
  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    commissionRate: parseFloat(org.commission_rate),
    vendorCommissionRate: parseFloat(org.vendor_commission_rate),
    createdAt: new Date(org.created_at),
  };
};

/**
 * Get all events for the admin's organization
 */
export const getOrganizationEvents = async (adminUserId: string): Promise<EventWithOrganization[]> => {
  // First get the admin's organization
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('organization_id')
    .eq('id', adminUserId)
    .single();

  if (adminError) throw adminError;
  if (!adminUser) return [];

  // Get events for that organization
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      organizations (
        id,
        name,
        slug,
        commission_rate,
        vendor_commission_rate
      )
    `)
    .eq('organization_id', adminUser.organization_id)
    .order('event_date', { ascending: false });

  if (error) throw error;
  return data.map(mapEventWithOrgFromDb);
};

/**
 * Get event statistics for an organizer
 */
export const getEventStats = async (eventId: string) => {
  // Get total items
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, status, original_price, sold_price')
    .eq('event_id', eventId);

  if (itemsError) throw itemsError;

  // Get transactions
  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('sold_price, commission_amount, seller_amount')
    .eq('event_id', eventId);

  if (transactionsError) throw transactionsError;

  const totalItems = items?.length || 0;
  const pendingItems = items?.filter((i) => i.status === 'pending').length || 0;
  const checkedInItems = items?.filter((i) => i.status === 'checked_in').length || 0;
  const forSaleItems = items?.filter((i) => i.status === 'for_sale').length || 0;
  const soldItems = items?.filter((i) => i.status === 'sold').length || 0;
  const donatedItems = items?.filter((i) => i.status === 'donated').length || 0;

  const totalRevenue = transactions?.reduce((sum, t) => sum + (t.sold_price || 0), 0) || 0;
  const totalCommission = transactions?.reduce((sum, t) => sum + (t.commission_amount || 0), 0) || 0;
  const totalPayouts = transactions?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;

  // Get unique sellers count
  const { data: uniqueSellers, error: sellersError } = await supabase
    .from('items')
    .select('seller_id')
    .eq('event_id', eventId);

  if (sellersError) throw sellersError;
  const uniqueSellerCount = new Set(uniqueSellers?.map((i) => i.seller_id) || []).size;

  return {
    totalItems,
    pendingItems,
    checkedInItems,
    forSaleItems,
    soldItems,
    donatedItems,
    totalRevenue,
    totalCommission,
    totalPayouts,
    uniqueSellerCount,
  };
};

/**
 * Helper to map database event to Event model
 */
function mapEventFromDb(dbEvent: any): Event {
  return {
    id: dbEvent.id,
    organizationId: dbEvent.organization_id,
    name: dbEvent.name,
    eventDate: new Date(dbEvent.event_date),
    registrationOpenDate: new Date(dbEvent.registration_open_date),
    registrationCloseDate: new Date(dbEvent.registration_close_date),
    shopOpenTime: new Date(dbEvent.shop_open_time),
    shopCloseTime: new Date(dbEvent.shop_close_time),
    priceDropTime: dbEvent.price_drop_time ? new Date(dbEvent.price_drop_time) : undefined,
    status: dbEvent.status as EventStatus,
    settings: dbEvent.settings || {},
  };
}

/**
 * Helper to map database event with organization to EventWithOrganization model
 */
function mapEventWithOrgFromDb(dbEvent: any): EventWithOrganization {
  const event = mapEventFromDb(dbEvent);
  const org = dbEvent.organizations;
  
  return {
    ...event,
    organization: org ? {
      id: org.id,
      name: org.name,
      slug: org.slug,
      commissionRate: parseFloat(org.commission_rate),
      vendorCommissionRate: parseFloat(org.vendor_commission_rate),
      createdAt: new Date(org.created_at || Date.now()),
    } : undefined,
  };
}

