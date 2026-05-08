import { useCallback, useEffect, useState } from 'react';
import { getEvent, type EventWithOrganization } from '../api/events';

export function useEvent(eventId: string | null) {
  const [event, setEvent] = useState<EventWithOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setEvent(null);
        const data = await getEvent(eventId);
        if (!cancelled) setEvent(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load event'));
          setEvent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const refetch = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getEvent(eventId);
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load event'));
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  return { event, loading, error, refetch };
}
