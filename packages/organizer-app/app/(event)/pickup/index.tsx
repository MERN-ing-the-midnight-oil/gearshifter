import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { BadgeCheck, Gift, HandCoins, ScanLine, Search, Wallet } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  useAuth,
  useAdminUser,
  useEvent,
  getSellerByQRCode,
  getSellerById,
  searchSellers,
  getSellerItemsByEvent,
  parseSellerQRCode,
  getSellerPaymentStatus,
  getFinalPayout,
  markItemAsPaid,
  markSellerItemsAsPaid,
  updateItemStatus,
  getEligibleDonationCount,
  processDonations,
  promoteEventItemToOrganizationInventory,
  STAFF_FLOW_CONTENT_MAX_WIDTH,
  STAFF_MOBILE_EDGE_PADDING,
  STAFF_MOBILE_HEADER_PADDING_TOP,
  STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  ITEM_STATUS_PICKUP_STATION_COMPLETE,
  STATION_THEME,
  type Seller,
  type Item,
} from 'shared';
import { theme } from '../../../lib/theme';

type PickupMode = 'scan' | 'search' | 'seller';

const DONATE_CERTIFICATION_MESSAGE =
  'You are certifying that the seller has donated the item.';

export default function PickupScreen() {
  const stationTheme = STATION_THEME.pickup;
  const router = useRouter();
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const { event, loading: eventLoading } = useEvent(eventId);

  const [mode, setMode] = useState<PickupMode>('scan');
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Seller[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerItems, setSellerItems] = useState<Item[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<{
    totalItemsSold: number;
    paidItemsCount: number;
    unpaidItemsCount: number;
    totalSoldAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    isFullyPaid: boolean;
  } | null>(null);
  const [payoutSummary, setPayoutSummary] = useState<{
    totalPayout: number;
    itemsSold: number;
  } | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [eligibleDonationCount, setEligibleDonationCount] = useState<number | null>(null);
  const [loadingEligibleCount, setLoadingEligibleCount] = useState(false);
  const [bulkDonateLoading, setBulkDonateLoading] = useState(false);
  const [payoutCheckNumber, setPayoutCheckNumber] = useState('');

  // Pickup is admin-only — redirect non-admins
  useEffect(() => {
    if (adminUserLoading || !adminUser) return;
    if (adminUser.role !== 'admin') {
      router.replace(`/(event)/manage?id=${eventId}`);
    }
  }, [adminUser, adminUserLoading, router, eventId]);

  const loadSellerData = useCallback(async () => {
    if (!selectedSeller || !eventId) return;
    setLoadingItems(true);
    try {
      const [items, status, payout] = await Promise.all([
        getSellerItemsByEvent(selectedSeller.id, eventId),
        getSellerPaymentStatus(selectedSeller.id, { eventId }),
        getFinalPayout(selectedSeller.id, eventId),
      ]);
      setSellerItems(items);
      setPaymentStatus(status);
      setPayoutSummary(payout);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load seller data');
    } finally {
      setLoadingItems(false);
    }
  }, [selectedSeller, eventId]);

  useEffect(() => {
    if (selectedSeller && eventId) loadSellerData();
  }, [selectedSeller, eventId, loadSellerData]);

  const loadEligibleDonationCount = useCallback(async () => {
    if (!eventId) return;
    setLoadingEligibleCount(true);
    try {
      const count = await getEligibleDonationCount(eventId);
      setEligibleDonationCount(count);
    } catch {
      setEligibleDonationCount(0);
    } finally {
      setLoadingEligibleCount(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId && mode === 'scan') loadEligibleDonationCount();
  }, [eventId, mode, loadEligibleDonationCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSellerData();
    setRefreshing(false);
  }, [loadSellerData]);

  const handleQRCodeScan = async (qrData: string) => {
    const sid = parseSellerQRCode(qrData);
    if (!sid) {
      Alert.alert('Invalid QR Code', 'This QR code is not for a seller.');
      return;
    }
    try {
      const seller = await getSellerByQRCode(qrData);
      if (seller) {
        setSelectedSeller(seller);
        setMode('seller');
        setQrCodeInput('');
      } else {
        Alert.alert('Seller Not Found', 'No seller found with this QR code.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to lookup seller');
    }
  };

  const handleManualQRCode = () => {
    if (!qrCodeInput.trim()) {
      Alert.alert('Error', 'Please enter a QR code');
      return;
    }
    handleQRCodeScan(qrCodeInput.trim());
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search term');
      return;
    }
    setSearching(true);
    try {
      const results = await searchSellers(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert('No Results', 'No sellers found matching your search.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to search sellers');
    } finally {
      setSearching(false);
    }
  };

  const selectSeller = (seller: Seller) => {
    setSelectedSeller(seller);
    setMode('seller');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBackToScan = () => {
    setSelectedSeller(null);
    setSellerItems([]);
    setPaymentStatus(null);
    setPayoutSummary(null);
    setPayoutCheckNumber('');
    setMode('scan');
    setQrCodeInput('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleMarkItemPaid = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const trimmed = payoutCheckNumber.trim();
      await markItemAsPaid(itemId, { checkNumber: trimmed || null });
      await loadSellerData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllPaid = async () => {
    if (!selectedSeller || !eventId || !paymentStatus || paymentStatus.unpaidItemsCount === 0) return;
    Alert.alert(
      'Mark all as paid',
      `Mark all ${paymentStatus.unpaidItemsCount} unpaid item(s) as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark all paid',
          onPress: async () => {
            setActionLoading('all');
            try {
              const trimmed = payoutCheckNumber.trim();
              await markSellerItemsAsPaid(selectedSeller.id, {
                eventId,
                checkNumber: trimmed || null,
              });
              await loadSellerData();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark as paid');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkPickedUp = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      await updateItemStatus(itemId, 'picked_up');
      await loadSellerData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkDonated = (item: Item) => {
    Alert.alert(
      'Mark as donated',
      DONATE_CERTIFICATION_MESSAGE,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(item.id);
            try {
              await updateItemStatus(item.id, 'donated');
              // TODO: Send in-app notification to seller that item was marked donated
              await loadSellerData();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleAddToOrgInventory = async (item: Item) => {
    setActionLoading(item.id);
    try {
      await promoteEventItemToOrganizationInventory(item.id);
      Alert.alert('Added', 'Item added to organization post-event inventory.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkMarkEligibleDonated = () => {
    if (!eventId || eligibleDonationCount === null || eligibleDonationCount === 0) return;
    Alert.alert(
      'Mark all eligible as donated',
      `Mark ${eligibleDonationCount} item(s) with "donate if not sold" as donated? ${DONATE_CERTIFICATION_MESSAGE}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBulkDonateLoading(true);
            try {
              await processDonations(eventId);
              await loadEligibleDonationCount();
              Alert.alert('Done', 'Eligible items have been marked as donated.');
              // TODO: Notify affected sellers in-app
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
            } finally {
              setBulkDonateLoading(false);
            }
          },
        },
      ]
    );
  };

  if (adminUserLoading || !isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
        <Text style={styles.loadingText}>
          {adminUserLoading ? 'Loading...' : 'Redirecting...'}
        </Text>
      </View>
    );
  }

  if (eventLoading || !event) {
    return (
      <View style={[styles.container, styles.centered]}>
        {eventLoading ? (
          <ActivityIndicator size="large" color={theme.activityIndicator} />
        ) : (
          <Text style={styles.errorText}>Event not found</Text>
        )}
        <TouchableOpacity style={styles.errorScreenButton} onPress={() => router.back()}>
          <Text style={styles.errorScreenButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Seller detail view
  if (mode === 'seller' && selectedSeller) {
    const soldItems = sellerItems.filter((i) => i.status === 'sold');
    const unsoldItems = sellerItems.filter((i) => !ITEM_STATUS_PICKUP_STATION_COMPLETE.has(i.status));
    const dispositionItems = sellerItems.filter((i) =>
      ['donated', 'donated_abandoned', 'unclaimed'].includes(i.status)
    );

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: stationTheme.backgroundTint }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.header, { backgroundColor: stationTheme.headerTint, borderBottomColor: stationTheme.headerAccent }]}>
          <TouchableOpacity onPress={handleBackToScan} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Next seller</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pickup</Text>
          <Text style={styles.subtitle}>
            {selectedSeller.firstName} {selectedSeller.lastName}
          </Text>
          {(selectedSeller.email || selectedSeller.phone) && (
            <Text style={styles.subtitleSmall}>
              {[selectedSeller.email, selectedSeller.phone].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {loadingItems ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.activityIndicator} />
          </View>
        ) : (
          <>
            {/* Payout / Sold section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payout & sold items</Text>
              {payoutSummary && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total to pay</Text>
                  <Text style={styles.summaryValue}>
                    ${payoutSummary.totalPayout.toFixed(2)}
                  </Text>
                </View>
              )}
              {paymentStatus && paymentStatus.unpaidItemsCount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Unpaid</Text>
                  <Text style={styles.summaryValue}>
                    ${paymentStatus.unpaidAmount.toFixed(2)} ({paymentStatus.unpaidItemsCount} items)
                  </Text>
                </View>
              )}
              {paymentStatus?.isFullyPaid && soldItems.length > 0 && (
                <Text style={styles.fullyPaidText}>Fully paid</Text>
              )}
              {soldItems.length > 0 && (
                <>
                  {paymentStatus && paymentStatus.unpaidItemsCount > 0 && (
                    <>
                      <Text style={styles.checkHelp}>
                        Check number (optional): record when you pay the consignee so you can reconcile payouts.
                        Applies to the next Mark paid or Mark all as paid.
                      </Text>
                      <TextInput
                        style={styles.checkInput}
                        placeholder="Check #"
                        value={payoutCheckNumber}
                        onChangeText={setPayoutCheckNumber}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  )}
                  {paymentStatus && paymentStatus.unpaidItemsCount > 0 && (
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: stationTheme.actionAccent }]}
                      onPress={handleMarkAllPaid}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === 'all' ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <View style={styles.iconButtonContent}>
                          <Wallet size={16} color="#FFFFFF" />
                          <Text style={styles.primaryButtonText}>Mark all as paid</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  {soldItems.map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemNumber}>{item.itemNumber}</Text>
                        <Text style={styles.itemPrice}>
                          ${(item.soldPrice ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      {(item.description || item.category) && (
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {[item.category, item.description].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                      <View style={styles.itemRow}>
                        <Text style={item.paidAt ? styles.paidBadge : styles.unpaidBadge}>
                          {item.paidAt ? 'Paid ✓' : 'Unpaid'}
                        </Text>
                        {!item.paidAt && (
                          <TouchableOpacity
                            style={styles.smallButton}
                            onPress={() => handleMarkItemPaid(item.id)}
                            disabled={!!actionLoading}
                          >
                            {actionLoading === item.id ? (
                              <ActivityIndicator color={theme.primary} size="small" />
                            ) : (
                              <View style={styles.iconButtonContent}>
                                <HandCoins size={15} color={theme.primary} />
                                <Text style={styles.smallButtonText}>Mark paid</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              )}
              {soldItems.length === 0 && (
                <Text style={styles.emptySection}>No sold items</Text>
              )}
            </View>

            {/* Unsold items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Unsold items</Text>
              {unsoldItems.length === 0 ? (
                <Text style={styles.emptySection}>No unsold items</Text>
              ) : (
                unsoldItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemNumber}>{item.itemNumber}</Text>
                      {item.donateIfUnsold && (
                        <Text style={styles.donateTag}>Donate if unsold</Text>
                      )}
                    </View>
                    {(item.description || item.category) && (
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {[item.category, item.description].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => handleMarkPickedUp(item.id)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === item.id ? (
                          <ActivityIndicator color={theme.primary} size="small" />
                        ) : (
                          <View style={styles.iconButtonContent}>
                            <BadgeCheck size={15} color={theme.primary} />
                            <Text style={styles.smallButtonText}>Picked up</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallButton, styles.donateButton]}
                        onPress={() => handleMarkDonated(item)}
                        disabled={!!actionLoading}
                      >
                        <View style={styles.iconButtonContent}>
                          <Gift size={15} color={theme.primary} />
                          <Text style={styles.smallButtonText}>Donate</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Donated / unclaimed — add to org post-event inventory */}
            {dispositionItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Donated or unclaimed</Text>
                <Text style={styles.checkHelp}>
                  Add to organization post-event inventory so you can track storage, resale, or donations after the
                  swap.
                </Text>
                {dispositionItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemNumber}>{item.itemNumber}</Text>
                      <Text style={styles.statusTag}>{item.status}</Text>
                    </View>
                    {(item.description || item.category) && (
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {[item.category, item.description].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => handleAddToOrgInventory(item)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === item.id ? (
                        <ActivityIndicator color={theme.primary} size="small" />
                      ) : (
                        <Text style={styles.secondaryButtonText}>Add to org inventory</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  // Scan / Search entry
  return (
    <ScrollView style={[styles.container, { backgroundColor: stationTheme.backgroundTint }]}>
      <View style={[styles.header, { backgroundColor: stationTheme.headerTint, borderBottomColor: stationTheme.headerAccent }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pickup Station</Text>
        <Text style={styles.subtitle}>Scan seller QR or find by ID</Text>
      </View>

      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'scan' && styles.modeButtonActive]}
          onPress={() => setMode('scan')}
        >
          <View style={styles.iconButtonContent}>
            <ScanLine size={14} color={mode === 'scan' ? theme.buttonText : theme.textSecondary} />
            <Text style={[styles.modeButtonText, mode === 'scan' && styles.modeButtonTextActive]}>
              Scan QR
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'search' && styles.modeButtonActive]}
          onPress={() => setMode('search')}
        >
          <View style={styles.iconButtonContent}>
            <Search size={14} color={mode === 'search' ? theme.buttonText : theme.textSecondary} />
            <Text style={[styles.modeButtonText, mode === 'search' && styles.modeButtonTextActive]}>
              Seller has presented their ID
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {mode === 'scan' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scan Seller QR Code</Text>
          <Text style={styles.helpText}>
            Ask the seller to show their QR code, or enter it manually below.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter QR code manually"
            value={qrCodeInput}
            onChangeText={setQrCodeInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleManualQRCode}
            disabled={!qrCodeInput.trim()}
          >
            <Text style={styles.primaryButtonText}>Lookup seller</Text>
          </TouchableOpacity>

          {/* Admin: Mark all eligible unsold as donated */}
          {isAdmin && (
            <View style={styles.adminSection}>
              <Text style={styles.sectionTitle}>Admin</Text>
              <Text style={styles.helpText}>
                Mark all unsold items with "donate if not sold" as donated (e.g. after event).
              </Text>
              {loadingEligibleCount ? (
                <ActivityIndicator size="small" color={theme.activityIndicator} />
              ) : (
                <>
                  <Text style={styles.helpText}>
                    {eligibleDonationCount !== null &&
                      `${eligibleDonationCount} eligible item(s).`}
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryButton, (eligibleDonationCount === 0 || eligibleDonationCount === null) && styles.buttonDisabled]}
                    onPress={handleBulkMarkEligibleDonated}
                    disabled={bulkDonateLoading || eligibleDonationCount === 0 || eligibleDonationCount === null}
                  >
                    {bulkDonateLoading ? (
                      <ActivityIndicator color={theme.primary} size="small" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>
                        Mark all eligible unsold as donated
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {mode === 'search' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search by name or contact</Text>
          <Text style={styles.helpText}>
            Search by name, phone, or email to find the seller.
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput]}
              placeholder="Name, phone, or email"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Results</Text>
              {searchResults.map((seller) => (
                <TouchableOpacity
                  key={seller.id}
                  style={styles.resultCard}
                  onPress={() => selectSeller(seller)}
                >
                  <Text style={styles.resultName}>
                    {seller.firstName} {seller.lastName}
                  </Text>
                  {seller.email && (
                    <Text style={styles.resultEmail}>{seller.email}</Text>
                  )}
                  {seller.phone && (
                    <Text style={styles.resultPhone}>{seller.phone}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: STAFF_MOBILE_EDGE_PADDING,
  },
  header: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_HEADER_PADDING_TOP,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING,
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
  subtitleSmall: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  loadingText: {
    marginTop: 10,
    color: theme.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: theme.error,
    marginBottom: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingVertical: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  modeButtonActive: {
    backgroundColor: theme.primary,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: theme.buttonText,
  },
  iconButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  section: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_EDGE_PADDING,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 8,
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
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
    color: theme.text,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  searchRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    width: '100%',
    marginBottom: 0,
  },
  searchButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: STAFF_FLOW_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 12,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  primaryButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: STAFF_FLOW_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  adminSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  fullyPaidText: {
    fontSize: 16,
    color: theme.status?.shopping ?? '#50C878',
    fontWeight: '600',
    marginBottom: 12,
  },
  checkHelp: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  checkInput: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
    color: theme.text,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  statusTag: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'capitalize',
  },
  itemCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  itemDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  paidBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.status?.shopping ?? '#50C878',
  },
  unpaidBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
  },
  donateTag: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  itemActions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primary,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  donateButton: {
    borderColor: theme.textSecondary,
  },
  emptySection: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  resultsContainer: {
    marginTop: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  resultName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  resultEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  resultPhone: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  errorScreenButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  errorScreenButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});
