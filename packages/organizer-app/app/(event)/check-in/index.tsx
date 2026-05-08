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
} from 'react-native';
import { BadgeCheck, PackagePlus, ScanLine, UserPlus } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  useEvent,
  getSellerByQRCode,
  getSellerById,
  getSellerItemsByEvent,
  searchSellers,
  lookupSellersByPhoneForCheckIn,
  sendSellerCheckInSignupSms,
  getItem,
  parseSellerQRCode,
  parseItemQRCode,
  formatSellerItemStatusLabel,
  STAFF_MOBILE_EDGE_PADDING,
  STAFF_MOBILE_HEADER_PADDING_TOP,
  STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  STATION_THEME,
  type Seller,
  type Item,
} from 'shared';
import { theme, cardShadow } from '../../../lib/theme';
import { printItemTags } from '../../../hardware/tagPrinter';

function organizerCheckInListStatusLabel(status: Item['status']): string {
  if (status === 'checked_in') return 'Registered';
  return formatSellerItemStatusLabel(status);
}

type CheckInMode = 'home' | 'lookup' | 'items';

function firstQueryParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function CheckInScreen() {
  const stationTheme = STATION_THEME.checkIn;
  const params = useLocalSearchParams<{ id: string | string[]; sellerId?: string | string[] }>();
  const eventId = firstQueryParam(params.id);
  const sellerId = firstQueryParam(params.sellerId);
  const { event, loading: eventLoading } = useEvent(eventId ?? null);
  const router = useRouter();

  const [mode, setMode] = useState<CheckInMode>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Seller[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerItems, setSellerItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [printingAllTags, setPrintingAllTags] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [phoneLookupInput, setPhoneLookupInput] = useState('');
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneLookupResults, setPhoneLookupResults] = useState<Seller[] | null>(null);
  const [sendingSellerSms, setSendingSellerSms] = useState(false);

  // Load items when seller is selected
  useEffect(() => {
    if (selectedSeller && event) {
      loadSellerItems();
    }
  }, [selectedSeller, event]);

  // If sellerId is passed, load that seller
  useEffect(() => {
    if (sellerId && event && !selectedSeller) {
      loadSellerById(sellerId);
    }
  }, [sellerId, event]);

  const loadSellerById = async (id: string) => {
    try {
      const seller = await getSellerById(id);
      if (seller) {
        setSelectedSeller(seller);
        setMode('items');
      }
    } catch (error) {
      console.error('Failed to load seller:', error);
    }
  };

  const handleQRCodeScan = async (qrData: string) => {
    const trimmed = qrData.trim();

    const itemParsed = parseItemQRCode(trimmed);
    if (itemParsed?.itemId) {
      try {
        const item = await getItem(itemParsed.itemId);
        if (!item) {
          Alert.alert('Item Not Found', 'No item matches this QR code.');
          return;
        }
        if (item.eventId !== eventId) {
          Alert.alert('Wrong QR Code', 'This item is for a different event.');
          return;
        }
        const qs = new URLSearchParams({
          itemId: item.id,
          eventId: item.eventId,
          sellerId: item.sellerId,
        });
        router.push(`/(event)/check-in/item-details?${qs.toString()}`);
        setQrCodeInput('');
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to open item');
      }
      return;
    }

    const sellerIdFromQr = parseSellerQRCode(trimmed);
    if (!sellerIdFromQr) {
      Alert.alert('Invalid QR Code', 'Scan a seller QR or a pre-registered item QR.');
      return;
    }

    try {
      const seller = await getSellerByQRCode(trimmed);
      if (seller) {
        setSelectedSeller(seller);
        setMode('items');
      } else {
        Alert.alert('Seller Not Found', 'No seller found with this QR code.');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to lookup seller');
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
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to search sellers');
    } finally {
      setSearching(false);
    }
  };

  const selectSeller = (seller: Seller) => {
    setSelectedSeller(seller);
    setMode('items');
    setSearchQuery('');
    setSearchResults([]);
    setPhoneLookupInput('');
    setPhoneLookupResults(null);
  };

  const loadSellerItems = async () => {
    if (!selectedSeller || !event) return;

    setLoadingItems(true);
    try {
      const items = await getSellerItemsByEvent(selectedSeller.id, event.id);
      setSellerItems(items);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handlePrintAllTags = async () => {
    if (!event || sellerItems.length === 0) return;
    setPrintingAllTags(true);
    try {
      const { success, failed } = await printItemTags(sellerItems, undefined, event);
      if (success === 0 && failed > 0) {
        const msg =
          Platform.OS === 'web'
            ? 'Printing needs a Bluetooth printer from the Stations flow on a supported device.'
            : 'Could not print tags. Connect a thermal printer and try again.';
        Alert.alert('Print all tags', msg);
        return;
      }
      if (failed > 0) {
        Alert.alert(
          'Print all tags',
          `Printed ${success} tag(s). ${failed} could not be printed — open an item to retry or check the printer.`
        );
        return;
      }
      Alert.alert('Print all tags', `Sent ${success} tag(s) to the printer.`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Batch print failed');
    } finally {
      setPrintingAllTags(false);
    }
  };

  const handleRegisterNewSeller = () => {
    router.push(`/(event)/check-in/register-seller?eventId=${eventId}`);
  };

  const handleRegisterGear = () => {
    router.push(`/(event)/check-in/register-guest?eventId=${eventId}`);
  };

  const handleBackToHome = () => {
    setSelectedSeller(null);
    setSellerItems([]);
    setMode('home');
    setQrCodeInput('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBackFromLookup = () => {
    setQrCodeInput('');
    setSearchQuery('');
    setSearchResults([]);
    setPhoneLookupInput('');
    setPhoneLookupResults(null);
    setMode('home');
  };

  const handlePhoneLookup = async () => {
    if (!phoneLookupInput.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    const digits = phoneLookupInput.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Error', 'Enter at least 10 digits (include area code).');
      return;
    }
    if (!eventId) return;
    setPhoneLookupLoading(true);
    try {
      const results = await lookupSellersByPhoneForCheckIn(phoneLookupInput);
      setPhoneLookupResults(results);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Phone lookup failed');
      setPhoneLookupResults(null);
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  const handleSendSellerSignupSms = () => {
    if (!eventId) return;
    const trimmed = phoneLookupInput.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Enter a phone number first');
      return;
    }
    Alert.alert(
      'Text sign-in to seller',
      'This sends a text message with a sign-in code to the seller app (same as when they tap sign in with phone). After they verify the code and complete their profile, they can show you their account QR code here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send text',
          onPress: async () => {
            setSendingSellerSms(true);
            try {
              const { simulatedSms } = await sendSellerCheckInSignupSms({ phone: trimmed, eventId });
              const devBody =
                'No SMS was sent (dev mode). Ask the seller to open the seller app, enter this number, then tap SKIP VERIFICATION on the login or code screen.';
              const prodBody =
                'Ask the seller to open the seller app, enter this phone number, tap the sign-in text, enter the code, finish profile setup, then return here so you can scan their QR code.';
              Alert.alert(simulatedSms ? 'Dev: sign-in prepared' : 'Text sent', simulatedSms ? devBody : prodBody);
            } catch (err) {
              Alert.alert('Could not send', err instanceof Error ? err.message : 'SMS failed');
            } finally {
              setSendingSellerSms(false);
            }
          },
        },
      ]
    );
  };

  if (eventLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.errorOutlineButton} onPress={() => router.back()}>
          <Text style={styles.errorOutlineButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Items view - show seller's items
  if (mode === 'items' && selectedSeller) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: stationTheme.backgroundTint }]}>
        <View style={[styles.header, { backgroundColor: stationTheme.headerTint, borderBottomColor: stationTheme.headerAccent }]}>
          <TouchableOpacity onPress={handleBackToHome} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Seller Items</Text>
          <Text style={styles.subtitle}>
            {selectedSeller.firstName} {selectedSeller.lastName}
          </Text>
          <Text style={styles.subtitle}>{selectedSeller.email}</Text>
          {sellerItems.length > 0 ? (
            <TouchableOpacity
              style={[styles.printAllButton, printingAllTags && styles.printAllButtonDisabled]}
              onPress={handlePrintAllTags}
              disabled={printingAllTags || loadingItems}
              activeOpacity={0.85}
            >
              {printingAllTags ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.printAllButtonText}>Print all tags</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {loadingItems ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : sellerItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items registered for this event</Text>
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => router.push(`/(event)/check-in/add-item?sellerId=${selectedSeller.id}&eventId=${eventId}`)}
            >
              <Text style={styles.addItemButtonText}>Register Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {sellerItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => router.push(`/(event)/check-in/item-details?itemId=${item.id}&sellerId=${selectedSeller.id}&eventId=${eventId}`)}
              >
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemNumber}>{item.itemNumber}</Text>
                  <View style={[styles.statusBadge, styles[`status${item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', '')}`]]}>
                    <Text style={styles.statusText}>{organizerCheckInListStatusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.itemDescription}>
                  {item.description || item.customFields?.description || 'No description'}
                </Text>
                <Text style={styles.itemPrice}>${item.originalPrice.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => router.push(`/(event)/check-in/add-item?sellerId=${selectedSeller.id}&eventId=${eventId}`)}
            >
              <Text style={styles.addItemButtonText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  // Main check-in view — home choices or lookup (QR + search)
  return (
    <ScrollView style={[styles.container, { backgroundColor: stationTheme.backgroundTint }]}>
      <View style={[styles.header, { backgroundColor: stationTheme.headerTint, borderBottomColor: stationTheme.headerAccent }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check-In Station</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      {mode === 'home' && (
        <View style={styles.homeOptions}>
          <TouchableOpacity
            style={[styles.homeOptionButton, { backgroundColor: stationTheme.actionAccent }]}
            onPress={handleRegisterNewSeller}
            activeOpacity={0.88}
          >
            <View style={styles.homeOptionContent}>
              <UserPlus size={20} color={theme.buttonText} />
              <Text style={styles.homeOptionTitle}>Register a Seller</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.homeOptionButton, { backgroundColor: stationTheme.actionAccent }]}
            onPress={() => setMode('lookup')}
            activeOpacity={0.88}
          >
            <View style={styles.homeOptionContent}>
              <ScanLine size={20} color={theme.buttonText} />
              <Text style={styles.homeOptionTitle}>Look up an existing seller</Text>
            </View>
            <Text style={styles.homeOptionSubtitle}>By phone, name, email, or seller QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.homeOptionButton, { backgroundColor: stationTheme.actionAccent }]}
            onPress={() => setMode('lookup')}
            activeOpacity={0.88}
          >
            <View style={styles.homeOptionContent}>
              <BadgeCheck size={20} color={theme.buttonText} />
              <Text style={styles.homeOptionTitle}>Check in a pre-registered seller or gear</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.homeOptionButton, { backgroundColor: stationTheme.actionAccent }]}
            onPress={handleRegisterGear}
            activeOpacity={0.88}
          >
            <View style={styles.homeOptionContent}>
              <PackagePlus size={20} color={theme.buttonText} />
              <Text style={styles.homeOptionTitle}>Register gear</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'lookup' && (
        <View style={styles.lookupRoot}>
          <View style={[styles.lookupHeaderBar, { backgroundColor: stationTheme.headerTint, borderBottomColor: stationTheme.headerAccent }]}>
            <TouchableOpacity onPress={handleBackFromLookup} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.lookupScreenTitle}>Check-in</Text>
            <Text style={styles.lookupScreenSubtitle}>
              Find a seller by phone, name search, or seller QR — or paste an item QR or check-in link
            </Text>
          </View>

          <View style={styles.scanContainer}>
            <Text style={styles.sectionTitle}>Seller or item code</Text>
            <Text style={styles.helpText}>
              Paste a seller QR, item QR, or check-in link. Camera scanning can be added later.
            </Text>

            <TextInput
              style={styles.qrInput}
              placeholder="Seller QR, item QR, or deep link"
              value={qrCodeInput}
              onChangeText={setQrCodeInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleManualQRCode}
              disabled={!qrCodeInput.trim()}
            >
              <Text style={styles.scanButtonText}>Look up code</Text>
            </TouchableOpacity>

            <Text style={styles.noteText}>
              Note: QR code scanning with camera will be added in a future update
            </Text>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.sectionTitle}>Look up by phone</Text>
            <Text style={styles.helpText}>
              Find an existing seller by number, or text a new seller so they can create an account in the seller app and
              bring back their QR code.
            </Text>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Phone number"
                value={phoneLookupInput}
                onChangeText={(t) => {
                  setPhoneLookupInput(t);
                  setPhoneLookupResults(null);
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handlePhoneLookup}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handlePhoneLookup}
                disabled={phoneLookupLoading || !phoneLookupInput.trim()}
              >
                {phoneLookupLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Look up phone</Text>
                )}
              </TouchableOpacity>
            </View>

            {phoneLookupResults !== null && phoneLookupResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Matching sellers</Text>
                {phoneLookupResults.map((seller) => (
                  <TouchableOpacity
                    key={seller.id}
                    style={styles.resultCard}
                    onPress={() => selectSeller(seller)}
                  >
                    <Text style={styles.resultName}>
                      {seller.firstName} {seller.lastName}
                    </Text>
                    <Text style={styles.resultEmail}>{seller.email}</Text>
                    <Text style={styles.resultPhone}>{seller.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {phoneLookupResults !== null && phoneLookupResults.length === 0 && (
              <View style={styles.phoneNoMatchBox}>
                <Text style={styles.phoneNoMatchText}>No seller profile uses this phone number yet.</Text>
                <TouchableOpacity
                  style={[styles.inviteSmsButton, sendingSellerSms && styles.inviteSmsButtonDisabled]}
                  onPress={handleSendSellerSignupSms}
                  disabled={sendingSellerSms}
                  activeOpacity={0.88}
                >
                  {sendingSellerSms ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.inviteSmsButtonText}>Text sign-in to this number</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.sectionTitle}>Search for seller</Text>
            <Text style={styles.helpText}>Search by name, phone number, or email</Text>

            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Enter name, phone, or email"
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Search results</Text>
                {searchResults.map((seller) => (
                  <TouchableOpacity
                    key={seller.id}
                    style={styles.resultCard}
                    onPress={() => selectSeller(seller)}
                  >
                    <Text style={styles.resultName}>
                      {seller.firstName} {seller.lastName}
                    </Text>
                    <Text style={styles.resultEmail}>{seller.email}</Text>
                    <Text style={styles.resultPhone}>{seller.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
    padding: STAFF_MOBILE_EDGE_PADDING,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_HEADER_PADDING_TOP,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  homeOptions: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_EDGE_PADDING,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 8,
    gap: 10,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  homeOptionButton: {
    backgroundColor: theme.button,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  homeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.buttonText,
    textAlign: 'center',
    lineHeight: 22,
  },
  homeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  homeOptionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 18,
  },
  lookupRoot: {
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 16,
  },
  lookupHeaderBar: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: 4,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  lookupScreenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  lookupScreenSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  scanContainer: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_EDGE_PADDING,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 8,
  },
  searchContainer: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_EDGE_PADDING,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  qrInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 16,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  searchInputContainer: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  searchInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  resultName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  resultEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  resultPhone: {
    fontSize: 14,
    color: '#666',
  },
  phoneNoMatchBox: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  phoneNoMatchText: {
    fontSize: 15,
    color: '#444',
    marginBottom: 14,
    lineHeight: 22,
  },
  inviteSmsButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  inviteSmsButtonDisabled: {
    opacity: 0.65,
  },
  inviteSmsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itemsList: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_EDGE_PADDING,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 24,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPending: {
    backgroundColor: '#FFF3CD',
  },
  statusCheckedin: {
    backgroundColor: '#D1ECF1',
  },
  statusForsale: {
    backgroundColor: '#D4EDDA',
  },
  statusSold: {
    backgroundColor: '#D4EDDA',
  },
  statusPickedup: {
    backgroundColor: '#E2E3E5',
  },
  statusDonated: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  emptyContainer: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  addItemButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  printAllButton: {
    marginTop: 16,
    backgroundColor: '#5856D6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  printAllButtonDisabled: {
    opacity: 0.65,
  },
  printAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorOutlineButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOutlineButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
