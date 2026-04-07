import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  useEvent,
  getSellerById,
  getSellerItemsByEvent,
  type Seller,
  type Item,
} from 'shared';

export default function ReviewItemsScreen() {
  const { eventId, sellerId } = useLocalSearchParams<{ eventId: string; sellerId: string }>();
  const { event, loading: eventLoading } = useEvent(eventId);
  const router = useRouter();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId || !eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, list] = await Promise.all([
          getSellerById(sellerId),
          getSellerItemsByEvent(sellerId, eventId),
        ]);
        if (!cancelled) {
          setSeller(s || null);
          setItems(list || []);
        }
      } catch (e) {
        if (!cancelled) {
          setSeller(null);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sellerId, eventId]);

  const handleBack = () => {
    router.replace(`/(event)/check-in?id=${eventId}&sellerId=${sellerId}` as any);
  };

  if (eventLoading || loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!event || !seller) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Seller or event not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review Items</Text>
        <Text style={styles.subtitle}>
          {seller.firstName} {seller.lastName}
        </Text>
        <Text style={styles.subtitleSecondary}>{seller.email}</Text>
      </View>

      {/* Seller QR code — show/print for check-in */}
      <View style={styles.qrSection}>
        <Text style={styles.qrSectionTitle}>Seller QR Code</Text>
        <Text style={styles.qrCodeValue} selectable>{seller.qrCode}</Text>
        <Text style={styles.qrHint}>
          Use this code to look up the seller at check-in, or print it for the seller.
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items registered for this event</Text>
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() =>
              router.push(
                `/(event)/check-in/add-item?sellerId=${seller.id}&eventId=${eventId}`
              )
            }
          >
            <Text style={styles.addItemButtonText}>Register Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.itemsList}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              onPress={() =>
                router.push(
                  `/(event)/check-in/item-details?itemId=${item.id}&sellerId=${seller.id}&eventId=${eventId}`
                )
              }
            >
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemNumber}>{item.itemNumber}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    styles[`status${item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', '')}` as keyof typeof styles],
                  ]}
                >
                  <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.itemDescription}>
                {item.description || (item.customFields as Record<string, unknown>)?.description || 'No description'}
              </Text>
              <Text style={styles.itemPrice}>${item.originalPrice.toFixed(2)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() =>
              router.push(
                `/(event)/check-in/add-item?sellerId=${seller.id}&eventId=${eventId}`
              )
            }
          >
            <Text style={styles.addItemButtonText}>+ Add Item</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  subtitleSecondary: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  qrSection: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  qrSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  qrCodeValue: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#007AFF',
    marginBottom: 8,
  },
  qrHint: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  itemsList: {
    padding: 20,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPending: {
    backgroundColor: '#FFF3CD',
  },
  statusCheckedin: {
    backgroundColor: '#D1ECF1',
  },
  statusForsale: {
    backgroundColor: '#D4EDDA',
  },
  statusSold: {
    backgroundColor: '#D4EDDA',
  },
  statusPickedup: {
    backgroundColor: '#E2E3E5',
  },
  statusDonated: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  addItemButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
});
