import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth, useOrganizationEvents, useAdminOrganization } from 'shared';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';

export default function OrganizerDashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id || null);
  const { events, loading: eventsLoading, refetch: refetchEvents } = useOrganizationEvents(user?.id || null);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchEvents();
    setRefreshing(false);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatEventStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      registration: 'Registration Open',
      checkin: 'Check-in',
      shopping: 'Shopping',
      pickup: 'Pickup',
      closed: 'Closed',
    };
    return statusMap[status] || status;
  };

  const getEventStatusBadgeStyle = (status: string) => {
    const styles: Record<string, { backgroundColor: string }> = {
      registration: { backgroundColor: '#4A90E2' },
      checkin: { backgroundColor: '#FFA500' },
      shopping: { backgroundColor: '#50C878' },
      pickup: { backgroundColor: '#9B59B6' },
      closed: { backgroundColor: '#6C757D' },
    };
    return styles[status] || { backgroundColor: '#6C757D' };
  };

  const loading = authLoading || orgLoading || eventsLoading;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // TODO: Re-enable authentication check later
  // if (!user) {
  //   return (
  //     <View style={styles.centerContainer}>
  //       <Text style={styles.errorText}>Not authenticated</Text>
  //       <TouchableOpacity
  //         style={styles.button}
  //         onPress={() => router.push('/(auth)/login')}
  //       >
  //         <Text style={styles.buttonText}>Go to Login</Text>
  //       </TouchableOpacity>
  //     </View>
  //   );
  // }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Org Dashboard</Text>
        {organization && (
          <Text style={styles.organizationName}>{organization.name}</Text>
        )}
      </View>

      {organization && (
        <View style={styles.orgInfoCard}>
          <View style={styles.orgInfoRow}>
            <Text style={styles.orgInfoLabel}>Commission Rate</Text>
            <Text style={styles.orgInfoValue}>
              {Math.round(organization.commissionRate * 100)}%
            </Text>
          </View>
          <View style={styles.orgInfoRow}>
            <Text style={styles.orgInfoLabel}>Vendor Commission</Text>
            <Text style={styles.orgInfoValue}>
              {Math.round(organization.vendorCommissionRate * 100)}%
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Events</Text>
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No Events Yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first event to get started
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push(`/(event)/select-mode?id=${event.id}`)}
              >
                <View style={styles.eventHeader}>
                  <View style={styles.eventHeaderLeft}>
                    <Text style={styles.eventName}>{event.name}</Text>
                    <Text style={styles.eventDate}>{formatDate(event.eventDate)}</Text>
                  </View>
                  <View style={[styles.eventStatusBadge, getEventStatusBadgeStyle(event.status)]}>
                    <Text style={styles.eventStatusText}>{formatEventStatus(event.status)}</Text>
                  </View>
                </View>

                <View style={styles.eventDetails}>
                  <View style={styles.eventDetailRow}>
                    <Text style={styles.eventDetailIcon}>🕐</Text>
                    <Text style={styles.eventDetailText}>
                      {new Date(event.shopOpenTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })} - {new Date(event.shopCloseTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.eventDetailRow}>
                    <Text style={styles.eventDetailIcon}>📅</Text>
                    <Text style={styles.eventDetailText}>
                      Registration: {formatDate(event.registrationOpenDate)} - {formatDate(event.registrationCloseDate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.eventAction}>
                  <Text style={styles.eventActionText}>Manage Event</Text>
                  <Text style={styles.eventActionArrow}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
    backgroundColor: '#F5F5F5',
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  orgInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orgInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orgInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  orgInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  eventsList: {
    gap: 16,
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
    marginBottom: 12,
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
  eventDetails: {
    marginBottom: 12,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#666',
  },
  eventAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  eventActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  eventActionArrow: {
    fontSize: 18,
    color: '#007AFF',
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
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
