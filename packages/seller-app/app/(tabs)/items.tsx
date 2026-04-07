import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { StaffItemQrSection } from '../../components/StaffItemQrSection';
import {
  useAuth,
  useItems,
  getCurrentSeller,
  deleteSellerPendingItem,
  getSellerFacingItemTitle,
  formatSellerItemStatusLabel,
  type Item,
  type ItemStatus,
} from 'shared';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { confirmAction } from '../../lib/alerts';

function statusBadgeStyle(status: ItemStatus) {
  switch (status) {
    case 'sold':
      return { backgroundColor: '#28A745' };
    case 'for_sale':
      return { backgroundColor: '#007AFF' };
    case 'checked_in':
      return { backgroundColor: '#6F42C1' };
    case 'pending':
      return { backgroundColor: '#FD7E14' };
    default:
      return { backgroundColor: '#6C757D' };
  }
}

export default function ItemsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sellerRecordId, setSellerRecordId] = useState<string | null>(null);
  const [sellerLookupDone, setSellerLookupDone] = useState(false);
  const { items, loading: itemsLoading, refetch, removeItemFromList } = useItems(sellerRecordId);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setSellerLookupDone(true);
      return;
    }
    let cancelled = false;
    setSellerLookupDone(false);
    (async () => {
      try {
        const seller = await getCurrentSeller(user.id);
        if (!cancelled) {
          setSellerRecordId(seller?.id ?? null);
        }
      } catch {
        if (!cancelled) setSellerRecordId(null);
      } finally {
        if (!cancelled) setSellerLookupDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDelete = (item: Item) => {
    if (item.status !== 'pending') return;
    confirmAction({
      title: 'Remove this item?',
      message:
        'You can remove it before you hand it in at the event. This cannot be undone.',
      confirmText: 'Remove',
      destructive: true,
      errorTitle: 'Could not remove',
      onConfirm: async () => {
        await deleteSellerPendingItem(item.id);
        removeItemFromList(item.id);
        await refetch();
      },
    });
  };

  if (authLoading || !sellerLookupDone) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!sellerRecordId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>My Items</Text>
        <Text style={styles.muted}>Complete seller profile to see your items.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          You can edit or remove items only while they are still pre-registered (before staff check-in at the event).
        </Text>
      </View>
      {itemsLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No items yet. Pre-register items from the Seller Event View tab.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowTop}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {getSellerFacingItemTitle(item)}
              </Text>
              <View style={[styles.pill, statusBadgeStyle(item.status)]}>
                <Text style={styles.pillText}>{formatSellerItemStatusLabel(item.status)}</Text>
              </View>
            </View>
            <Text style={styles.meta}>#{item.itemNumber}</Text>
            <StaffItemQrSection
              qrCode={item.qrCode}
              itemNumber={item.itemNumber}
              show={item.status === 'pending'}
            />
            <View style={styles.footer}>
              {item.status === 'pending' ? (
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/event/${item.eventId}/add-item?itemId=${encodeURIComponent(item.id)}`
                      )
                    }
                  >
                    <Text style={styles.edit}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={styles.remove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.lockedHint}>Handed in — contact the organizer to change</Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  muted: {
    color: '#666',
    marginTop: 8,
  },
  empty: {
    padding: 24,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  meta: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  edit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  remove: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC3545',
  },
  lockedHint: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
});
