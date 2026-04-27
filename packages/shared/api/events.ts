import { supabase } from './supabase';
import type { Event, EventStatus, EventSettings, Organization, ItemStatus } from '../types/models';
import { isItemDonatedToOrg } from '../constants/statuses';
import { isEventArchiveEligible } from '../utils/eventArchiveEligibility';
import { ensureDefaultSwapRegistrationFieldsForOrganization } from './swapRegistrationFields';

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
    .is('archived_at', null)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data.map(mapEventWithOrgFromDb);
};

/**
 * Get upcoming events (registration open or in progress) with organization info
 */
export const getUpcomingEvents = async (): Promise<EventWithOrganization[]> => {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  console.log('[getUpcomingEvents] Querying events...', { now, today });
  
  // Check auth state
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[getUpcomingEvents] Auth session:', { 
    hasSession: !!session, 
    userId: session?.user?.id 
  });
  
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
    .is('archived_at', null)
    .eq('status', 'active')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(5);

  console.log('[getUpcomingEvents] Query result:', { 
    dataCount: data?.length || 0, 
    error: error?.message,
    errorCode: error?.code,
    errorDetails: error?.details,
    errorHint: error?.hint,
    data: data 
  });

  if (error) {
    console.error('[getUpcomingEvents] Error:', error);
    throw error;
  }
  
  const mapped = data.map(mapEventWithOrgFromDb);
  console.log('[getUpcomingEvents] Mapped events:', mapped);
  return mapped;
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
    .maybeSingle();

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
    if (event) {
      // getEvent returns EventWithOrganization, but EventWithOrganization extends Event
      // so we can return it directly
      return event;
    }
  }

  // If no items, get the next upcoming event
  const now = new Date().toISOString();
  const { data: nextEvent, error: eventError } = await supabase
    .from('events')
    .select('*')
    .is('archived_at', null)
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
  console.log('[getAdminOrganization] Starting, adminUserId:', adminUserId);
  
  // Check auth session
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[getAdminOrganization] Auth session:', {
    hasSession: !!session,
    sessionUserId: session?.user?.id,
    matchesRequested: session?.user?.id === adminUserId,
  });

  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('organization_id')
    .eq('id', adminUserId)
    .maybeSingle();

  console.log('[getAdminOrganization] Admin user query result:', {
    hasData: !!adminUser,
    adminUser,
    error: adminError ? {
      message: adminError.message,
      details: adminError.details,
      hint: adminError.hint,
      code: adminError.code,
    } : null,
  });

  if (adminError) {
    // Log the error for debugging
    console.error('[getAdminOrganization] Error fetching admin user:', adminError);
    throw adminError;
  }
  if (!adminUser) {
    console.warn('[getAdminOrganization] No admin_users record found for id:', adminUserId);
    return null;
  }

  console.log('[getAdminOrganization] Found admin user, organization_id:', adminUser.organization_id);

  if (!adminUser.organization_id) {
    console.warn('[getAdminOrganization] Admin user has no organization_id');
    return null;
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', adminUser.organization_id)
    .single();

  console.log('[getAdminOrganization] Organization query result:', {
    hasData: !!org,
    org: org ? { id: org.id, name: org.name } : null,
    error: orgError ? {
      message: orgError.message,
      details: orgError.details,
      hint: orgError.hint,
      code: orgError.code,
    } : null,
  });

  if (orgError) {
    console.error('[getAdminOrganization] Error fetching organization:', orgError);
    throw orgError;
  }
  if (!org) {
    console.warn('[getAdminOrganization] No organization found for id:', adminUser.organization_id);
    return null;
  }

  const defaultPriceReductionSettings = {
    sellerCanSetReduction: true,
    sellerCanSetTime: true,
    defaultReductionTime: undefined,
    allowedReductionTimes: [],
  };

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    commissionRate: parseFloat(org.commission_rate),
    vendorCommissionRate: parseFloat(org.vendor_commission_rate),
    priceReductionSettings: (org.price_reduction_settings as any) || defaultPriceReductionSettings,
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
    .maybeSingle();

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
    .is('archived_at', null)
    .order('event_date', { ascending: false });

  if (error) throw error;
  return data.map(mapEventWithOrgFromDb);
};

/**
 * Create a new event for an organization
 * Both admins and volunteers can create events
 */
