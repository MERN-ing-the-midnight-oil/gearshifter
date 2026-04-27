import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { StaffItemQrSection } from '../../components/StaffItemQrSection';
import {
  useAuth,
  useEvents,
  getCurrentSeller,
  useItems,
  useItemsByEvent,
  deleteSellerPendingItem,
  getSellerFacingItemTitle,
  formatSellerItemStatusLabel,
  signOut,
  type Item,
  type ItemStatus,
  type Organization,
} from 'shared';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { confirmAction } from '../../lib/alerts';

/** Matches `recordSale`: seller gets listPrice × (1 − commissionRate). Rate is a decimal (e.g. 0.15 = 15%). */
function estimatedSellerProceeds(
  listPrice: number,
  commissionRate: number | null | undefined
): number {
  const r = commissionRate ?? 0;
  if (Number.isNaN(listPrice) || listPrice < 0) return 0;
  return Math.round(listPrice * (1 - r) * 100) / 100;
}

function statusBadgeStyle(status: ItemStatus) {
  switch (status) {
    case 'sold':
      return { backgroundColor: '#28A745' };
    case 'for_sale':
      return { backgroundColor: '#007AFF' };
    case 'checked_in':
      return { backgroundColor: '#6F42C1' };
    case 'pending':
      return { backgroundColor: '#FD7E14' };
    case 'picked_up':
      return { backgroundColor: '#20C997' };
    case 'donated':
    case 'donated_abandoned':
      return { backgroundColor: '#6C757D' };
    case 'unclaimed':
      return { backgroundColor: '#B8860B' };
    case 'withdrawn':
      return { backgroundColor: '#ADB5BD' };
    case 'lost':
    case 'damaged':
      return { backgroundColor: '#DC3545' };
    default:
      return { backgroundColor: '#6C757D' };
  }
}

