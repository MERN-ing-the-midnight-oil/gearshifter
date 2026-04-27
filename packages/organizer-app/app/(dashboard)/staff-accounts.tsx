import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAuth,
  useAdminOrganization,
  useAdminUser,
  createStaffAccount,
  getOrgUsers,
  type AdminPermissions,
  type AdminCapabilities,
  ADMIN_CAPABILITY_KEYS,
  ADMIN_CAPABILITY_LABELS,
  DEFAULT_ADMIN_CAPABILITIES,
  type AdminCapabilityKey,
} from 'shared';
import React, { useState, useEffect, createElement } from 'react';
import { theme } from '../../lib/theme';

interface OrgUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'volunteer';
  is_org_admin?: boolean;
  permissions?: AdminPermissions | null;
  created_at: string;
}

const STATION_KEYS = ['check_in', 'pos', 'pickup', 'reports'] as const;
type StationKey = (typeof STATION_KEYS)[number];

const STATION_LABELS: Record<StationKey, string> = {
  check_in: 'Check-in',
  pos: 'POS',
  pickup: 'Pickup',
  reports: 'Reports',
};

/** Long-form copy shown when a column header is tapped */
const ADMIN_CAPABILITY_DESCRIPTIONS: Record<AdminCapabilityKey, string> = {
  create_users:
    'Create new organizer accounts for your organization, remove access, and adjust roles and abilities on this page. Does not include seller (vendor) accounts.',
  change_passwords:
    'Allowed to help people sign in: sharing initial passwords you set here, and (when you add them) flows to reset or update credentials for organizer staff.',
  manage_events:
    'Create and edit swap events—dates, registration windows, shop hours, event status, and event-specific configuration.',
  organization_settings:
    'Change organization profile, branding, swap settings, commission rates, and other settings that apply to the whole organization.',
  financial_reports:
    'Access sensitive money views: payouts, commissions, financial exports, and reconciliation-style reports. Grant only to people who should see revenue and payout detail.',
};

const STATION_DESCRIPTIONS: Record<StationKey, string> = {
  check_in:
    'Receive sellers and gear at intake: register arrivals, tag items, and move inventory into the event workflow.',
  pos:
    'Work the sales floor: ring up buyers, take payment, and handle point-of-sale actions for items for sale.',
  pickup:
    'Run end-of-event pickup: sellers collecting unsold items, final payouts, and checkout steps tied to sold gear.',
  reports:
    'View operational reports available at stations (sales summaries, lists, and other on-site reporting tied to this role).',
};

const HEADER_HELP_ADMIN_NAME =
  'Each row is an organization admin—someone who can sign in to the organizer app with the abilities shown in the columns to the right.';

const HEADER_HELP_STAFF_NAME =
  'Each row is station staff (a volunteer account). They only get the floor tools you enable in the columns to the right; they cannot manage org-wide settings unless promoted to an admin.';

const defaultStationPermissions: AdminPermissions = {
  stations: { check_in: true, pos: true, pickup: true, reports: true },
};

