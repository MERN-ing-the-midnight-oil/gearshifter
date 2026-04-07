import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  useAuth,
  getCurrentSeller,
  useSellerSaleNotifications,
  type SellerSaleNotificationRow,
} from 'shared';
import { theme } from '../../lib/theme';

function formatSaleTime(d: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function SaleRow({ row }: { row: SellerSaleNotificationRow }) {
  const title =
    row.itemLabel?.trim() ||
    (row.itemDescription?.trim() ? row.itemDescription.trim().slice(0, 80) : null) ||
    row.itemNumber ||
    'Item';
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sold: {title}</Text>
      {row.itemNumber ? (
        <Text style={styles.cardMeta}>Item # {row.itemNumber}</Text>
      ) : null}
      <Text style={styles.cardPrice}>
        Sale price ${row.soldPrice.toFixed(2)} · You receive ${row.sellerAmount.toFixed(2)}
      </Text>
      <Text style={styles.cardTime}>{formatSaleTime(row.soldAt)}</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const { rows, loading, error, refetch } = useSellerSaleNotifications(sellerId);

  useEffect(() => {
    if (!user?.id) {
      setSellerId(null);
      return;
    }
    let cancelled = false;
    getCurrentSeller(user.id)
      .then((s) => {
        if (!cancelled) setSellerId(s?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setSellerId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const empty =
    !loading && !error && rows.length === 0 && sellerId !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>
        When one of your items sells at the event, you will get a push alert and it will appear here.
      </Text>

      {loading && rows.length === 0 ? (
        <ActivityIndicator size="large" color={theme.activityIndicator} style={styles.centered} />
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {empty ? (
        <Text style={styles.empty}>No sales yet. Your sold items will show up here.</Text>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SaleRow row={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading && rows.length > 0} onRefresh={refetch} />
        }
        ListFooterComponent={
          Platform.OS === 'web' ? (
            <Text style={styles.webHint}>Push notifications require the iOS or Android app.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  lead: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  centered: {
    marginTop: 24,
  },
  error: {
    color: theme.error,
    marginBottom: 12,
  },
  empty: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  cardPrice: {
    fontSize: 15,
    color: theme.primary,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  webHint: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 24,
    textAlign: 'center',
  },
});
