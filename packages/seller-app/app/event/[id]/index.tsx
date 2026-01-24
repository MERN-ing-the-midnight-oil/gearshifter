import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEvent } from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from 'shared';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading, error } = useEvent(id);
  const { user } = useAuth();
  const router = useRouter();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
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

  const isRegistrationOpen = () => {
    if (!event) return false;
    const now = new Date();
    const openDate = new Date(event.registrationOpenDate);
    const closeDate = new Date(event.registrationCloseDate);
    return now >= openDate && now <= closeDate && event.status === 'registration';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load event</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{event.name}</Text>
        {event.organization && (
          <Text style={styles.organizationName}>{event.organization.name}</Text>
        )}
        <View style={[styles.eventStatusBadge, getEventStatusBadgeStyle(event.status)]}>
          <Text style={styles.eventStatusText}>{formatEventStatus(event.status)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(event.eventDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Shop Hours</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(event.shopOpenTime)} - {formatDateTime(event.shopCloseTime)}
            </Text>
          </View>
          {event.organization && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Commission Rate</Text>
                <Text style={styles.detailValue}>
                  {Math.round(event.organization.commissionRate * 100)}%
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vendor Commission</Text>
                <Text style={styles.detailValue}>
                  {Math.round(event.organization.vendorCommissionRate * 100)}%
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Opens</Text>
            <Text style={styles.detailValue}>{formatDate(event.registrationOpenDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Closes</Text>
            <Text style={styles.detailValue}>{formatDate(event.registrationCloseDate)}</Text>
          </View>
          {isRegistrationOpen() ? (
            <View style={styles.registrationOpen}>
              <Text style={styles.registrationOpenText}>✓ Registration is currently open</Text>
            </View>
          ) : (
            <View style={styles.registrationClosed}>
              <Text style={styles.registrationClosedText}>
                {new Date() < new Date(event.registrationOpenDate)
                  ? 'Registration opens soon'
                  : 'Registration has closed'}
              </Text>
            </View>
          )}
        </View>

        {event.priceDropTime && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Reduction</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price Drop Time</Text>
              <Text style={styles.detailValue}>{formatDateTime(event.priceDropTime)}</Text>
            </View>
          </View>
        )}

        {isRegistrationOpen() && user && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/event/${event.id}/add-item`)}
            >
              <Text style={styles.primaryButtonText}>Add Items to This Event</Text>
            </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  organizationName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  eventStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  eventStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  content: {
    padding: 20,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  registrationOpen: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  registrationOpenText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  registrationClosed: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  registrationClosedText: {
    fontSize: 14,
    color: '#E65100',
  },
  actionSection: {
    marginTop: 8,
  },
  primaryButton: {
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
  primaryButtonText: {
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
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

