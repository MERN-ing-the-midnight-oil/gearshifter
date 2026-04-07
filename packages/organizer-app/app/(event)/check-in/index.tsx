import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  useEvent,
  getSellerByQRCode,
  getSellerById,
  getSellerItemsByEvent,
  getItem,
  parseSellerQRCode,
  parseItemQRCode,
  formatSellerItemStatusLabel,
  type Seller,
  type Item,
} from 'shared';

function organizerCheckInListStatusLabel(status: Item['status']): string {
  if (status === 'checked_in') return 'Registered';
  return formatSellerItemStatusLabel(status);
}

type CheckInMode = 'scan' | 'search' | 'register' | 'items';

function firstQueryParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function CheckInScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; sellerId?: string | string[] }>();
  const eventId = firstQueryParam(params.id);
  const sellerId = firstQueryParam(params.sellerId);
  const { event, loading: eventLoading } = useEvent(eventId);
  const router = useRouter();

  const [mode, setMode] = useState<CheckInMode>('scan');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Seller[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerItems, setSellerItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');

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

  const handleRegisterNewSeller = () => {
    router.push(`/(event)/check-in/register-seller?eventId=${eventId}`);
  };

  const handleBackToScan = () => {
    setSelectedSeller(null);
    setSellerItems([]);
    setMode('scan');
    setQrCodeInput('');
    setSearchQuery('');
    setSearchResults([]);
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Items view - show seller's items
  if (mode === 'items' && selectedSeller) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToScan} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Seller Items</Text>
          <Text style={styles.subtitle}>
            {selectedSeller.firstName} {selectedSeller.lastName}
          </Text>
          <Text style={styles.subtitle}>{selectedSeller.email}</Text>
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

  // Main check-in view - scan/search/register
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check-In Station</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'scan' && styles.modeButtonActive]}
          onPress={() => setMode('scan')}
        >
          <Text style={[styles.modeButtonText, mode === 'scan' && styles.modeButtonTextActive]}>
            Scan QR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'search' && styles.modeButtonActive]}
          onPress={() => setMode('search')}
        >
          <Text style={[styles.modeButtonText, mode === 'search' && styles.modeButtonTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
          onPress={() => setMode('register')}
        >
          <Text style={[styles.modeButtonText, mode === 'register' && styles.modeButtonTextActive]}>
            Register
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'scan' && (
        <View style={styles.scanContainer}>
          <Text style={styles.sectionTitle}>Scan QR Code</Text>
          <Text style={styles.helpText}>
            Scan a seller QR to look up their account, or a pre-registered item QR to open that item
            for check-in. You can also paste either code below.
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
            <Text style={styles.scanButtonText}>Lookup Pre-registered item</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerNewSellerButton}
            onPress={handleRegisterNewSeller}
          >
            <Text style={styles.registerNewSellerButtonText}>Register New Seller</Text>
          </TouchableOpacity>

          <Text style={styles.noteText}>
            Note: QR code scanning with camera will be added in a future update
          </Text>
        </View>
      )}

      {mode === 'search' && (
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>Search for Seller</Text>
          <Text style={styles.helpText}>
            Search by name, phone number, or email
          </Text>
          
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
              <Text style={styles.resultsTitle}>Search Results</Text>
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
      )}

      {mode === 'register' && (
        <View style={styles.registerContainer}>
          <Text style={styles.sectionTitle}>Register New Seller</Text>
          <Text style={styles.helpText}>
            Help a seller create an account and register for this event
          </Text>
          
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegisterNewSeller}
          >
            <Text style={styles.registerButtonText}>Start Registration</Text>
          </TouchableOpacity>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  scanContainer: {
    padding: 20,
  },
  searchContainer: {
    padding: 20,
  },
  registerContainer: {
    padding: 20,
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
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  registerNewSellerButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  registerNewSellerButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
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
    flexDirection: 'row',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 12,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
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
  registerButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  itemsList: {
    padding: 20,
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
    padding: 40,
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
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
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
  },
});
