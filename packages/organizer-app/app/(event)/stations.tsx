import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useAdminUser } from 'shared';
import { theme } from '../../lib/theme';

export default function StationsScreen() {
  const router = useRouter();
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { adminUser } = useAdminUser(user?.id ?? null);

  if (!eventId) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Stations</Text>
          <Text style={styles.subtitle}>No event selected.</Text>
        </View>
      </ScrollView>
    );
  }

  const perms = adminUser?.permissions?.stations;
  const isOrgAdmin = adminUser?.is_org_admin === true;
  const isAdmin = adminUser?.role === 'admin';
  const canCheckIn = isOrgAdmin || perms?.check_in;
  const canPos = isOrgAdmin || perms?.pos;
  // Pickup (payout amounts) and Reports (financial data, export, declare closed) are admin-only
  const canPickup = isAdmin;
  const canReports = isAdmin;

  const stations = [
    canCheckIn && { id: 'check-in', title: 'Check-in', subtitle: 'Register sellers and check in items', icon: '📋', path: `/(event)/check-in?id=${eventId}` },
    canPos && { id: 'pos', title: 'POS', subtitle: 'Ring up sales and record transactions', icon: '💳', path: `/(event)/pos/index?id=${eventId}` },
    canPickup && { id: 'pickup', title: 'Pickup', subtitle: 'Seller pickup and payout', icon: '📦', path: `/(event)/pickup/index?id=${eventId}` },
    canReports && { id: 'reports', title: 'Reports', subtitle: 'View reports and export data', icon: '📊', path: `/(event)/reports/index?id=${eventId}` },
  ].filter(Boolean) as { id: string; title: string; subtitle: string; icon: string; path: string }[];

  if (stations.length === 0) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Stations</Text>
          <Text style={styles.subtitle}>You don’t have access to any stations for this event.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Stations</Text>
        <Text style={styles.subtitle}>Choose a station (access is based on your permissions)</Text>
      </View>
      <View style={styles.options}>
        {stations.map((station) => (
          <TouchableOpacity
            key={station.id}
            style={styles.optionCard}
            onPress={() => router.push(station.path as any)}
          >
            <Text style={styles.optionIcon}>{station.icon}</Text>
            <Text style={styles.optionTitle}>{station.title}</Text>
            <Text style={styles.optionSubtitle}>{station.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
    marginBottom: 4,
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  options: {
    padding: 16,
    gap: 12,
  },
  optionCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});
