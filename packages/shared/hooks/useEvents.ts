import { useEffect, useState } from 'react';
import { getEvents, getUpcomingEvents, getEvent, getCurrentEventForSeller, type EventWithOrganization } from '../api/events';
import type { Event } from '../types/models';

export function useEvents() {
  const [events, setEvents] = useState<EventWithOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEvents();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load events'));
    } finally {
      setLoading(false);
    }
  };

  return { events, loading, error, refetch: loadEvents };
}

export function useUpcomingEvents() {
  const [events, setEvents] = useState<EventWithOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('[useUpcomingEvents] Hook initialized, loading events...');
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      console.log('[useUpcomingEvents] Starting to load events...');
      setLoading(true);
      setError(null);
      const data = await getUpcomingEvents();
      console.log('[useUpcomingEvents] Received events:', data);
      setEvents(data);
      console.log('[useUpcomingEvents] Events set, count:', data.length);
    } catch (err) {
      console.error('[useUpcomingEvents] Error loading events:', err);
      setError(err instanceof Error ? err : new Error('Failed to load upcoming events'));
    } finally {
      setLoading(false);
      console.log('[useUpcomingEvents] Loading complete');
    }
  };

  return { events, loading, error, refetch: loadEvents };
}

export function useEvent(eventId: string | null) {
  const [event, setEvent] = useState<EventWithOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getEvent(eventId);
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load event'));
    } finally {
      setLoading(false);
    }
  };

  return { event, loading, error, refetch: loadEvent };
}

export function useCurrentEvent(sellerId: string | null) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    loadEvent();
  }, [sellerId]);

  const loadEvent = async () => {
    if (!sellerId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentEventForSeller(sellerId);
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load current event'));
    } finally {
      setLoading(false);
    }
  };

  return { event, loading, error, refetch: loadEvent };
}

