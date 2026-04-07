import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import {
  getEvent,
  updateEvent,
  getOrgUsers,
  getEventSwapRegistrations,
  getSellersByIds,
  useAuth,
  useAdminUser,
  type EventWithOrganization,
  type EventStatus,
} from 'shared';
import { theme } from '../../lib/theme';

const DateTimePicker = Platform.OS !== 'web'
  ? require('@react-native-community/datetimepicker').default
  : null;

const WebDatePickerModal = ({
  visible,
  value,
  onClose,
  onSelect,
  mode = 'date',
  minimumDate,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSelect: (date: Date) => void;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(value || new Date());
  const [selectedTime, setSelectedTime] = useState<{ hours: number; minutes: number }>(() => {
    if (value) return { hours: value.getHours(), minutes: value.getMinutes() };
    return { hours: 9, minutes: 0 };
  });

  useEffect(() => {
    if (value) {
      setSelectedDate(value);
      setSelectedTime({ hours: value.getHours(), minutes: value.getMinutes() });
    }
  }, [value]);

  if (Platform.OS !== 'web') return null;

  const formatDateForInput = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const formatTimeForInput = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const handleConfirm = () => {
    const date = new Date(selectedDate);
    if (mode === 'datetime') date.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    onSelect(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={pickerStyles.content} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>{mode === 'date' ? 'Select Date' : 'Select Date & Time'}</Text>
          <View style={pickerStyles.row}>
            <Text style={pickerStyles.label}>Date</Text>
            <TextInput
              style={pickerStyles.input}
              value={formatDateForInput(selectedDate)}
              onChangeText={(t) => {
                const d = new Date(t);
                if (!isNaN(d.getTime())) setSelectedDate(d);
              }}
              {...(Platform.OS === 'web' && { type: 'date', min: minimumDate ? formatDateForInput(minimumDate) : undefined } as any)}
            />
          </View>
          {mode === 'datetime' && (
            <View style={pickerStyles.row}>
              <Text style={pickerStyles.label}>Time</Text>
              <TextInput
                style={pickerStyles.input}
                value={formatTimeForInput(selectedTime.hours, selectedTime.minutes)}
                onChangeText={(t) => {
                  const [h, m] = t.split(':').map(Number);
                  if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
                    setSelectedTime({ hours: h, minutes: m });
                  }
                }}
                {...(Platform.OS === 'web' && { type: 'time' } as any)}
              />
            </View>
          )}
          <View style={pickerStyles.actions}>
            <TouchableOpacity onPress={onClose} style={pickerStyles.cancelBtn}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={pickerStyles.confirmBtn}>
              <Text style={pickerStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    width: Platform.OS === 'web' ? 360 : '90%',
    maxWidth: 400,
  },
  title: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 16 },
  row: { marginBottom: 12 },
  label: { fontSize: 14, color: theme.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 18 },
  cancelText: { fontSize: 16, color: theme.textSecondary },
  confirmBtn: { backgroundColor: theme.button, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  confirmText: { fontSize: 16, fontWeight: '600', color: theme.buttonText },
});

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  active: 'Active',
  closed: 'Closed',
};

interface OrgUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'volunteer';
}

