import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import {
  getEvent,
  getEventStats,
  declareEventClosed,
  processDonations,
  buildEventConsigneeExportCsv,
  useAuth,
  useAdminUser,
  type EventWithOrganization,
} from 'shared';
import { theme } from '../../../lib/theme';

export default function ReportsScreen() {
  const router = useRouter();
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';

  // Reports (financial data, declare closed, export) are admin-only — redirect volunteers
  useEffect(() => {
    if (adminUserLoading || !adminUser) return;
    if (adminUser.role !== 'admin') {
      router.replace(`/(event)/manage?id=${eventId}`);
    }
  }, [adminUser, adminUserLoading, router, eventId]);

  const [event, setEvent] = useState<EventWithOrganization | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getEventStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [declaringClosed, setDeclaringClosed] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canDeclareDonations = isAdmin;

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [ev, st] = await Promise.all([getEvent(eventId), getEventStats(eventId)]);
      setEvent(ev ?? null);
      setStats(st ?? null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleExportConsigneeCsv = async () => {
    if (!eventId) return;
    setExporting(true);
    try {
      const csv = await buildEventConsigneeExportCsv(eventId);
      const safeName = event?.name?.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'event';
      const filename = `consignee-export-${safeName}-${eventId.slice(0, 8)}.csv`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          title: 'Consignee export',
          message: csv,
        });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDeclareEventClosed = () => {
    if (!eventId || !event) return;
    Alert.alert(
      'Declare Event Closed — Process Donations',
      'This will mark all unclaimed donate-if-unsold items as donated. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setDeclaringClosed(true);
            try {
              await declareEventClosed(eventId);
              await processDonations(eventId);
              await load();
              Alert.alert('Done', 'Event closed for donations. Unclaimed donate-if-unsold items have been marked as donated.');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to declare event closed');
            } finally {
              setDeclaringClosed(false);
            }
          },
        },
      ]
    );
  };

  // Redirecting volunteer or still loading role — show minimal UI
  if (adminUserLoading || !isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>
          {adminUserLoading ? 'Loading...' : 'Redirecting...'}
        </Text>
      </View>
    );
  }

  if (loading && !event) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  if (!eventId || !event) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const donationAlreadyDeclared = !!event.donationDeclaredAt;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      {canDeclareDonations && (
        <View style={styles.donationSection}>
          <Text style={styles.sectionTitle}>End of event — donations</Text>
          {donationAlreadyDeclared ? (
            <View style={styles.closedBanner}>
              <Text style={styles.closedBannerText}>
                Donations declared at {event.donationDeclaredAt
                  ? new Date(event.donationDeclaredAt).toLocaleString()
                  : '—'}. Unclaimed donate-if-unsold items are marked as donated.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.helpText}>
                When the event is over, declare it closed to mark all unclaimed items that were set to “donate if unsold” as donated. After that, scanning those items will show “DONATED”; other unsold items will show “NOT PICKED UP.”
              </Text>
              <TouchableOpacity
                style={[styles.declareButton, declaringClosed && styles.declareButtonDisabled]}
                onPress={handleDeclareEventClosed}
                disabled={declaringClosed}
              >
                {declaringClosed ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.declareButtonText}>Declare Event Closed — Process Donations</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>Export</Text>
        <Text style={styles.helpText}>
          Download one row per item with consignee contact fields, status, sale amounts, and paid date. Use this for
          accounting and to see what each seller is owed.
        </Text>
        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.declareButtonDisabled]}
          onPress={handleExportConsigneeCsv}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.declareButtonText}>Export consignee report (CSV)</Text>
          )}
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalItems}</Text>
              <Text style={styles.statLabel}>Total items</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.soldItems}</Text>
              <Text style={styles.statLabel}>Sold</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.forSaleItems}</Text>
              <Text style={styles.statLabel}>For sale</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.donatedItems}</Text>
              <Text style={styles.statLabel}>Donated</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${(stats.totalRevenue ?? 0).toFixed(2)}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.uniqueSellerCount}</Text>
              <Text style={styles.statLabel}>Sellers</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: theme.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.error,
    marginBottom: 20,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.link,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  donationSection: {
    padding: 20,
    backgroundColor: theme.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  declareButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  declareButtonDisabled: {
    opacity: 0.6,
  },
  declareButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  closedBanner: {
    backgroundColor: theme.background,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  closedBannerText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  exportSection: {
    padding: 20,
    backgroundColor: theme.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  exportButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  statsSection: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    minWidth: 100,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
});