export default function DashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const { events, loading: eventsLoading, refetch: refetchEvents } = useEvents();
  const router = useRouter();
  const localParams = useLocalSearchParams<{ eventId?: string }>();
  const globalParams = useGlobalSearchParams<{ eventId?: string }>();
  const eventIdParam =
    typeof localParams.eventId === 'string'
      ? localParams.eventId
      : typeof globalParams.eventId === 'string'
        ? globalParams.eventId
        : undefined;
  const [refreshing, setRefreshing] = useState(false);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [sellerProfileEmail, setSellerProfileEmail] = useState<string | null>(null);
  const [sellerRecordId, setSellerRecordId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [allItemsOpen, setAllItemsOpen] = useState(true);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime()),
    [events]
  );

  const {
    items: allSellerItems,
    loading: allItemsLoading,
    refetch: refetchAllSellerItems,
    removeItemFromList: removeAllSellerItemFromList,
  } = useItems(sellerRecordId);

  const {
    items: eventItems,
    loading: itemsLoading,
    refetch: refetchEventItems,
    removeItemFromList: removeEventItemFromList,
  } = useItemsByEvent(sellerRecordId, selectedEventId);

  // Deep link / redirect after add-item: ?eventId=
  useEffect(() => {
    if (!eventIdParam || typeof eventIdParam !== 'string') return;
    setSelectedEventId(eventIdParam);
  }, [eventIdParam]);

  // Load seller profile to display friendly name and items (seller row id ≠ auth user id)
  useEffect(() => {
    if (!user?.id) return;

    let isCancelled = false;

    const loadSeller = async () => {
      try {
        const seller = await getCurrentSeller(user.id);
        if (!isCancelled && seller) {
          const fullName = `${seller.firstName} ${seller.lastName}`.trim();
          setSellerName(fullName || null);
          setSellerProfileEmail(seller.email?.trim() || null);
          setSellerRecordId(seller.id);
        }
      } catch (error) {
        console.warn('Failed to load seller profile for dashboard header:', error);
      }
    };

    loadSeller();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  // Auto-select the next upcoming event once events load (chronological list)
  useEffect(() => {
    if (sortedEvents.length === 0) return;
    if (selectedEventId) return;

    const today = new Date();
    const upcoming = sortedEvents.find((event) => event.eventDate >= today);
    setSelectedEventId((upcoming || sortedEvents[0]).id);
  }, [sortedEvents, selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchEvents(), refetchEventItems(), refetchAllSellerItems()]);
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) return;
      try {
        await signOut();
        router.replace('/(auth)/login');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to sign out';
        window.alert(message);
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
              } catch (error: unknown) {
                Alert.alert(
                  'Error',
                  error instanceof Error ? error.message : 'Failed to sign out'
                );
              }
            },
          },
        ]
      );
    }
  };

  const handleDeletePendingItem = (itemId: string) => {
    confirmAction({
      title: 'Remove this item?',
      message:
        'You can remove it before you hand it in at the event. This cannot be undone.',
      confirmText: 'Remove',
      destructive: true,
      errorTitle: 'Could not remove',
      onConfirm: async () => {
        await deleteSellerPendingItem(itemId);
        removeEventItemFromList(itemId);
        removeAllSellerItemFromList(itemId);
        await Promise.all([refetchEventItems(), refetchAllSellerItems()]);
      },
    });
  };

  const loading = authLoading || eventsLoading;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Seller Dashboard</Text>
          </View>
          <View style={styles.headerRight}>
            {sellerName ? (
              <Text style={styles.headerAccountName} numberOfLines={1}>
                {sellerName}
              </Text>
            ) : null}
            {(user?.email || sellerProfileEmail) ? (
              <Text style={styles.headerAccountEmail} numberOfLines={1}>
                {user?.email ?? sellerProfileEmail}
              </Text>
            ) : null}
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
        <View
          style={[
            styles.eventDropdownShell,
            events.length === 0 && styles.eventDropdownShellDisabled,
          ]}
        >
          <View style={styles.eventCarouselHeader}>
            <Text style={styles.eventCarouselLabel}>Your events</Text>
          </View>
          {events.length === 0 ? (
            <View style={styles.eventCarouselEmpty}>
              <Text style={styles.eventCarouselEmptyText}>No events available</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventCarouselContent}
            >
              {sortedEvents.map((event, index) => {
                const selected = event.id === selectedEventId;
                const d = event.eventDate;
                const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
                const dayNum = d.getDate();
                const year = d.getFullYear();
                const thisYear = new Date().getFullYear();
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.eventTile,
                      selected && styles.eventTileSelected,
                      index < sortedEvents.length - 1 && styles.eventTileSpacing,
                    ]}
                    onPress={() => setSelectedEventId(event.id)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${event.name}, ${formatDate(d)}`}
                  >
                    <Text style={styles.eventTileMonth}>{monthShort}</Text>
                    <Text style={styles.eventTileDay}>{dayNum}</Text>
                    {year !== thisYear ? (
                      <Text style={styles.eventTileYear}>{year}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {selectedEvent && (
            <View style={styles.eventSelectedDetails}>
              <Text style={styles.eventDetailTitle} numberOfLines={3}>
                {selectedEvent.name}
              </Text>
              <Text style={styles.eventInfoLabel}>Date</Text>
              <Text style={styles.eventInfoValue}>{formatDate(selectedEvent.eventDate)}</Text>
              {selectedEvent.shopOpenTime != null && (
                <>
                  <Text style={styles.eventInfoLabel}>Event starts</Text>
                  <Text style={styles.eventInfoValue}>{formatDateTime(selectedEvent.shopOpenTime)}</Text>
                </>
              )}
              {selectedEvent.shopCloseTime != null && (
                <>
                  <Text style={styles.eventInfoLabel}>Event ends</Text>
                  <Text style={styles.eventInfoValue}>{formatDateTime(selectedEvent.shopCloseTime)}</Text>
                </>
              )}
              {(selectedEvent.gearDropOffStartTime != null || selectedEvent.gearDropOffEndTime != null || (selectedEvent.gearDropOffPlace != null && selectedEvent.gearDropOffPlace.trim() !== '')) && (
                <>
                  <Text style={styles.eventInfoLabel}>Gear drop-off</Text>
                  <Text style={styles.eventInfoValue}>
                    {(selectedEvent.gearDropOffStartTime != null || selectedEvent.gearDropOffEndTime != null)
                      ? `${selectedEvent.gearDropOffStartTime != null ? formatDateTime(selectedEvent.gearDropOffStartTime) : '—'} – ${selectedEvent.gearDropOffEndTime != null ? formatDateTime(selectedEvent.gearDropOffEndTime) : '—'}`
                      : ''}
                    {selectedEvent.gearDropOffPlace?.trim() ? (selectedEvent.gearDropOffStartTime != null || selectedEvent.gearDropOffEndTime != null ? ` · ${selectedEvent.gearDropOffPlace.trim()}` : selectedEvent.gearDropOffPlace.trim()) : ''}
                  </Text>
                </>
              )}
              {(selectedEvent.pickupStartTime != null || selectedEvent.pickupEndTime != null) ? (
                <>
                  <Text style={styles.eventInfoLabel}>Seller pickup (unsold equipment)</Text>
                  <Text style={styles.eventInfoValue}>
                    {selectedEvent.pickupStartTime != null ? formatDateTime(selectedEvent.pickupStartTime) : '—'}
                    {' – '}
                    {selectedEvent.pickupEndTime != null ? formatDateTime(selectedEvent.pickupEndTime) : '—'}
                  </Text>
                </>
              ) : selectedEvent.shopCloseTime != null && (
                <>
                  <Text style={styles.eventInfoLabel}>Seller pickup (unsold equipment)</Text>
                  <Text style={styles.eventInfoValue}>After {formatDateTime(selectedEvent.shopCloseTime)}</Text>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      {sellerRecordId && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.allItemsHeader}
            onPress={() => setAllItemsOpen((o) => !o)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: allItemsOpen }}
            accessibilityLabel={
              allItemsOpen
                ? 'Collapse list of all items you are selling'
                : 'Expand list of all items you are selling'
            }
          >
            <View style={styles.allItemsHeaderTextBlock}>
              <Text style={styles.allItemsTitle}>All items you are selling</Text>
              <Text style={styles.allItemsSubcaption}>
                Across every event ({allSellerItems.length})
              </Text>
            </View>
            <Text style={styles.allItemsChevron}>{allItemsOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {allItemsOpen &&
            (allItemsLoading && !refreshing ? (
              <View style={styles.itemsCard}>
                <View style={styles.itemsLoadingRow}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.itemsLoadingText}>Loading all items…</Text>
                </View>
              </View>
            ) : allSellerItems.length === 0 ? (
              <View style={styles.itemsCard}>
                <Text style={styles.itemsEmptyText}>
                  You do not have any items yet. Pre-register an item for an event to see it here.
                </Text>
              </View>
            ) : (
              <View style={styles.itemsListContainer}>
                {allSellerItems.map((item) => {
                  const itemEvent = events.find((e) => e.id === item.eventId) || null;
                  return (
                    <View key={item.id}>
                      {itemEvent ? (
                        <Text style={styles.allItemsEventLabel} numberOfLines={2}>
                          {itemEvent.name}
                        </Text>
                      ) : (
                        <Text style={styles.allItemsEventLabelMuted} numberOfLines={1}>
                          Event (loading…)
                        </Text>
                      )}
                      <ItemSummaryRow
                        item={item}
                        organization={itemEvent?.organization}
                        formatDate={formatDate}
                        onDeletePending={
                          item.status === 'pending'
                            ? () => handleDeletePendingItem(item.id)
                            : undefined
                        }
                        onEditPending={
                          item.status === 'pending' && itemEvent
                            ? () =>
                                router.push(
                                  `/event/${itemEvent.id}/add-item?itemId=${encodeURIComponent(item.id)}`
                                )
                            : undefined
                        }
                      />
                    </View>
                  );
                })}
              </View>
            ))}
        </View>
      )}

      {selectedEvent && sellerRecordId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your items for this event</Text>
          {itemsLoading && !refreshing ? (
            <View style={styles.itemsCard}>
              <View style={styles.itemsLoadingRow}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.itemsLoadingText}>Loading your items…</Text>
              </View>
            </View>
          ) : eventItems.length === 0 ? (
            <View style={styles.itemsCard}>
              <Text style={styles.itemsEmptyText}>
                No items yet for this event. Pre-register an item below to see it listed here.
              </Text>
            </View>
          ) : (
            <View style={styles.itemsListContainer}>
              {eventItems.map((item) => (
                <ItemSummaryRow
                  key={item.id}
                  item={item}
                  organization={selectedEvent.organization}
                  formatDate={formatDate}
                  onDeletePending={
                    item.status === 'pending' ? () => handleDeletePendingItem(item.id) : undefined
                  }
                  onEditPending={
                    item.status === 'pending' && selectedEvent
                      ? () =>
                          router.push(
                            `/event/${selectedEvent.id}/add-item?itemId=${encodeURIComponent(item.id)}`
                          )
                      : undefined
                  }
                />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pre-register an item to sell</Text>
        <Text style={styles.registerItemHint}>
          Choose the item type from the event&apos;s list and fill out the form. That pre-registers your item; it is fully in the sale only after staff check it in.
        </Text>
        <TouchableOpacity
          style={[styles.registerItemButton, !selectedEvent && styles.registerItemButtonDisabled]}
          onPress={() => {
            if (selectedEvent) router.push(`/event/${selectedEvent.id}/add-item`);
          }}
          disabled={!selectedEvent}
          activeOpacity={0.8}
        >
          <Text style={styles.registerItemPlus}>+</Text>
          <Text style={styles.registerItemLabel}>Pre-register new item</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ItemSummaryRow({
  item,
  organization,
  formatDate,
  onDeletePending,
  onEditPending,
}: {
  item: Item;
  organization?: Organization | null;
  formatDate: (d: Date) => string;
  /** Shown only for `pending` items — remove before hand-in */
  onDeletePending?: () => void;
  /** Shown only for `pending` items — edit before hand-in */
  onEditPending?: () => void;
}) {
  const desc =
    item.description?.trim() ||
    (typeof item.customFields?.description === 'string' ? item.customFields.description : '') ||
    '—';
  const commissionRate = organization?.commissionRate ?? null;
  const basisPrice =
    item.status === 'sold' && item.soldPrice != null && !Number.isNaN(Number(item.soldPrice))
      ? Number(item.soldPrice)
      : typeof item.originalPrice === 'number' && !Number.isNaN(item.originalPrice)
        ? item.originalPrice
        : null;
  const priceLabel = item.status === 'sold' ? 'Sold for' : 'Your price';
  const shareLabel = item.status === 'sold' ? 'Your share (after commission)' : 'Est. your share';
  const share =
    basisPrice != null ? estimatedSellerProceeds(basisPrice, commissionRate) : null;
  const priceStr = basisPrice != null ? `$${basisPrice.toFixed(2)}` : '—';
  const shareStr = share != null ? `$${share.toFixed(2)}` : '—';
  const commissionPct =
    commissionRate != null && commissionRate > 0 ? Math.round(commissionRate * 1000) / 10 : null;

  const displayTitle = getSellerFacingItemTitle(item);
  const showTagSubtitle = displayTitle !== item.itemNumber;

  return (
    <View style={styles.itemRowCard}>
      <View style={styles.itemRowHeader}>
        <View style={styles.itemTitleBlock}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          {showTagSubtitle ? (
            <Text style={styles.itemTagId} numberOfLines={1}>
              Tag # {item.itemNumber}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, statusBadgeStyle(item.status)]}>
          <Text style={styles.statusPillText}>{formatSellerItemStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.itemDescription} numberOfLines={2}>
        {desc}
      </Text>
      <View style={styles.itemPriceBlock}>
        <Text style={styles.itemPriceLine}>
          <Text style={styles.itemPriceLabel}>{priceLabel}: </Text>
          <Text style={styles.itemPriceValue}>{priceStr}</Text>
        </Text>
        <Text style={styles.itemPriceLine}>
          <Text style={styles.itemPriceLabel}>{shareLabel}: </Text>
          <Text style={styles.itemShareValue}>{shareStr}</Text>
        </Text>
        {commissionPct != null && commissionPct > 0 ? (
          <Text style={styles.itemCommissionNote}>
            Org commission: {commissionPct}% (same rule as when an item sells)
          </Text>
        ) : commissionRate != null && commissionRate === 0 ? (
          <Text style={styles.itemCommissionNote}>
            No org commission on this event — estimate equals the full price.
          </Text>
        ) : (
          <Text style={styles.itemCommissionNote}>
            Commission rate not set for this event — estimate assumes no fee.
          </Text>
        )}
      </View>
      <StaffItemQrSection
        qrCode={item.qrCode}
        itemNumber={item.itemNumber}
        show={item.status === 'pending'}
      />
      <View style={styles.itemMetaRow}>
        {item.category?.trim() ? (
          <Text style={styles.itemMeta}>Category: {item.category}</Text>
        ) : null}
      </View>
      <View style={styles.itemFooterRow}>
        <Text style={styles.itemMetaMuted}>Added {formatDate(item.createdAt)}</Text>
        <View style={styles.itemFooterActions}>
          {onEditPending ? (
            <TouchableOpacity onPress={onEditPending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.itemEditLink}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {onDeletePending ? (
            <TouchableOpacity onPress={onDeletePending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.itemRemoveLink}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  headerRight: {
    alignItems: 'flex-end',
    maxWidth: '46%',
    minWidth: 0,
  },
  headerAccountName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    textAlign: 'right',
    marginBottom: 2,
  },
  headerAccountEmail: {
    fontSize: 11,
    color: '#888',
    textAlign: 'right',
    marginBottom: 8,
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.12)',
    alignSelf: 'flex-end',
  },
  signOutText: {
    fontSize: 14,
    color: '#DC3545',
    fontWeight: '600',
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
  allItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 4,
  },
  allItemsHeaderTextBlock: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  allItemsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  allItemsSubcaption: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  allItemsChevron: {
    fontSize: 16,
    color: '#666',
    paddingLeft: 8,
    paddingVertical: 4,
  },
  allItemsEventLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0057C2',
    marginBottom: 8,
  },
  allItemsEventLabelMuted: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
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
  eventInfoLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 2,
  },
  eventInfoValue: {
    fontSize: 16,
    color: '#1A1A1A',
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
  eventDropdownShell: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  eventDropdownShellDisabled: {
    opacity: 0.75,
  },
  eventCarouselHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  eventCarouselLabel: {
    fontSize: 13,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCarouselEmpty: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  eventCarouselEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  eventCarouselContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  eventTileSpacing: {
    marginRight: 10,
  },
  eventTile: {
    width: 78,
    height: 78,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E6EA',
    backgroundColor: '#FAFBFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  eventTileSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E8F4FF',
  },
  eventTileMonth: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  eventTileDay: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    lineHeight: 30,
    marginTop: 2,
  },
  eventTileYear: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
    marginTop: 2,
  },
  eventSelectedDetails: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    backgroundColor: '#FAFBFC',
  },
  eventDetailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0057C2',
    lineHeight: 28,
    marginBottom: 4,
  },
  registerItemHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  registerItemButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
  },
  registerItemButtonDisabled: {
    backgroundColor: '#B0BEC5',
    opacity: 0.9,
  },
  registerItemPlus: {
    fontSize: 40,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 44,
  },
  registerItemLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  itemsLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  itemsEmptyText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  itemsListContainer: {
    gap: 12,
  },
  itemRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E6EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  itemRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  itemTagId: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  itemPriceBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  itemPriceLine: {
    fontSize: 14,
    marginBottom: 2,
  },
  itemPriceLabel: {
    color: '#555',
    fontWeight: '500',
  },
  itemPriceValue: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  itemShareValue: {
    color: '#1B5E20',
    fontWeight: '700',
  },
  itemCommissionNote: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  itemDescription: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
    lineHeight: 20,
  },
  itemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: '#555',
  },
  itemMetaMuted: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  itemEditLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  itemRemoveLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC3545',
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