export default function ManageEventScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { adminUser } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [event, setEvent] = useState<EventWithOrganization | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUserRow[]>([]);
  const [registrations, setRegistrations] = useState<Awaited<ReturnType<typeof getEventSwapRegistrations>>>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<EventStatus>('active');
  const [editItemsLocked, setEditItemsLocked] = useState(false);
  const [editEventDate, setEditEventDate] = useState<Date | null>(null);
  const [editShopOpenTime, setEditShopOpenTime] = useState<Date | null>(null);
  const [editShopCloseTime, setEditShopCloseTime] = useState<Date | null>(null);
  const [editPickupStartTime, setEditPickupStartTime] = useState<Date | null>(null);
  const [editPickupEndTime, setEditPickupEndTime] = useState<Date | null>(null);
  const [editGearDropOffStartTime, setEditGearDropOffStartTime] = useState<Date | null>(null);
  const [editGearDropOffEndTime, setEditGearDropOffEndTime] = useState<Date | null>(null);
  const [editGearDropOffPlace, setEditGearDropOffPlace] = useState('');
  const [showDatePicker, setShowDatePicker] = useState<'eventDate' | 'shopOpen' | 'shopClose' | 'gearDropOffStart' | 'gearDropOffEnd' | 'pickupStart' | 'pickupEnd' | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const ev = await getEvent(eventId);
      setEvent(ev);
      if (!ev) return;
      setEditName(ev.name);
      setEditStatus(ev.status);
      setEditItemsLocked(ev.itemsLocked ?? false);

      const orgId = ev.organizationId;
      const [users, regs] = await Promise.all([
        getOrgUsers(orgId),
        getEventSwapRegistrations(eventId),
      ]);
      setOrgUsers(users as OrgUserRow[]);
      setRegistrations(regs);

      const sellerIds = [...new Set(regs.map((r) => r.sellerId))];
      if (sellerIds.length > 0) {
        const sellers = await getSellersByIds(sellerIds);
        const names: Record<string, string> = {};
        sellers.forEach((s) => {
          names[s.id] = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email || s.phone || s.id;
        });
        setSellerNames(names);
      } else {
        setSellerNames({});
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load event');
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

  const handleSaveEdit = async () => {
    if (!eventId || !event) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }
    if (!editEventDate || isNaN(editEventDate.getTime())) {
      Alert.alert('Error', 'Event date is required');
      return;
    }
    if (editShopOpenTime && editShopCloseTime && editShopCloseTime <= editShopOpenTime) {
      Alert.alert('Error', 'End date/time must be after start date/time');
      return;
    }
    if (editPickupStartTime && editPickupEndTime && editPickupEndTime <= editPickupStartTime) {
      Alert.alert('Error', 'Pickup end time must be after pickup start time');
      return;
    }
    if (editGearDropOffStartTime && editGearDropOffEndTime && editGearDropOffEndTime <= editGearDropOffStartTime) {
      Alert.alert('Error', 'Gear drop-off end time must be after start time');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateEvent(eventId, {
        name: editName.trim(),
        status: editStatus,
        itemsLocked: editItemsLocked,
        eventDate: editEventDate,
        shopOpenTime: editShopOpenTime || undefined,
        shopCloseTime: editShopCloseTime || undefined,
        gearDropOffStartTime: editGearDropOffStartTime || undefined,
        gearDropOffEndTime: editGearDropOffEndTime || undefined,
        gearDropOffPlace: editGearDropOffPlace?.trim() || undefined,
        pickupStartTime: editPickupStartTime || undefined,
        pickupEndTime: editPickupEndTime || undefined,
      });
      setEvent((prev) => (prev ? { ...prev, ...updated } : null));
      setEditModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const openStation = () => {
    if (eventId) router.push(`/(event)/stations?id=${eventId}`);
  };

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);

  if (loading && !event) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!eventId || !event) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.backButtonStandalone} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back to dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusStyle = {
    active: theme.status.active,
    closed: theme.status.closed,
  }[event.status];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Event</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Event details</Text>
          {isAdmin && (
          <TouchableOpacity
            onPress={() => {
              setEditName(event.name);
              setEditStatus(event.status);
              setEditItemsLocked(event.itemsLocked ?? false);
              const evDate = event.eventDate instanceof Date ? event.eventDate : new Date(event.eventDate);
              setEditEventDate(isNaN(evDate.getTime()) ? null : evDate);
              const openTime = event.shopOpenTime;
              setEditShopOpenTime(openTime ? (openTime instanceof Date ? openTime : new Date(openTime)) : null);
              const closeTime = event.shopCloseTime;
              setEditShopCloseTime(closeTime ? (closeTime instanceof Date ? closeTime : new Date(closeTime)) : null);
              const pickupStart = event.pickupStartTime;
              setEditPickupStartTime(pickupStart ? (pickupStart instanceof Date ? pickupStart : new Date(pickupStart)) : null);
              const pickupEnd = event.pickupEndTime;
              setEditPickupEndTime(pickupEnd ? (pickupEnd instanceof Date ? pickupEnd : new Date(pickupEnd)) : null);
              const gearStart = event.gearDropOffStartTime;
              setEditGearDropOffStartTime(gearStart ? (gearStart instanceof Date ? gearStart : new Date(gearStart)) : null);
              const gearEnd = event.gearDropOffEndTime;
              setEditGearDropOffEndTime(gearEnd ? (gearEnd instanceof Date ? gearEnd : new Date(gearEnd)) : null);
              setEditGearDropOffPlace(event.gearDropOffPlace ?? '');
              setEditModalVisible(true);
            }}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>{event.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle }]}>
              <Text style={styles.statusBadgeText}>{EVENT_STATUS_LABELS[event.status]}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event date</Text>
            <Text style={styles.detailValue}>{formatDate(event.eventDate)}</Text>
          </View>
          {event.registrationOpenDate != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registration</Text>
              <Text style={styles.detailValue}>
                {formatDate(event.registrationOpenDate)}
                {event.registrationCloseDate != null && ` – ${formatDate(event.registrationCloseDate)}`}
              </Text>
            </View>
          )}
          {(event.shopOpenTime != null || event.shopCloseTime != null) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shop hours</Text>
              <Text style={styles.detailValue}>
                {event.shopOpenTime != null ? formatTime(event.shopOpenTime) : '—'}
                {' – '}
                {event.shopCloseTime != null ? formatTime(event.shopCloseTime) : '—'}
              </Text>
            </View>
          )}
          {(event.gearDropOffStartTime != null || event.gearDropOffEndTime != null || (event.gearDropOffPlace != null && event.gearDropOffPlace.trim() !== '')) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Gear drop-off</Text>
              <Text style={styles.detailValue}>
                {(event.gearDropOffStartTime != null || event.gearDropOffEndTime != null)
                  ? `${event.gearDropOffStartTime != null ? formatTime(event.gearDropOffStartTime) : '—'} – ${event.gearDropOffEndTime != null ? formatTime(event.gearDropOffEndTime) : '—'}`
                  : '—'}
                {event.gearDropOffPlace?.trim() ? ` · ${event.gearDropOffPlace.trim()}` : ''}
              </Text>
            </View>
          )}
          {(event.pickupStartTime != null || event.pickupEndTime != null) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Seller pickup window (unsold equipment)</Text>
              <Text style={styles.detailValue}>
                {event.pickupStartTime != null ? formatTime(event.pickupStartTime) : '—'}
                {' – '}
                {event.pickupEndTime != null ? formatTime(event.pickupEndTime) : '—'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team access</Text>
        <Text style={styles.sectionSubtitle}>Organization users who can work this event</Text>
        <View style={styles.card}>
          {orgUsers.length === 0 ? (
            <Text style={styles.emptyText}>No team members found</Text>
          ) : (
            orgUsers.map((u) => (
              <View key={u.id} style={styles.listRow}>
                <View style={styles.listRowMain}>
                  <Text style={styles.listRowTitle}>
                    {u.first_name} {u.last_name}
                  </Text>
                  <Text style={styles.listRowSubtitle}>{u.email}</Text>
                </View>
                <View style={[styles.roleBadge, u.role === 'admin' && styles.roleBadgeAdmin]}>
                  <Text style={styles.roleBadgeText}>Org User · {u.role === 'admin' ? 'Admin' : 'Volunteer'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        {isAdmin && (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/(dashboard)/users')}
        >
          <Text style={styles.linkButtonText}>Manage team members →</Text>
        </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registered sellers</Text>
        <Text style={styles.sectionSubtitle}>
          {registrations.length} seller{registrations.length !== 1 ? 's' : ''} registered
        </Text>
        <View style={styles.card}>
          {registrations.length === 0 ? (
            <Text style={styles.emptyText}>No sellers registered yet</Text>
          ) : (
            registrations.map((r) => (
              <View key={r.id} style={styles.listRow}>
                <Text style={styles.listRowTitle}>{sellerNames[r.sellerId] ?? r.sellerId}</Text>
                <Text style={styles.listRowSubtitle}>
                  Registered {formatDate(r.registeredAt)}
                  {r.isComplete ? ' · Complete' : ' · Incomplete'}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={openStation}>
          <Text style={styles.primaryButtonText}>Open station (check-in, POS, pickup)</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Edit event</Text>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Event name"
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={styles.modalLabel}>Status</Text>
              <View style={styles.statusOptions}>
                {(Object.keys(EVENT_STATUS_LABELS) as EventStatus[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, editStatus === s && styles.statusOptionActive]}
                    onPress={() => setEditStatus(s)}
                  >
                    <Text style={[styles.statusOptionText, editStatus === s && styles.statusOptionTextActive]}>
                      {EVENT_STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>Items locked</Text>
              <Text style={styles.modalHint}>When on, sellers cannot add or edit items (e.g. after check-in ends).</Text>
              <TouchableOpacity
                style={[styles.statusOption, editItemsLocked && styles.statusOptionActive]}
                onPress={() => setEditItemsLocked((v) => !v)}
              >
                <Text style={[styles.statusOptionText, editItemsLocked && styles.statusOptionTextActive]}>
                  {editItemsLocked ? 'Locked' : 'Unlocked'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Event date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('eventDate')}
              >
                <Text style={[styles.datePickerButtonText, !editEventDate && styles.placeholderText]}>
                  {editEventDate
                    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(editEventDate)
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Start date & time (shop opens)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('shopOpen')}
              >
                <Text style={[styles.datePickerButtonText, !editShopOpenTime && styles.placeholderText]}>
                  {editShopOpenTime
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(editShopOpenTime)
                    : 'Select start date & time'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>End date & time (shop closes)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('shopClose')}
              >
                <Text style={[styles.datePickerButtonText, !editShopCloseTime && styles.placeholderText]}>
                  {editShopCloseTime
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(editShopCloseTime)
                    : 'Select end date & time'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Gear drop-off – start (optional)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('gearDropOffStart')}
              >
                <Text style={[styles.datePickerButtonText, !editGearDropOffStartTime && styles.placeholderText]}>
                  {editGearDropOffStartTime
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(editGearDropOffStartTime)
                    : 'Select gear drop-off start'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Gear drop-off – end (optional)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('gearDropOffEnd')}
              >
                <Text style={[styles.datePickerButtonText, !editGearDropOffEndTime && styles.placeholderText]}>
                  {editGearDropOffEndTime
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(editGearDropOffEndTime)
                    : 'Select gear drop-off end'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Gear drop-off – place (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={editGearDropOffPlace}
                onChangeText={setEditGearDropOffPlace}
                placeholder="e.g., Main Hall, 123 Oak St"
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={styles.modalLabel}>Seller pickup window – start (optional)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('pickupStart')}
              >
                <Text style={[styles.datePickerButtonText, !editPickupStartTime && styles.placeholderText]}>
                  {editPickupStartTime
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(editPickupStartTime)
                    : 'Select pickup start'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Seller pickup window – end (optional)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker('pickupEnd')}
              >
                <Text style={[styles.datePickerButtonText, !editPickupEndTime && styles.placeholderText]}>
                  {editPickupEndTime
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(editPickupEndTime)
                    : 'Select pickup end'}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'web' && (
                <>
                  <WebDatePickerModal
                    visible={showDatePicker === 'eventDate'}
                    value={editEventDate}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditEventDate(d);
                      setShowDatePicker(null);
                    }}
                    mode="date"
                  />
                  <WebDatePickerModal
                    visible={showDatePicker === 'shopOpen'}
                    value={editShopOpenTime}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditShopOpenTime(d);
                      setShowDatePicker(null);
                    }}
                    mode="datetime"
                    minimumDate={editEventDate || new Date()}
                  />
                  <WebDatePickerModal
                    visible={showDatePicker === 'shopClose'}
                    value={editShopCloseTime}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditShopCloseTime(d);
                      setShowDatePicker(null);
                    }}
                    mode="datetime"
                    minimumDate={editShopOpenTime || editEventDate || new Date()}
                  />
                  <WebDatePickerModal
                    visible={showDatePicker === 'gearDropOffStart'}
                    value={editGearDropOffStartTime}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditGearDropOffStartTime(d);
                      setShowDatePicker(null);
                    }}
                    mode="datetime"
                    minimumDate={editEventDate || new Date()}
                  />
                  <WebDatePickerModal
                    visible={showDatePicker === 'gearDropOffEnd'}
                    value={editGearDropOffEndTime}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditGearDropOffEndTime(d);
                      setShowDatePicker(null);
                    }}
                    mode="datetime"
                    minimumDate={editGearDropOffStartTime || editEventDate || new Date()}
                  />
                  <WebDatePickerModal
                    visible={showDatePicker === 'pickupStart'}
                    value={editPickupStartTime}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditPickupStartTime(d);
                      setShowDatePicker(null);
                    }}
                    mode="datetime"
                    minimumDate={editShopCloseTime || editEventDate || new Date()}
                  />
                  <WebDatePickerModal
                    visible={showDatePicker === 'pickupEnd'}
                    value={editPickupEndTime}
                    onClose={() => setShowDatePicker(null)}
                    onSelect={(d) => {
                      setEditPickupEndTime(d);
                      setShowDatePicker(null);
                    }}
                    mode="datetime"
                    minimumDate={editPickupStartTime || editShopCloseTime || editEventDate || new Date()}
                  />
                </>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'eventDate' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editEventDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditEventDate(d);
                        setShowDatePicker(null);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'shopOpen' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editShopOpenTime || editEventDate || new Date()}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditShopOpenTime(d);
                        setShowDatePicker(null);
                      }
                    }}
                    minimumDate={editEventDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'shopClose' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editShopCloseTime || editShopOpenTime || editEventDate || new Date()}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditShopCloseTime(d);
                        setShowDatePicker(null);
                      }
                    }}
                    minimumDate={editShopOpenTime || editEventDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'gearDropOffStart' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editGearDropOffStartTime || editEventDate || new Date()}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditGearDropOffStartTime(d);
                        setShowDatePicker(null);
                      }
                    }}
                    minimumDate={editEventDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'gearDropOffEnd' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editGearDropOffEndTime || editGearDropOffStartTime || editEventDate || new Date()}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditGearDropOffEndTime(d);
                        setShowDatePicker(null);
                      }
                    }}
                    minimumDate={editGearDropOffStartTime || editEventDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'pickupStart' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editPickupStartTime || editShopCloseTime || editEventDate || new Date()}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditPickupStartTime(d);
                        setShowDatePicker(null);
                      }
                    }}
                    minimumDate={editShopCloseTime || editEventDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {Platform.OS !== 'web' && showDatePicker === 'pickupEnd' && DateTimePicker && (
                <View style={styles.nativePickerWrap}>
                  <DateTimePicker
                    value={editPickupEndTime || editPickupStartTime || editShopCloseTime || editEventDate || new Date()}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android' || e.type === 'set') {
                        if (d) setEditPickupEndTime(d);
                        setShowDatePicker(null);
                      }
                    }}
                    minimumDate={editPickupStartTime || editShopCloseTime || editEventDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(null)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, saving && styles.modalSaveButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: theme.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: theme.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  backButtonStandalone: {
    paddingVertical: 8,
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
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.link,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    color: theme.text,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.pureWhite,
    textTransform: 'uppercase',
  },
  listRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listRowMain: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  listRowSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.secondary + '40',
  },
  roleBadgeAdmin: {
    backgroundColor: theme.primary + '30',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    paddingVertical: 8,
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.link,
  },
  footer: {
    padding: 16,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.buttonText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    ...(Platform.OS === 'web' && { cursor: 'default' } as any),
  },
  modalScroll: {
    maxHeight: 400,
  },
  datePickerButton: {
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: theme.text,
  },
  placeholderText: {
    color: theme.textSecondary,
  },
  nativePickerWrap: {
    marginBottom: 16,
  },
  doneButton: {
    backgroundColor: theme.button,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statusOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusOptionActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  statusOptionText: {
    fontSize: 14,
    color: theme.text,
  },
  statusOptionTextActive: {
    fontWeight: '600',
    color: theme.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  modalSaveButton: {
    backgroundColor: theme.button,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.buttonText,
  },
});
