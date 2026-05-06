import { useEffect, useMemo, useState } from 'react';
import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { getSellerDashboardEventId, setSellerDashboardEventId } from './sellerDashboardEventStorage';

function readEventIdParam(
  local: { eventId?: string | string[] },
  global: { eventId?: string | string[] }
): string | null {
  const a =
    typeof local.eventId === 'string'
      ? local.eventId
      : Array.isArray(local.eventId)
        ? local.eventId[0]
        : undefined;
  const b =
    typeof global.eventId === 'string'
      ? global.eventId
      : Array.isArray(global.eventId)
        ? global.eventId[0]
        : undefined;
  const raw = (a ?? b ?? '').trim();
  return raw || null;
}

/**
 * Resolves the dashboard event: URL `eventId` (deep link) or persisted id from sign-up / add-item.
 * A valid JWT scope is set via `setSellerDashboardEventId` (Edge Function + refreshSession).
 */
export function useSellerScopedEventId(sellerRecordId: string | null) {
  const localParams = useLocalSearchParams<{ eventId?: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ eventId?: string | string[] }>();
  const paramEventId = useMemo(
    () => readEventIdParam(localParams, globalParams),
    [localParams, globalParams]
  );

  const [storedId, setStoredId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSellerDashboardEventId().then((id) => {
      if (cancelled) return;
      setStoredId(id);
      setStorageLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!paramEventId) return;
    setStoredId(paramEventId);
    void setSellerDashboardEventId(paramEventId);
  }, [paramEventId]);

  const scopedEventId = paramEventId ?? storedId ?? null;

  const scopeReady = storageLoaded;

  return { scopedEventId, scopeReady };
}
