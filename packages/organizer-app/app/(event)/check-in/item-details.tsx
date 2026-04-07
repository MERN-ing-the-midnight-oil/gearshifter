import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  getItem,
  updateItemStatus,
  useEvent,
  formatSellerItemStatusLabel,
  type Item,
  type ItemStatus,
} from 'shared';
import { printItemTag } from '../../../hardware/tagPrinter';

function organizerCheckInStatusLabel(status: ItemStatus): string {
  if (status === 'checked_in') return 'Registered';
  return formatSellerItemStatusLabel(status);
}

function statusBadgeStyleFor(status: ItemStatus) {
  switch (status) {
    case 'pending':
      return styles.statusPending;
    case 'checked_in':
      return styles.statusCheckedin;
    case 'for_sale':
      return styles.statusForsale;
    case 'sold':
      return styles.statusSold;
    case 'picked_up':
      return styles.statusPickedup;
    case 'donated':
      return styles.statusDonated;
    default:
      return styles.statusPending;
  }
}

export default function CheckInItemDetailsScreen() {
  const { itemId, sellerId, eventId } = useLocalSearchParams<{
    itemId: string;
    sellerId: string;
    eventId: string;
  }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { event } = useEvent(typeof eventId === 'string' ? eventId : null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    getItem(itemId)
      .then((data) => {
        if (!cancelled) setItem(data || null);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [itemId]);

  useEffect(() => {
    if (!item || !eventId || typeof eventId !== 'string') return;
    if (item.eventId !== eventId) {
      Alert.alert('Wrong event', 'This item belongs to a different event.');
      router.back();
    }
  }, [item, eventId, router]);

  const handleCheckIn = async () => {
    if (!item || item.status !== 'pending') return;
    setUpdating(true);
    try {
      const updated = await updateItemStatus(item.id, 'checked_in', {
        checkedInAt: new Date(),
      });
      setItem(updated);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to check in item');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkForSale = async () => {
    if (!item || item.status !== 'checked_in') return;
    setUpdating(true);
    try {
      const updated = await updateItemStatus(item.id, 'for_sale');
      setItem(updated);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to mark for sale');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintTag = async () => {
    if (!item) return;
    setPrinting(true);
    try {
      const ok = await printItemTag(item, undefined, event ?? null);
      if (!ok) {
        const msg =
          Platform.OS === 'web'
            ? 'Printing is only available when a Bluetooth printer is connected from the Stations flow.'
            : 'Could not print. Connect a thermal printer or try again.';
        Alert.alert('Print', msg);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const description =
    item.description ||
    (item.customFields && typeof item.customFields.description === 'string'
      ? item.customFields.description
      : '') ||
    'No description';
  const statusLabel = organizerCheckInStatusLabel(item.status);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Item Details</Text>
        <Text style={styles.itemNumber}>{item.itemNumber}</Text>
        <View style={[styles.statusBadge, statusBadgeStyleFor(item.status)]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        {item.status === 'pending' && (
          <Text style={styles.hintText}>
            Pre-registered online. When the seller hands in this piece of gear, tap Register item below.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.value}>{description}</Text>
        <Text style={styles.label}>Original price</Text>
        <Text style={styles.value}>${item.originalPrice.toFixed(2)}</Text>
        {item.reducedPrice != null && (
          <>
            <Text style={styles.label}>Reduced price</Text>
            <Text style={styles.value}>${item.reducedPrice.toFixed(2)}</Text>
          </>
        )}
        {item.checkedInAt && (
          <>
            <Text style={styles.label}>Checked in</Text>
            <Text style={styles.value}>{new Date(item.checkedInAt).toLocaleString()}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.secondaryButton, (printing || updating) && styles.buttonDisabled]}
          onPress={handlePrintTag}
          disabled={printing || updating}
        >
          {printing ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.secondaryButtonText}>Print label</Text>
          )}
        </TouchableOpacity>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.primaryButton, updating && styles.buttonDisabled]}
            onPress={handleCheckIn}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Register item</Text>
            )}
          </TouchableOpacity>
        )}
        {item.status === 'checked_in' && (
          <TouchableOpacity
            style={[styles.primaryButton, updating && styles.buttonDisabled]}
            onPress={handleMarkForSale}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Mark for Sale</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { marginTop: 10, color: '#666' },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  itemNumber: { fontSize: 18, fontWeight: '600', color: '#666', marginBottom: 8 },
  hintText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPending: { backgroundColor: '#FFF3CD' },
  statusCheckedin: { backgroundColor: '#D1ECF1' },
  statusForsale: { backgroundColor: '#D4EDDA' },
  statusSold: { backgroundColor: '#D4EDDA' },
  statusPickedup: { backgroundColor: '#E2E3E5' },
  statusDonated: { backgroundColor: '#F8D7DA' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  section: { padding: 20, backgroundColor: '#FFFFFF', marginTop: 12, marginHorizontal: 20, borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 },
  label: { fontSize: 12, color: '#666', marginTop: 12, marginBottom: 4 },
  value: { fontSize: 16, color: '#1A1A1A' },
  actions: { padding: 20, paddingTop: 24 },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryButtonText: { color: '#007AFF', fontSize: 18, fontWeight: '600' },
  errorText: { fontSize: 18, fontWeight: '600', color: '#DC3545', marginBottom: 20 },
  backButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
