import { supabase } from './supabase';

/**
 * In-memory: last successful JWT scope for the current browser/app instance.
 * Avoids burst calls to set-seller-dashboard-event + refreshSession (Supabase auth 429).
 */
let lastSynced: { userId: string; eventId: string } | null = null;

/** Serializes sync/clear so refreshSession never runs in parallel. */
let chain: Promise<void> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(() => fn());
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function resetSyncState() {
  lastSynced = null;
}

let authListenerReady = false;
if (!authListenerReady) {
  authListenerReady = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      resetSyncState();
    }
  });
}

function isRateLimitError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const any = e as { status?: number; message?: string; code?: string };
  if (any.status === 429) return true;
  const msg = typeof any.message === 'string' ? any.message : '';
  return msg.includes('429') || msg.toLowerCase().includes('rate limit');
}

/**
 * Writes `app_metadata.seller_dashboard_event_id` on the current user (service role via Edge Function),
 * then refreshes the session so PostgREST sees the new JWT claims for RLS.
 */
export async function syncSellerDashboardEventToAuthSession(eventId: string): Promise<void> {
  const trimmed = eventId.trim();
  if (!trimmed) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!sessionData.session?.access_token || !userId) return;

  if (lastSynced?.userId === userId && lastSynced.eventId === trimmed) {
    return;
  }

  await runSerialized(async () => {
    const { data: s2 } = await supabase.auth.getSession();
    const uid = s2.session?.user?.id;
    if (!s2.session?.access_token || !uid) return;
    if (lastSynced?.userId === uid && lastSynced.eventId === trimmed) {
      return;
    }

    const { data, error } = await supabase.functions.invoke('set-seller-dashboard-event', {
      body: { event_id: trimmed },
    });
    if (error) throw error;
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;
    if (errMsg) throw new Error(errMsg);

    const { error: refErr } = await supabase.auth.refreshSession();
    if (refErr) {
      if (isRateLimitError(refErr)) {
        console.warn(
          '[sellerDashboardSession] refreshSession rate limited; local event scope is set but JWT may lag until the next refresh.'
        );
        return;
      }
      throw refErr;
    }
    lastSynced = { userId: uid, eventId: trimmed };
  });
}

/**
 * Clears dashboard scope from JWT (new sign-in can set a different event). Best-effort if the function is missing.
 */
export async function clearSellerDashboardEventFromAuthSession(): Promise<void> {
  await runSerialized(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) return;

    const { data, error } = await supabase.functions.invoke('clear-seller-dashboard-event', {
      body: {},
    });
    if (error) throw error;
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;
    if (errMsg) throw new Error(errMsg);

    const { error: refErr } = await supabase.auth.refreshSession();
    if (refErr) {
      if (isRateLimitError(refErr)) {
        console.warn('[sellerDashboardSession] refreshSession rate limited while clearing dashboard event.');
        resetSyncState();
        return;
      }
      throw refErr;
    }
    resetSyncState();
  });
}
