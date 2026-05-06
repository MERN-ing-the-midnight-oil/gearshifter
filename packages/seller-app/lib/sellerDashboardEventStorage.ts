import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSellerDashboardEventFromAuthSession,
  syncSellerDashboardEventToAuthSession,
} from 'shared';

const KEY = 'gearshifter_seller_dashboard_event_id';

export async function getSellerDashboardEventId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    const t = v?.trim();
    return t || null;
  } catch {
    return null;
  }
}

/** Persists the scoped event locally and on the auth JWT (RLS). */
export async function setSellerDashboardEventId(eventId: string): Promise<void> {
  const id = eventId.trim();
  await AsyncStorage.setItem(KEY, id);
  try {
    await syncSellerDashboardEventToAuthSession(id);
  } catch (e) {
    console.warn(
      '[sellerDashboardEventStorage] Could not sync dashboard event to auth session (deploy set-seller-dashboard-event?):',
      e
    );
  }
}

/** Clears JWT scope then local storage (call while still signed in). */
export async function clearSellerDashboardEventId(): Promise<void> {
  try {
    await clearSellerDashboardEventFromAuthSession();
  } catch (e) {
    console.warn(
      '[sellerDashboardEventStorage] Could not clear dashboard event on auth session:',
      e
    );
  }
  await AsyncStorage.removeItem(KEY);
}
