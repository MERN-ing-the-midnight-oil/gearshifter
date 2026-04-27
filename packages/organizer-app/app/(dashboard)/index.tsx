import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAuth,
  useOrganizationEvents,
  useAdminOrganization,
  useAdminUser,
  signOut,
  deleteEvent,
  archiveEvent,
  isEventArchiveEligible,
  buildSellerEventWebInviteUrl,
} from 'shared';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../../lib/theme';

const SELLER_WEB_INVITE_ORIGIN =
  typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN
    ? process.env.EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN.trim()
    : '';

export default function OrganizerDashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id || null);
  const { organization, loading: orgLoading } = useAdminOrganization(user?.id || null);
  const { events, loading: eventsLoading, refetch: refetchEvents } = useOrganizationEvents(user?.id || null);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [copiedSellerRegUrlForEventId, setCopiedSellerRegUrlForEventId] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchEvents();
    setRefreshing(false);
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  };

  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleArchiveEvent = (event: { id: string; name: string }) => {
    const run = async () => {
      setArchivingId(event.id);
      try {
        await archiveEvent(event.id);
        await refetchEvents();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to archive event';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(message);
        } else {
          Alert.alert('Error', message);
        }
      } finally {
        setArchivingId(null);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(`Archive "${event.name}"? It will be hidden from your dashboard and seller discovery.`);
      if (!ok) return;
      void run();
    } else {
      Alert.alert(
        'Archive event',
        `Archive "${event.name}"? It will be hidden from your dashboard and seller discovery.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', onPress: () => void run() },
        ]
      );
    }
  };

  const handleDeleteEvent = (event: { id: string; name: string }) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(`Delete "${event.name}"? This cannot be undone.`);
      if (!ok) return;
      setDeletingId(event.id);
      deleteEvent(event.id)
        .then(() => refetchEvents())
        .catch((err: Error) => window.alert(err.message || 'Failed to delete event'))
        .finally(() => setDeletingId(null));
    } else {
      Alert.alert(
        'Delete event',
        `Delete "${event.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(event.id);
              try {
                await deleteEvent(event.id);
                await refetchEvents();
              } catch (err) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete event');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    }
  };

  const loading = authLoading || adminUserLoading || orgLoading || eventsLoading;
  const isAdmin = adminUser?.role === 'admin' || (!adminUser && !adminUserLoading && !!user);
  /** Invite staff: any org user who is not role volunteer (admins + org admins). */
  const canInviteStaff =
    !!organization &&
    !adminUserLoading &&
    !!adminUser &&
    adminUser.role !== 'volunteer';
  const isVolunteer = adminUser?.role === 'volunteer';

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);

  const handleSignOut = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) return;
      try {
        await signOut();
        router.replace('/(auth)/login');
      } catch (error: any) {
        window.alert(error.message || 'Failed to sign out');
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
                router.replace('/(auth)/login');
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to sign out');
              }
            },
          },
        ]
      );
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {adminUser ? (
            <View style={styles.headerUserBlock}>
              <Text style={styles.userName}>
                {adminUser.first_name} {adminUser.last_name}
              </Text>
              <Text style={styles.userType}>
                Role: {adminUser.role === 'admin' ? 'Admin' : 'Volunteer'}
                {adminUser.is_org_admin ? ' · Full org access' : ''}
              </Text>
              <Text style={styles.userHint}>
                Name is display-only. Role (below) is what controls access.
              </Text>
            </View>
          ) : user?.email ? (
            <View>
              <Text style={styles.userName}>{user.email}</Text>
              <Text style={styles.userType}>Org User</Text>
            </View>
          ) : null}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>Org Dashboard</Text>
        {organization && (
          <Text style={styles.organizationName}>{organization.name}</Text>
        )}
        {organization && !adminUserLoading && isVolunteer && (
          <View style={styles.volunteerStaffNotice} accessibilityRole="text">
            <Text style={styles.volunteerStaffNoticeTitle}>Staff invitations</Text>
            <Text style={styles.volunteerStaffNoticeText}>
              Your database role is Volunteer (limited stations). To invite staff, set role to admin and full access in
              admin_users—see scripts/sql/promote-to-org-admin.sql. A display name like “Admin User” does not change
              role.
            </Text>
          </View>
        )}
        {canInviteStaff && (
          <TouchableOpacity
            style={styles.headerCreateStaffButton}
            onPress={() => router.push('/(dashboard)/staff-accounts?create=1')}
            accessibilityRole="button"
            accessibilityLabel="Create Staff Account"
          >
            <View style={styles.staffAccountButtonContent}>
              <Ionicons name="person-add-outline" size={20} color={theme.buttonText} />
              <Text style={styles.headerCreateStaffButtonText}>Create Staff Account</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {!organization && !orgLoading && (
        <View style={styles.noOrgCard}>
          <Text style={styles.noOrgTitle}>No organization linked</Text>
          <Text style={styles.noOrgText}>
            This account ({user?.email}) isn't set up as an organizer admin yet. You can either link this account to an organization or sign out and use a different admin account.
          </Text>
          <Text style={styles.noOrgSteps}>
            To link this account: Supabase → SQL Editor → run the script{'\n'}
            <Text style={styles.noOrgCode}>scripts/sql/add-admin-by-email.sql</Text>
            {'\n'} (edit the email in the script to match yours), then refresh this page.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.noOrgSignOutButton, pressed && { opacity: 0.8 }]}
            onPress={handleSignOut}
          >
            <Text style={styles.noOrgSignOutText}>Sign out and use another account</Text>
          </Pressable>
        </View>
      )}

      {organization && isAdmin && (
        <View style={styles.orgInfoCard}>
          <View style={styles.orgInfoRow}>
            <Text style={styles.orgInfoLabel}>Commission Rate</Text>
            <Text style={styles.orgInfoValue}>
              {organization.commissionRate != null
                ? `${Math.round(organization.commissionRate * 100)}%`
                : 'Not set'}
            </Text>
          </View>
          <View style={styles.orgInfoRow}>
            <Text style={styles.orgInfoLabel}>Vendor Commission</Text>
            <Text style={styles.orgInfoValue}>
              {organization.vendorCommissionRate != null
                ? `${Math.round(organization.vendorCommissionRate * 100)}%`
                : 'Not set'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="calendar-outline" size={22} color={theme.text} style={styles.sectionTitleIcon} />
          <Text style={styles.sectionTitleText}>Events</Text>
        </View>
        {__DEV__ && !SELLER_WEB_INVITE_ORIGIN ? (
          <Text style={styles.sellerDevHintBanner}>
            Local seller simulation: set EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN=http://localhost:8082 in
            packages/organizer-app/.env to show copy-paste seller registration URLs on each event.
          </Text>
        ) : null}
        <View style={styles.sectionContent}>
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No Events Yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first event to get started
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/(dashboard)/create-event')}
            >
              <Text style={styles.createButtonText}>+ Create New {organization?.name ? `${organization.name} ` : ''}Event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.createEventButton}
              onPress={() => router.push('/(dashboard)/create-event')}
            >
              <Text style={styles.createEventButtonText}>+ Create New {organization?.name ? `${organization.name} ` : ''}Event</Text>
            </TouchableOpacity>
          <View style={styles.eventsList}>
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push(`/(event)/manage?id=${event.id}`)}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <Text style={styles.eventDate}>{formatDate(event.eventDate)}</Text>
                </View>

                <View style={styles.eventDetails}>
                  {(event.shopOpenTime != null || event.shopCloseTime != null) && (
                    <View style={styles.eventDetailRow}>
                      <Text style={styles.eventDetailIcon}>🕐</Text>
                      <Text style={styles.eventDetailText}>
                        {formatTime(event.shopOpenTime) || '—'} – {formatTime(event.shopCloseTime) || '—'}
                      </Text>
                    </View>
                  )}
                  {(event.registrationOpenDate != null || event.registrationCloseDate != null) && (
                    <View style={styles.eventDetailRow}>
                      <Text style={styles.eventDetailIcon}>📅</Text>
                      <Text style={styles.eventDetailText}>
                        Registration: {formatDate(event.registrationOpenDate) || '—'} – {formatDate(event.registrationCloseDate) || '—'}
                      </Text>
                    </View>
                  )}
                </View>

                {SELLER_WEB_INVITE_ORIGIN ? (
                  <View style={styles.sellerDevBox}>
                    <Text style={styles.sellerDevLabel}>Seller registration (browser — local dev)</Text>
                    <Text selectable style={styles.sellerDevUrl}>
                      {buildSellerEventWebInviteUrl(SELLER_WEB_INVITE_ORIGIN, event.id, 'register')}
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        const url = buildSellerEventWebInviteUrl(
                          SELLER_WEB_INVITE_ORIGIN,
                          event.id,
                          'register'
                        );
                        Clipboard.setStringAsync(url).then(() => {
                          setCopiedSellerRegUrlForEventId(event.id);
                          setTimeout(() => setCopiedSellerRegUrlForEventId(null), 2000);
                        });
                      }}
                      style={({ pressed }) => [
                        styles.sellerDevCopyBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.sellerDevCopyBtnText}>
                        {copiedSellerRegUrlForEventId === event.id ? 'Copied' : 'Copy registration URL'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.eventAction}>
                  <Text style={styles.eventActionText}>Manage Event</Text>
                  <View style={styles.eventActionRight}>
                    {isAdmin && (
                    <>
                      <Pressable
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          if (isEventArchiveEligible(event)) {
                            handleArchiveEvent(event);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.archiveButton,
                          pressed && isEventArchiveEligible(event) && { opacity: 0.7 },
                          (!isEventArchiveEligible(event) || archivingId === event.id) &&
                            styles.archiveButtonDisabled,
                        ]}
                        disabled={!isEventArchiveEligible(event) || archivingId === event.id}
                        accessibilityState={{ disabled: !isEventArchiveEligible(event) || archivingId === event.id }}
                      >
                        <Text
                          style={[
                            styles.archiveButtonText,
                            !isEventArchiveEligible(event) && styles.archiveButtonTextDisabled,
                          ]}
                        >
                          {archivingId === event.id ? 'Archiving…' : 'Archive'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleDeleteEvent(event);
                        }}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && { opacity: 0.7 },
                          deletingId === event.id && styles.deleteButtonDisabled,
                        ]}
                        disabled={deletingId === event.id}
                      >
                        <Text style={styles.deleteButtonText}>
                          {deletingId === event.id ? 'Deleting…' : 'Delete'}
                        </Text>
                      </Pressable>
                    </>
                    )}
                    <Text style={styles.eventActionArrow}>→</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          </>
        )}
        </View>
      </View>

      {organization && (
        <>
          {isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="settings-outline" size={22} color={theme.text} style={styles.sectionTitleIcon} />
              <Text style={styles.sectionTitleText}>Sale Settings</Text>
            </View>
            <View style={styles.sectionContent}>
            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/swap-registration-fields')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>👤</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Seller Registration Form</Text>
                    <Text style={styles.settingCardDescription}>
                      Create or change what's on your seller registration form
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/field-definitions')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>📝</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Item Fields</Text>
                    <Text style={styles.settingCardDescription}>
                      Configure custom fields for item registration
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/categories')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>📁</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Categories</Text>
                    <Text style={styles.settingCardDescription}>
                      Manage item categories and subcategories
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/gear-tags')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>🏷️</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Gear Tags</Text>
                    <Text style={styles.settingCardDescription}>
                      Configure printable gear tag templates
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/price-reduction-settings')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>💰</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Price Reductions</Text>
                    <Text style={styles.settingCardDescription}>
                      Configure automatic price reduction settings
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/commission-rates')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>💵</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Commission Rates</Text>
                    <Text style={styles.settingCardDescription}>
                      Configure commission rates for sellers and vendors
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => router.push('/(dashboard)/post-event-inventory')}
            >
              <View style={styles.settingCardContent}>
                <View style={styles.settingCardLeft}>
                  <Text style={styles.settingCardIcon}>📦</Text>
                  <View style={styles.settingCardText}>
                    <Text style={styles.settingCardTitle}>Post-event inventory</Text>
                    <Text style={styles.settingCardDescription}>
                      Organization-level inventory after a swap (storage, resale, donations)
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingCardArrow}>→</Text>
              </View>
            </TouchableOpacity>
            </View>
          </View>
          )}

          {canInviteStaff && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Team Management</Text>
              <View style={styles.sectionContent}>
              <TouchableOpacity
                style={styles.createStaffAccountButton}
                onPress={() => router.push('/(dashboard)/staff-accounts?create=1')}
              >
                <View style={styles.staffAccountButtonContent}>
                  <Ionicons name="person-add-outline" size={20} color={theme.buttonText} />
                  <Text style={styles.createStaffAccountButtonText}>Create Staff Account</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => router.push('/(dashboard)/staff-accounts')}
              >
                <View style={styles.settingCardContent}>
                  <View style={styles.settingCardLeft}>
                    <Text style={styles.settingCardIcon}>👥</Text>
                    <View style={styles.settingCardText}>
                      <Text style={styles.settingCardTitle}>Staff Accounts</Text>
                      <Text style={styles.settingCardDescription}>
                        Invite staff by email to set their password and join your organization
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.settingCardArrow}>→</Text>
                </View>
              </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: theme.textSecondary,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerUserBlock: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    color: theme.link,
    fontWeight: '600',
  },
  userType: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  userHint: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.error + '20',
    ...(Platform.OS === 'web' && {
      // @ts-ignore - web-specific styles
      cursor: 'pointer',
      userSelect: 'none',
    }),
  },
  signOutText: {
    fontSize: 14,
    color: theme.error,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 18,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  staffAccountButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerCreateStaffButton: {
    marginTop: 16,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 48,
    backgroundColor: theme.button,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      // @ts-ignore web pointer
      cursor: 'pointer',
    }),
  },
  headerCreateStaffButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  volunteerStaffNotice: {
    marginTop: 16,
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.secondary + '55',
    borderWidth: 1,
    borderColor: theme.border,
  },
  volunteerStaffNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 6,
  },
  volunteerStaffNoticeText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  noOrgCard: {
    margin: 16,
    padding: 20,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  noOrgTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 10,
  },
  noOrgText: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  noOrgSteps: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  noOrgCode: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 13,
    color: theme.link,
  },
  noOrgSignOutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.error + '20',
    borderRadius: 8,
  },
  noOrgSignOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.error,
  },
  orgInfoCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadowColor,
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
    color: theme.textSecondary,
  },
  orgInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
  },
  sectionTitleIcon: {
    marginRight: 10,
  },
  sectionTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  sectionContent: {
    padding: 20,
  },
  sellerDevHintBanner: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 17,
    paddingHorizontal: 20,
    paddingBottom: 8,
    marginTop: -8,
  },
  sellerDevBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sellerDevLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 6,
  },
  sellerDevUrl: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  sellerDevCopyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.button,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sellerDevCopyBtnText: {
    color: theme.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  settingCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingCardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingCardText: {
    flex: 1,
  },
  settingCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  settingCardDescription: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  settingCardArrow: {
    fontSize: 18,
    color: theme.link,
    marginLeft: 12,
  },
  eventsList: {
    gap: 16,
  },
  eventCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    marginBottom: 12,
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: theme.textSecondary,
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
    color: theme.textSecondary,
  },
  eventAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  eventActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.link,
  },
  eventActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  archiveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.secondary + '35',
    borderWidth: 1,
    borderColor: theme.border,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
    } as any),
  },
  archiveButtonDisabled: {
    opacity: 0.45,
    ...(Platform.OS === 'web' && {
      cursor: 'not-allowed',
    } as any),
  },
  archiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  archiveButtonTextDisabled: {
    color: theme.textSecondary,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.error + '20',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
    } as any),
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.error,
  },
  eventActionArrow: {
    fontSize: 18,
    color: theme.link,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },
  createButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  createEventButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  createEventButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  createStaffAccountButton: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 48,
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...(Platform.OS === 'web' && {
      // @ts-ignore web pointer
      cursor: 'pointer',
    }),
  },
  createStaffAccountButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});