export const createEvent = async (
  organizationId: string,
  eventData: {
    name: string;
    eventDate: Date;
    registrationOpenDate?: Date;
    registrationCloseDate?: Date;
    shopOpenTime?: Date;
    shopCloseTime?: Date;
    pickupStartTime?: Date;
    pickupEndTime?: Date;
    gearDropOffStartTime?: Date;
    gearDropOffEndTime?: Date;
    gearDropOffPlace?: string;
    priceDropTime?: Date;
    status?: EventStatus;
    settings?: Record<string, unknown>;
  }
): Promise<Event> => {
  console.log('[createEvent API] Called with:', {
    organizationId,
    eventData: {
      name: eventData.name,
      eventDate: eventData.eventDate?.toISOString(),
      registrationOpenDate: eventData.registrationOpenDate?.toISOString(),
      registrationCloseDate: eventData.registrationCloseDate?.toISOString(),
      shopOpenTime: eventData.shopOpenTime?.toISOString(),
      shopCloseTime: eventData.shopCloseTime?.toISOString(),
      priceDropTime: eventData.priceDropTime?.toISOString(),
      status: eventData.status,
      settings: eventData.settings,
    },
  });

  // Serialize dates in settings to ISO strings for storage
  const serializedSettings = eventData.settings ? { ...eventData.settings } : {};
  if (serializedSettings.priceDropTimes && Array.isArray(serializedSettings.priceDropTimes)) {
    serializedSettings.priceDropTimes = (serializedSettings.priceDropTimes as Date[]).map(d => d.toISOString());
  }

  // Omit pickup / gear drop-off keys when unset so PostgREST does not reject inserts on
  // databases that have not yet run migrations adding those columns (PGRST204).
  const gearPlace = eventData.gearDropOffPlace?.trim();
  const insertData = {
    organization_id: organizationId,
    name: eventData.name,
    event_date: eventData.eventDate.toISOString().split('T')[0],
    registration_open_date: eventData.registrationOpenDate ? eventData.registrationOpenDate.toISOString().split('T')[0] : null,
    registration_close_date: eventData.registrationCloseDate ? eventData.registrationCloseDate.toISOString().split('T')[0] : null,
    shop_open_time: eventData.shopOpenTime ? eventData.shopOpenTime.toISOString() : null,
    shop_close_time: eventData.shopCloseTime ? eventData.shopCloseTime.toISOString() : null,
    ...(eventData.pickupStartTime && { pickup_start_time: eventData.pickupStartTime.toISOString() }),
    ...(eventData.pickupEndTime && { pickup_end_time: eventData.pickupEndTime.toISOString() }),
    ...(eventData.gearDropOffStartTime && { gear_drop_off_start_time: eventData.gearDropOffStartTime.toISOString() }),
    ...(eventData.gearDropOffEndTime && { gear_drop_off_end_time: eventData.gearDropOffEndTime.toISOString() }),
    ...(gearPlace ? { gear_drop_off_place: gearPlace } : {}),
    price_drop_time: eventData.priceDropTime ? eventData.priceDropTime.toISOString() : null,
    status: eventData.status || 'active',
    settings: serializedSettings,
  };

  console.log('[createEvent API] Inserting data:', insertData);

  const { data, error } = await supabase
    .from('events')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[createEvent API] Supabase error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  try {
    await ensureDefaultSwapRegistrationFieldsForOrganization(organizationId);
  } catch (e) {
    console.warn(
      '[createEvent API] Could not ensure default swap registration fields (add them in the organizer app if sellers see an empty form):',
      e
    );
  }

  console.log('[createEvent API] Success, data returned:', data);
  const mapped = mapEventFromDb(data);
  console.log('[createEvent API] Mapped event:', mapped);
  return mapped;
};

/**
 * Update an event (admin-only)
 */
export const updateEvent = async (
  eventId: string,
  eventData: {
    name?: string;
    eventDate?: Date;
    registrationOpenDate?: Date;
    registrationCloseDate?: Date;
    shopOpenTime?: Date;
    shopCloseTime?: Date;
    pickupStartTime?: Date;
    pickupEndTime?: Date;
    gearDropOffStartTime?: Date;
    gearDropOffEndTime?: Date;
    gearDropOffPlace?: string;
    priceDropTime?: Date;
    status?: EventStatus;
    itemsLocked?: boolean;
    settings?: EventSettings;
  }
): Promise<Event> => {
  const updateData: any = {};
  if (eventData.name !== undefined) updateData.name = eventData.name;
  if (eventData.eventDate !== undefined) updateData.event_date = eventData.eventDate.toISOString().split('T')[0];
  if (eventData.registrationOpenDate !== undefined) updateData.registration_open_date = eventData.registrationOpenDate ? eventData.registrationOpenDate.toISOString().split('T')[0] : null;
  if (eventData.registrationCloseDate !== undefined) updateData.registration_close_date = eventData.registrationCloseDate ? eventData.registrationCloseDate.toISOString().split('T')[0] : null;
  if (eventData.shopOpenTime !== undefined) updateData.shop_open_time = eventData.shopOpenTime ? eventData.shopOpenTime.toISOString() : null;
  if (eventData.shopCloseTime !== undefined) updateData.shop_close_time = eventData.shopCloseTime ? eventData.shopCloseTime.toISOString() : null;
  if (eventData.pickupStartTime !== undefined) updateData.pickup_start_time = eventData.pickupStartTime ? eventData.pickupStartTime.toISOString() : null;
  if (eventData.pickupEndTime !== undefined) updateData.pickup_end_time = eventData.pickupEndTime ? eventData.pickupEndTime.toISOString() : null;
  if (eventData.gearDropOffStartTime !== undefined) updateData.gear_drop_off_start_time = eventData.gearDropOffStartTime ? eventData.gearDropOffStartTime.toISOString() : null;
  if (eventData.gearDropOffEndTime !== undefined) updateData.gear_drop_off_end_time = eventData.gearDropOffEndTime ? eventData.gearDropOffEndTime.toISOString() : null;
  if (eventData.gearDropOffPlace !== undefined) updateData.gear_drop_off_place = eventData.gearDropOffPlace?.trim() || null;
  if (eventData.priceDropTime !== undefined) updateData.price_drop_time = eventData.priceDropTime ? eventData.priceDropTime.toISOString() : null;
  if (eventData.status !== undefined) updateData.status = eventData.status;
  if (eventData.itemsLocked !== undefined) updateData.items_locked = eventData.itemsLocked;
  if (eventData.settings !== undefined) {
    // Serialize dates in settings to ISO strings for storage
    const serializedSettings = { ...eventData.settings };
    if (serializedSettings.priceDropTimes && Array.isArray(serializedSettings.priceDropTimes)) {
      serializedSettings.priceDropTimes = (serializedSettings.priceDropTimes as Date[]).map(d => d.toISOString());
    }
    updateData.settings = serializedSettings;
  }

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return mapEventFromDb(data);
};

