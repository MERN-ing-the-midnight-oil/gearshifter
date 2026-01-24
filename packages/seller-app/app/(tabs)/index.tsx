import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth, useItems, useSellerStats, useCurrentEvent, useRecentTransactions, getEstimatedPayout, getFinalPayout } from 'shared';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';

export default function DashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const { items, loading: itemsLoading, refetch: refetchItems } = useItems(user?.id || null);
  const { stats, loading: statsLoading, refetch: refetchStats } = useSellerStats(user?.id || null);
  const { event: currentEvent, loading: eventLoading, refetch: refetchEvent } = useCurrentEvent(user?.id || null);
  const { transactions, loading: transactionsLoading } = useRecentTransactions(user?.id || null, 3);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<{
    estimated?: { estimatedPayout: number; itemsSold: number };
    final?: { totalPayout: number; itemsSold: number };
  } | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Load payout information when event or items change
  useEffect(() => {
    if (currentEvent && user?.id) {
      loadPayoutInfo();
    }
  }, [currentEvent?.id, stats.soldItems]);

  const loadPayoutInfo = async () => {
    if (!currentEvent || !user?.id) return;
    
    setPayoutLoading(true);
    try {
      if (currentEvent.status === 'closed' || stats.soldItems > 0) {
        // Get final payout
        const final = await getFinalPayout(user.id, currentEvent.id);
        setPayoutInfo({ final });
      } else {
        // Get estimated payout
        const estimated = await getEstimatedPayout(user.id, currentEvent.id);
        setPayoutInfo({ 
          estimated: { 
            estimatedPayout: estimated.estimatedPayout, 
            itemsSold: stats.forSaleItems + stats.checkedInItems 
          } 
        });
      }
    } catch (error) {
      console.error('Error loading payout info:', error);
    } finally {
      setPayoutLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchItems(),
      refetchStats(),
      refetchEvent(),
    ]);
    setRefreshing(false);
  };

  const loading = authLoading || itemsLoading || statsLoading || eventLoading || transactionsLoading;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  // Determine context-dependent CTA
  const getPrimaryAction = () => {
    if (!currentEvent) {
      return { label: 'Browse Events', action: () => router.push('/(tabs)/events') };
    }

    if (currentEvent.status === 'registration') {
      return { label: 'Add Items', action: () => router.push(`/event/${currentEvent.id}/add-item`) };
    }

    if (currentEvent.status === 'checkin') {
      return { label: 'Show My QR Code', action: () => router.push('/qr-code') };
    }

    if (stats.soldItems > 0) {
      return { label: 'View Sold Items', action: () => router.push('/(tabs)/items?filter=sold') };
    }

    if (currentEvent.status === 'closed') {
      return { label: 'View Event Summary', action: () => router.push(`/event/${currentEvent.id}`) };
    }

    return { label: 'View My Items', action: () => router.push('/(tabs)/items') };
  };

  const primaryAction = getPrimaryAction();

  // Get timing notes for event
  const getTimingNotes = () => {
    if (!currentEvent) return [];
    const notes: string[] = [];

    if (currentEvent.priceDropTime) {
      const now = new Date();
      if (currentEvent.priceDropTime > now) {
        notes.push(`Price drop: ${formatDateTime(currentEvent.priceDropTime)}`);
      }
    }

    if (currentEvent.status === 'pickup') {
      notes.push('Pickup window is open');
    } else if (currentEvent.status === 'shopping') {
      notes.push('Event is in progress');
    }

    return notes;
  };

  const timingNotes = getTimingNotes();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Seller Dashboard</Text>
        <Text style={styles.subtitle}>Your gear swap overview</Text>
      </View>

      {/* Current/Next Event */}
      {currentEvent && (
        <View style={styles.section}>
          <View style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View style={styles.eventHeaderLeft}>
                <Text style={styles.eventName}>{currentEvent.name}</Text>
                <Text style={styles.eventDate}>{formatDate(currentEvent.eventDate)}</Text>
              </View>
              <View style={[styles.eventStatusBadge, getEventStatusBadgeStyle(currentEvent.status)]}>
                <Text style={styles.eventStatusText}>{formatEventStatus(currentEvent.status)}</Text>
              </View>
            </View>
            {timingNotes.length > 0 && (
              <View style={styles.timingNotes}>
                {timingNotes.map((note, index) => (
                  <Text key={index} style={styles.timingNote}>{note}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Earnings Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earnings Summary</Text>
        <View style={styles.earningsCard}>
          {payoutLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : payoutInfo?.final ? (
            <>
              <Text style={styles.earningsLabel}>Final Payout</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(payoutInfo.final.totalPayout)}</Text>
              <Text style={styles.earningsSubtext}>
                {payoutInfo.final.itemsSold} {payoutInfo.final.itemsSold === 1 ? 'item' : 'items'} sold
              </Text>
            </>
          ) : payoutInfo?.estimated ? (
            <>
              <Text style={styles.earningsLabel}>Estimated Payout</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(payoutInfo.estimated.estimatedPayout)}</Text>
              <Text style={styles.earningsSubtext}>
                Based on {payoutInfo.estimated.itemsSold} {payoutInfo.estimated.itemsSold === 1 ? 'item' : 'items'} for sale
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.earningsLabel}>Items Sold</Text>
              <Text style={styles.earningsAmount}>{stats.soldItems}</Text>
              <Text style={styles.earningsSubtext}>
                {stats.soldItems === 0 ? 'No items sold yet' : 'Total items sold'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Item Status Snapshot */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Item Status</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusCount}>{stats.pendingItems}</Text>
            <Text style={styles.statusLabel}>Pending</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusCount}>{stats.checkedInItems}</Text>
            <Text style={styles.statusLabel}>Checked In</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusCount}>{stats.forSaleItems}</Text>
            <Text style={styles.statusLabel}>For Sale</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={[styles.statusCount, styles.soldCount]}>{stats.soldItems}</Text>
            <Text style={styles.statusLabel}>Sold</Text>
          </View>
          {stats.donatedItems > 0 && (
            <View style={styles.statusItem}>
              <Text style={styles.statusCount}>{stats.donatedItems}</Text>
              <Text style={styles.statusLabel}>Donated</Text>
            </View>
          )}
        </View>
      </View>

      {/* Recent Activity (Notifications) */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Text style={styles.activityIconText}>💰</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Item Sold</Text>
                <Text style={styles.activityDescription}>
                  You earned {formatCurrency(transaction.sellerAmount)}
                </Text>
                <Text style={styles.activityTime}>
                  {formatDateTime(transaction.soldAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Primary Action Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={primaryAction.action}
        >
          <Text style={styles.primaryActionText}>{primaryAction.label}</Text>
        </TouchableOpacity>
      </View>

      {/* Empty State */}
      {!currentEvent && items.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Get Started</Text>
          <Text style={styles.emptyStateSubtext}>
            Browse events and add items to start selling
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => router.push('/(tabs)/events')}
          >
            <Text style={styles.emptyStateButtonText}>Browse Events</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function formatEventStatus(status: string): string {
  const statusMap: Record<string, string> = {
    registration: 'Registration Open',
    checkin: 'Check-in',
    shopping: 'Shopping',
    pickup: 'Pickup',
    closed: 'Closed',
  };
  return statusMap[status] || status;
}

function getEventStatusBadgeStyle(status: string) {
  const styles: Record<string, { backgroundColor: string }> = {
    registration: { backgroundColor: '#4A90E2' },
    checkin: { backgroundColor: '#FFA500' },
    shopping: { backgroundColor: '#50C878' },
    pickup: { backgroundColor: '#9B59B6' },
    closed: { backgroundColor: '#6C757D' },
  };
  return styles[status] || { backgroundColor: '#6C757D' };
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
  },
  eventStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  eventStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  timingNotes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  timingNote: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#28A745',
    marginBottom: 4,
  },
  earningsSubtext: {
    fontSize: 14,
    color: '#666',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  soldCount: {
    color: '#28A745',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 24,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
