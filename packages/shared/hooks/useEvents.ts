import { useEffect, useState } from 'react';
import { getEvent, type EventWithOrganization } from '../api/events';

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
