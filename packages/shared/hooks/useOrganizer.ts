import { useEffect, useState } from 'react';
import { getAdminOrganization, getOrganizationEvents, getEventStats } from '../api/events';
import type { Organization, EventWithOrganization } from '../types/models';

export function useAdminOrganization(adminUserId: string | null) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!adminUserId) {
      setLoading(false);
      return;
    }
    loadOrganization();
  }, [adminUserId]);

  const loadOrganization = async () => {
    if (!adminUserId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminOrganization(adminUserId);
      setOrganization(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load organization'));
    } finally {
      setLoading(false);
    }
  };

  return { organization, loading, error, refetch: loadOrganization };
}

export function useOrganizationEvents(adminUserId: string | null) {
  const [events, setEvents] = useState<EventWithOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!adminUserId) {
      setLoading(false);
      return;
    }
    loadEvents();
  }, [adminUserId]);

  const loadEvents = async () => {
    if (!adminUserId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getOrganizationEvents(adminUserId);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load events'));
    } finally {
      setLoading(false);
    }
  };

  return { events, loading, error, refetch: loadEvents };
}

export function useEventStats(eventId: string | null) {
  const [stats, setStats] = useState<{
    totalItems: number;
    pendingItems: number;
    checkedInItems: number;
    forSaleItems: number;
    soldItems: number;
    donatedItems: number;
    totalRevenue: number;
    totalCommission: number;
    totalPayouts: number;
    uniqueSellerCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    loadStats();
  }, [eventId]);

  const loadStats = async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getEventStats(eventId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load event stats'));
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refetch: loadStats };
}