/**
 * Delete an event (admin-only)
 */
export const deleteEvent = async (eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
};

/**
 * Soft-archive an event (admin-only via RLS). Allowed from the calendar day after the event ends.
 */
export const archiveEvent = async (eventId: string): Promise<Event> => {
  const existing = await getEvent(eventId);
  if (!existing) {
    throw new Error('Event not found');
  }
  if (existing.archivedAt) {
    return existing;
  }
  if (!isEventArchiveEligible(existing)) {
    throw new Error('You can archive this event starting the day after it ends.');
  }

  const { data, error } = await supabase
    .from('events')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return mapEventFromDb(data);
};

/**
 * Declare event closed for donations. Sets donation_declared_at = now() on the event.
 * Call processDonations(eventId) after this to bulk-update donate_if_unsold + for_sale items to donated.
 */
export const declareEventClosed = async (eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .update({ donation_declared_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) throw error;
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
  const donatedItems =
    items?.filter((i) => isItemDonatedToOrg(i.status as ItemStatus)).length || 0;

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
  // Deserialize dates in settings from ISO strings
  const settings: EventSettings = dbEvent.settings || {};
  const deserializedSettings: EventSettings = { ...settings };
  if (deserializedSettings.priceDropTimes && Array.isArray(deserializedSettings.priceDropTimes)) {
    deserializedSettings.priceDropTimes = (deserializedSettings.priceDropTimes as string[]).map(s => new Date(s));
  }

  return {
    id: dbEvent.id,
    organizationId: dbEvent.organization_id,
    name: dbEvent.name,
    eventDate: new Date(dbEvent.event_date),
    registrationOpenDate: dbEvent.registration_open_date ? new Date(dbEvent.registration_open_date) : undefined,
    registrationCloseDate: dbEvent.registration_close_date ? new Date(dbEvent.registration_close_date) : undefined,
    shopOpenTime: dbEvent.shop_open_time ? new Date(dbEvent.shop_open_time) : undefined,
    shopCloseTime: dbEvent.shop_close_time ? new Date(dbEvent.shop_close_time) : undefined,
    pickupStartTime: dbEvent.pickup_start_time ? new Date(dbEvent.pickup_start_time) : undefined,
    pickupEndTime: dbEvent.pickup_end_time ? new Date(dbEvent.pickup_end_time) : undefined,
    gearDropOffStartTime: dbEvent.gear_drop_off_start_time ? new Date(dbEvent.gear_drop_off_start_time) : undefined,
    gearDropOffEndTime: dbEvent.gear_drop_off_end_time ? new Date(dbEvent.gear_drop_off_end_time) : undefined,
    gearDropOffPlace: dbEvent.gear_drop_off_place ?? undefined,
    priceDropTime: dbEvent.price_drop_time ? new Date(dbEvent.price_drop_time) : undefined,
    status: dbEvent.status as EventStatus,
    itemsLocked: !!dbEvent.items_locked,
    donationDeclaredAt: dbEvent.donation_declared_at ? new Date(dbEvent.donation_declared_at) : undefined,
    archivedAt: dbEvent.archived_at ? new Date(dbEvent.archived_at) : undefined,
    settings: deserializedSettings,
  };
}

/**
 * Helper to map database event with organization to EventWithOrganization model
 */
function mapEventWithOrgFromDb(dbEvent: any): EventWithOrganization {
  const event = mapEventFromDb(dbEvent);
  const org = dbEvent.organizations;
  
  const defaultPriceReductionSettings = {
    sellerCanSetReduction: true,
    sellerCanSetTime: true,
    defaultReductionTime: undefined,
    allowedReductionTimes: [],
  };

  return {
    ...event,
    organization: org ? {
      id: org.id,
      name: org.name,
      slug: org.slug,
      commissionRate: parseFloat(org.commission_rate),
      vendorCommissionRate: parseFloat(org.vendor_commission_rate),
      priceReductionSettings: (org.price_reduction_settings as any) || defaultPriceReductionSettings,
      createdAt: new Date(org.created_at || Date.now()),
    } : undefined,
  };
}

