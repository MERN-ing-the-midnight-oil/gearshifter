import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from 'shared';
import { setSellerDashboardEventId } from '../../../lib/sellerDashboardEventStorage';

function resolveEventRouteId(raw: string | string[] | undefined): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim();
  return null;
}

/**
 * Legacy `/event/:id/register` URLs (printed QR, old invites) redirect to the seller dashboard.
 * Phone verification is registration; no separate swap registration form.
 */
export default function SellerRegisterLegacyRedirect() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = resolveEventRouteId(idParam);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!eventId) return;
    void setSellerDashboardEventId(eventId);
  }, [eventId, user?.id]);

  useEffect(() => {
    if (!eventId) return;
    router.replace('/(tabs)');
  }, [eventId, router]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.caption}>Opening your dashboard…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 24,
  },
  caption: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
});