function AbilityColumnHeader({
  label,
  onPress,
  small,
  wideCell,
  alignLeft,
}: {
  label: string;
  onPress: () => void;
  small?: boolean;
  wideCell?: boolean;
  /** First column: left-aligned title */
  alignLeft?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.headerHit,
        wideCell && styles.headerHitWide,
        alignLeft && styles.headerHitLeft,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}`}
      accessibilityHint="Shows a detailed description of this column"
    >
      <Text
        style={[
          small ? styles.headerCellTextSmall : styles.headerCellText,
          styles.headerLinkText,
          alignLeft && styles.headerNameLinkText,
        ]}
      >
        {label}
        <Text style={styles.headerHelpCue}> ⓘ</Text>
      </Text>
    </TouchableOpacity>
  );
}

function staffAccountErrorMessage(raw: string): string {
  if (/email_exists|already registered|duplicate/i.test(raw)) {
    return [
      'That email already has an account.',
      'Remove the user under Supabase Authentication → Users, or use a different email.',
      `Details: ${raw}`,
    ].join('\n\n');
  }
  return raw;
}

function StaffFormShell({
  children,
  onSubmit,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
}) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return createElement(
    'form',
    {
      onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit();
      },
      style: { width: '100%' as const },
    },
    children
  );
}

function PermissionCell({
  checked,
  readOnly,
  onToggle,
  wide,
}: {
  checked: boolean;
  readOnly?: boolean;
  onToggle?: () => void;
  /** Wider column for admin capability headers */
  wide?: boolean;
}) {
  const cellStyle = wide ? styles.adminPermCell : styles.permCell;
  const inner = (
    <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
      {checked ? <Text style={styles.checkboxMark}>✓</Text> : <Text style={styles.checkboxEmpty}> </Text>}
    </View>
  );
  if (readOnly) {
    return <View style={cellStyle}>{inner}</View>;
  }
  return (
    <TouchableOpacity
      style={cellStyle}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      {inner}
    </TouchableOpacity>
  );
}

function isOrgAdminRow(u: OrgUserRow): boolean {
  return u.is_org_admin === true && u.role === 'admin';
}

function adminCapabilityValue(u: OrgUserRow, key: AdminCapabilityKey): boolean {
  if (!isOrgAdminRow(u)) return false;
  const a = u.permissions?.admin;
  if (!a) return true;
  return !!a[key];
}

function stationValue(u: OrgUserRow, key: StationKey): boolean {
  return !!u.permissions?.stations?.[key];
}

function rosterRoleLabel(u: OrgUserRow): string {
  if (isOrgAdminRow(u)) return 'Organization admin';
  if (u.role === 'volunteer') return 'Station staff';
  return u.role === 'admin' ? 'Admin' : String(u.role);
}

/** Org admins first (oldest account first so the primary admin tends to appear at the top), then station staff by name. */
function compareRosterRows(a: OrgUserRow, b: OrgUserRow): number {
  const aOa = isOrgAdminRow(a);
  const bOa = isOrgAdminRow(b);
  if (aOa !== bOa) return aOa ? -1 : 1;
  if (aOa && bOa) {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }
  return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, undefined, {
    sensitivity: 'base',
  });
}

export default function StaffAccountsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id || null);

  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'admin' | 'station' | null>(null);

  const [adminForm, setAdminForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [newAdminCaps, setNewAdminCaps] = useState<AdminCapabilities>(DEFAULT_ADMIN_CAPABILITIES);

  const [stationForm, setStationForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [newStationPerms, setNewStationPerms] = useState(defaultStationPermissions);

  /** Alert.alert is unreliable on web; use a Modal for column help and create feedback. */
  const [columnHelp, setColumnHelp] = useState<{ title: string; body: string } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    title: string;
    body: string;
    isError: boolean;
  } | null>(null);

  const canManageStaff = adminUser?.role === 'admin';

  useEffect(() => {
    if (adminUserLoading || !adminUser) return;
    if (adminUser.role !== 'admin') {
      router.replace('/(dashboard)');
    }
  }, [adminUser, adminUserLoading, router]);

  useEffect(() => {
    if (organization && canManageStaff) {
      loadUsers();
    }
  }, [organization, canManageStaff]);

  const loadUsers = async (opts?: { silent?: boolean }) => {
    if (!organization) return;
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      const data = await getOrgUsers(organization.id);
      setUsers(data as OrgUserRow[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load staff';
      if (Platform.OS === 'web') {
        setActionFeedback({ title: 'Could not load accounts', body: message, isError: true });
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const setNewStationKey = (key: StationKey, value: boolean) => {
    setNewStationPerms((prev) => ({
      stations: { ...prev.stations, [key]: value },
    }));
  };

  const setNewAdminCap = (key: AdminCapabilityKey, value: boolean) => {
    setNewAdminCaps((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateAdmin = async () => {
    if (!organization) {
      Alert.alert('Error', 'Organization not found');
      return;
    }
    if (!adminForm.firstName.trim() || !adminForm.lastName.trim()) {
      Alert.alert('Error', 'Please enter first and last name');
      return;
    }
    if (!adminForm.email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    if (adminForm.password.trim().length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setSubmitting('admin');
    try {
      await createStaffAccount({
        organizationId: organization.id,
        firstName: adminForm.firstName.trim(),
        lastName: adminForm.lastName.trim(),
        email: adminForm.email.trim().toLowerCase(),
        staffLevel: 'full',
        delivery: 'password',
        password: adminForm.password,
        permissions: {
          stations: { check_in: true, pos: true, pickup: true, reports: true },
          admin: newAdminCaps,
        },
      });

      const createdName = `${adminForm.firstName.trim()} ${adminForm.lastName.trim()}`;
      setAdminForm({ firstName: '', lastName: '', email: '', password: '' });
      setNewAdminCaps(DEFAULT_ADMIN_CAPABILITIES);
      await loadUsers({ silent: true });
      setActionFeedback({
        title: 'Admin created',
        body: `${createdName} can sign in with that email and password. Share the password securely. They now appear in the team roster above.`,
        isError: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create admin';
      console.error('[StaffAccounts] Create admin failed', { message, error });
      const body = staffAccountErrorMessage(message);
      if (Platform.OS === 'web') {
        setActionFeedback({ title: 'Could not create admin', body, isError: true });
      } else {
        Alert.alert('Could not create admin', body);
      }
    } finally {
      setSubmitting(null);
    }
  };

  const handleCreateStation = async () => {
    if (!organization) {
      Alert.alert('Error', 'Organization not found');
      return;
    }
    if (!stationForm.firstName.trim() || !stationForm.lastName.trim()) {
      Alert.alert('Error', 'Please enter first and last name');
      return;
    }
    if (!stationForm.email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    if (stationForm.password.trim().length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setSubmitting('station');
    try {
      await createStaffAccount({
        organizationId: organization.id,
        firstName: stationForm.firstName.trim(),
        lastName: stationForm.lastName.trim(),
        email: stationForm.email.trim().toLowerCase(),
        staffLevel: 'limited',
        delivery: 'password',
        password: stationForm.password,
        permissions: newStationPerms,
      });

      const createdName = `${stationForm.firstName.trim()} ${stationForm.lastName.trim()}`;
      setStationForm({ firstName: '', lastName: '', email: '', password: '' });
      setNewStationPerms(defaultStationPermissions);
      await loadUsers({ silent: true });
      setActionFeedback({
        title: 'Station staff created',
        body: `${createdName} can sign in with that email and password. Share the password securely. They now appear in the team roster above.`,
        isError: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create staff';
      console.error('[StaffAccounts] Create station staff failed', { message, error });
      const body = staffAccountErrorMessage(message);
      if (Platform.OS === 'web') {
        setActionFeedback({ title: 'Could not create staff', body, isError: true });
      } else {
        Alert.alert('Could not create staff', body);
      }
    } finally {
      setSubmitting(null);
    }
  };

  const sortedUsers = [...users].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, undefined, {
      sensitivity: 'base',
    })
  );

  const rosterUsers = [...users].sort(compareRosterRows);

  const orgAdmins = sortedUsers.filter(isOrgAdminRow);
  const stationStaff = sortedUsers.filter((u) => !isOrgAdminRow(u));

  if (adminUserLoading || !canManageStaff) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>{adminUserLoading ? 'Loading...' : 'Redirecting...'}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>Loading staff...</Text>
      </View>
    );
  }

  const adminNameCol = { ...styles.nameCol, width: 200 };
  const adminPermCol = { ...styles.permCol, width: 96 };

  return (
    <>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Staff Accounts</Text>
        {organization && <Text style={styles.organizationName}>{organization.name}</Text>}
        <Text style={styles.subtitle}>
          Organization admins can run the whole org (with the abilities you grant below). Station staff only use the
          check-in, sales, and pickup tools you allow. New accounts use an email and initial password you set—share
          passwords securely.
        </Text>
      </View>

      {/* Full org roster (all admin_users for this org) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team roster</Text>
        <Text style={styles.sectionHint}>
          Everyone who can sign in to the organizer app for this organization—including you and any station staff.
        </Text>
        <View style={styles.rosterCard}>
          {rosterUsers.length === 0 ? (
            <Text style={styles.emptyHint}>No accounts loaded yet.</Text>
          ) : (
            rosterUsers.map((u, index) => {
              const isSelf = user?.id === u.id;
              const isLast = index === rosterUsers.length - 1;
              return (
                <View key={u.id} style={[styles.rosterRow, isLast && styles.rosterRowLast]}>
                  <View style={styles.rosterMain}>
                    <Text style={styles.rosterName}>
                      {u.first_name} {u.last_name}
                      {isSelf ? ' · You' : ''}
                    </Text>
                    <Text style={styles.rosterEmail}>{u.email}</Text>
                  </View>
                  <View style={styles.rosterBadge}>
                    <Text style={styles.rosterBadgeText}>{rosterRoleLabel(u)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* Organization admins */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organization admins</Text>
        <Text style={styles.sectionHint}>
          Who can manage users, passwords, events, settings, and financials. Rows without saved admin abilities default
          to full access. Tap a column header (ⓘ) for details.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
          <View style={[styles.table, styles.adminTableMin]}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <View style={[styles.cell, adminNameCol]}>
                <AbilityColumnHeader
                  label="Admin"
                  alignLeft
                  onPress={() => setColumnHelp({ title: 'Admin', body: HEADER_HELP_ADMIN_NAME })}
                />
              </View>
              {ADMIN_CAPABILITY_KEYS.map((key) => (
                <View key={key} style={[styles.cell, adminPermCol]}>
                  <AbilityColumnHeader
                    label={ADMIN_CAPABILITY_LABELS[key]}
                    small
                    wideCell
                    onPress={() =>
                      setColumnHelp({
                        title: ADMIN_CAPABILITY_LABELS[key],
                        body: ADMIN_CAPABILITY_DESCRIPTIONS[key],
                      })
                    }
                  />
                </View>
              ))}
            </View>

            {orgAdmins.map((u) => (
              <View key={u.id} style={styles.tableRow}>
                <View style={[styles.cell, adminNameCol]}>
                  <Text style={styles.staffName}>
                    {u.first_name} {u.last_name}
                  </Text>
                  <Text style={styles.staffEmail}>{u.email}</Text>
                </View>
                {ADMIN_CAPABILITY_KEYS.map((key) => (
                  <PermissionCell key={key} checked={adminCapabilityValue(u, key)} readOnly wide />
                ))}
              </View>
            ))}

            <StaffFormShell onSubmit={handleCreateAdmin}>
              <View style={[styles.tableRow, styles.createRow]}>
                <View style={[styles.cell, adminNameCol]}>
                  <Text style={styles.createTitle}>Create admin</Text>
                  <TextInput
                    style={styles.input}
                    value={adminForm.firstName}
                    onChangeText={(t) => setAdminForm({ ...adminForm, firstName: t })}
                    placeholder="First name"
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.input}
                    value={adminForm.lastName}
                    onChangeText={(t) => setAdminForm({ ...adminForm, lastName: t })}
                    placeholder="Last name"
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.input}
                    value={adminForm.email}
                    onChangeText={(t) => setAdminForm({ ...adminForm, email: t })}
                    placeholder="Email (sign-in)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.input}
                    value={adminForm.password}
                    onChangeText={(t) => setAdminForm({ ...adminForm, password: t })}
                    placeholder="Initial password (min 6 characters)"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    {...(Platform.OS === 'web' ? { autoComplete: 'new-password' as const } : {})}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, submitting === 'admin' && styles.submitButtonDisabled]}
                    onPress={handleCreateAdmin}
                    disabled={submitting !== null}
                  >
                    {submitting === 'admin' ? (
                      <ActivityIndicator size="small" color={theme.buttonText} />
                    ) : (
                      <Text style={styles.submitButtonText}>Create admin</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {ADMIN_CAPABILITY_KEYS.map((key) => (
                  <PermissionCell
                    key={key}
                    checked={newAdminCaps[key]}
                    wide
                    onToggle={() => setNewAdminCap(key, !newAdminCaps[key])}
                  />
                ))}
              </View>
            </StaffFormShell>
          </View>
        </ScrollView>

        {orgAdmins.length === 0 && (
          <Text style={styles.emptyHint}>No organization admins yet besides you—add a co-admin below if needed.</Text>
        )}
      </View>

      {/* Station staff */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Station staff</Text>
        <Text style={styles.sectionHint}>
          Volunteers who work the floor: check-in, POS, pickup, and on-site reports. They cannot manage org settings or
          other users. Tap a column header (ⓘ) for details.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <View style={[styles.cell, styles.nameCol]}>
                <AbilityColumnHeader
                  label="Staff"
                  alignLeft
                  onPress={() => setColumnHelp({ title: 'Staff', body: HEADER_HELP_STAFF_NAME })}
                />
              </View>
              {STATION_KEYS.map((key) => (
                <View key={key} style={[styles.cell, styles.permCol]}>
                  <AbilityColumnHeader
                    label={STATION_LABELS[key]}
                    onPress={() =>
                      setColumnHelp({ title: STATION_LABELS[key], body: STATION_DESCRIPTIONS[key] })
                    }
                  />
                </View>
              ))}
            </View>

            {stationStaff.map((u) => (
              <View key={u.id} style={styles.tableRow}>
                <View style={[styles.cell, styles.nameCol]}>
                  <Text style={styles.staffName}>
                    {u.first_name} {u.last_name}
                  </Text>
                  <Text style={styles.staffEmail}>{u.email}</Text>
                </View>
                {STATION_KEYS.map((key) => (
                  <PermissionCell key={key} checked={stationValue(u, key)} readOnly />
                ))}
              </View>
            ))}

            <StaffFormShell onSubmit={handleCreateStation}>
              <View style={[styles.tableRow, styles.createRow]}>
                <View style={[styles.cell, styles.nameCol]}>
                  <Text style={styles.createTitle}>Create station staff</Text>
                  <TextInput
                    style={styles.input}
                    value={stationForm.firstName}
                    onChangeText={(t) => setStationForm({ ...stationForm, firstName: t })}
                    placeholder="First name"
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.input}
                    value={stationForm.lastName}
                    onChangeText={(t) => setStationForm({ ...stationForm, lastName: t })}
                    placeholder="Last name"
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.input}
                    value={stationForm.email}
                    onChangeText={(t) => setStationForm({ ...stationForm, email: t })}
                    placeholder="Email (sign-in)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.input}
                    value={stationForm.password}
                    onChangeText={(t) => setStationForm({ ...stationForm, password: t })}
                    placeholder="Initial password (min 6 characters)"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    {...(Platform.OS === 'web' ? { autoComplete: 'new-password' as const } : {})}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, submitting === 'station' && styles.submitButtonDisabled]}
                    onPress={handleCreateStation}
                    disabled={submitting !== null}
                  >
                    {submitting === 'station' ? (
                      <ActivityIndicator size="small" color={theme.buttonText} />
                    ) : (
                      <Text style={styles.submitButtonText}>Create station staff</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {STATION_KEYS.map((key) => (
                  <PermissionCell
                    key={key}
                    checked={newStationPerms.stations[key]}
                    onToggle={() => setNewStationKey(key, !newStationPerms.stations[key])}
                  />
                ))}
              </View>
            </StaffFormShell>
          </View>
        </ScrollView>

        {stationStaff.length === 0 && (
          <Text style={styles.emptyHint}>No station staff yet—add volunteers in the row above.</Text>
        )}
      </View>
    </ScrollView>

    <Modal
      visible={actionFeedback !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setActionFeedback(null)}
    >
      <View style={styles.modalRoot}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActionFeedback(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.modalCard}>
          <Text
            style={[styles.modalTitle, actionFeedback?.isError === true && styles.modalTitleError]}
          >
            {actionFeedback?.title}
          </Text>
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalBody}>{actionFeedback?.body}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.modalButton} onPress={() => setActionFeedback(null)}>
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <Modal
      visible={columnHelp !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setColumnHelp(null)}
    >
      <View style={styles.modalRoot}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setColumnHelp(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{columnHelp?.title}</Text>
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalBody}>{columnHelp?.body}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.modalButton} onPress={() => setColumnHelp(null)}>
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
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
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.link,
    fontWeight: '500',
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
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  section: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  tableScroll: {
    marginBottom: 8,
  },
  table: {
    minWidth: 520,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  adminTableMin: {
    minWidth: 720,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    alignItems: 'stretch',
  },
  tableHeaderRow: {
    backgroundColor: theme.background,
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  nameCol: {
    width: 220,
    flexGrow: 0,
    flexShrink: 0,
  },
  permCol: {
    width: 72,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
  },
  headerCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  headerCellTextSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  headerNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'left',
  },
  headerHit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  headerHitWide: {
    width: '100%',
    alignItems: 'center',
  },
  headerHitLeft: {
    alignItems: 'flex-start',
  },
  headerLinkText: {
    color: theme.link,
    textDecorationLine: 'underline',
  },
  headerNameLinkText: {
    textAlign: 'left',
  },
  headerHelpCue: {
    fontSize: 12,
    color: theme.textSecondary,
    textDecorationLine: 'none',
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  staffEmail: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  createRow: {
    backgroundColor: theme.background,
    alignItems: 'stretch',
  },
  createTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: theme.text,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: theme.button,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: theme.buttonText,
    fontSize: 15,
    fontWeight: '600',
  },
  permCell: {
    width: 72,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  adminPermCell: {
    width: 96,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  checkboxBoxChecked: {
    borderColor: theme.primary,
    backgroundColor: theme.surface,
  },
  checkboxMark: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primary,
  },
  checkboxEmpty: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  emptyHint: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
  },
  rosterCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rosterRowLast: {
    borderBottomWidth: 0,
  },
  rosterMain: {
    flex: 1,
    minWidth: 0,
  },
  rosterName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  rosterEmail: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  rosterBadge: {
    flexShrink: 0,
    backgroundColor: theme.background,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rosterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    maxWidth: 440,
    width: '88%',
    maxHeight: '88%',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    zIndex: 2,
    elevation: 4,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  modalTitleError: {
    color: theme.error,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalBody: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: theme.button,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});
