import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useUpcomingEvents } from 'shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function EventsScreen() {
  const { events, loading, error, refetch } = useUpcomingEvents();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
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

  const isRegistrationOpen = (event: any) => {
    const now = new Date();
    const openDate = new Date(event.registrationOpenDate);
    const closeDate = new Date(event.registrationCloseDate);
    return now >= openDate && now <= closeDate && event.status === 'registration';
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load events</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Events</Text>
        <Text style={styles.subtitle}>Browse and join gear swap events</Text>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No Upcoming Events</Text>
          <Text style={styles.emptyStateSubtext}>
            Check back later for new gear swap events in your area
          </Text>
        </View>
      ) : (
        <View style={styles.eventsList}>
          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              <View style={styles.eventHeader}>
                <View style={styles.eventHeaderLeft}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  {event.organization && (
                    <Text style={styles.organizationName}>{event.organization.name}</Text>
                  )}
                </View>
                <View style={[styles.eventStatusBadge, getEventStatusBadgeStyle(event.status)]}>
                  <Text style={styles.eventStatusText}>{formatEventStatus(event.status)}</Text>
                </View>
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.eventDetailRow}>
                  <Text style={styles.eventDetailIcon}>📅</Text>
                  <Text style={styles.eventDetailText}>{formatDate(event.eventDate)}</Text>
                </View>
                <View style={styles.eventDetailRow}>
                  <Text style={styles.eventDetailIcon}>🕐</Text>
                  <Text style={styles.eventDetailText}>
                    {formatDateTime(event.shopOpenTime)} - {formatDateTime(event.shopCloseTime)}
                  </Text>
                </View>
                {event.organization && (
                  <View style={styles.eventDetailRow}>
                    <Text style={styles.eventDetailIcon}>💰</Text>
                    <Text style={styles.eventDetailText}>
                      Commission: {Math.round(event.organization.commissionRate * 100)}%
                    </Text>
                  </View>
                )}
              </View>

              {isRegistrationOpen(event) && (
                <View style={styles.registrationInfo}>
                  <Text style={styles.registrationText}>
                    Registration closes {formatDate(event.registrationCloseDate)}
                  </Text>
                </View>
              )}

              {event.status === 'registration' && !isRegistrationOpen(event) && (
                <View style={styles.registrationInfo}>
                  <Text style={styles.registrationTextClosed}>
                    Registration opens {formatDate(event.registrationOpenDate)}
                  </Text>
                </View>
              )}

              <View style={styles.eventAction}>
                <Text style={styles.eventActionText}>
                  {isRegistrationOpen(event) ? 'View Details & Add Items' : 'View Details'}
                </Text>
                <Text style={styles.eventActionArrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  eventsList: {
    padding: 16,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  organizationName: {
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
  registrationInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  registrationText: {
    fontSize: 13,
    color: '#4A90E2',
    fontWeight: '500',
  },
  registrationTextClosed: {
    fontSize: 13,
    color: '#999',
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
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
