import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useEvent, getItem, parseItemQRCode, getCurrentPrice, recordSale, getCurrentUser, type Item } from 'shared';

export default function POSScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const { event, loading: eventLoading } = useEvent(eventId);
  const router = useRouter();

  const [qrCodeInput, setQrCodeInput] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleScanItem = async () => {
    if (!qrCodeInput.trim()) {
      Alert.alert('Error', 'Please enter or scan an item QR code');
      return;
    }

    setLoadingItem(true);
    try {
      const parsed = parseItemQRCode(qrCodeInput.trim());
      if (!parsed || !parsed.itemId) {
        Alert.alert('Invalid QR Code', 'This QR code is not for an item.');
        setLoadingItem(false);
        return;
      }

      const item = await getItem(parsed.itemId);
      if (!item) {
        Alert.alert('Item Not Found', 'No item found with this QR code.');
        setLoadingItem(false);
        return;
      }

      // Check if item is already sold
      if (item.status === 'sold') {
        Alert.alert('Item Already Sold', 'This item has already been sold.');
        setLoadingItem(false);
        return;
      }

      // Donation-closure intercepts: before any sale flow
      if (item.status === 'donated' || item.status === 'donated_abandoned') {
        Alert.alert('DONATED', 'This item has been processed for donation.');
        setLoadingItem(false);
        return;
      }
      if (event?.donationDeclaredAt && item.status === 'for_sale') {
        Alert.alert('NOT PICKED UP', 'This item was not marked for donation and has not been claimed.');
        setLoadingItem(false);
        return;
      }

      // Check if item is for sale
      if (item.status !== 'for_sale') {
        Alert.alert('Item Not Available', `This item is not available for sale (status: ${item.status}).`);
        setLoadingItem(false);
        return;
      }

      setSelectedItem(item);
      
      // Calculate and set current price
      const currentPrice = getCurrentPrice(item);
      setSalePrice(currentPrice.toFixed(2));
      
      // Clear QR code input
      setQrCodeInput('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load item');
    } finally {
      setLoadingItem(false);
    }
  };

  const handleRecordSale = async () => {
    if (!selectedItem) return;

    // Validate buyer name
    if (!buyerName.trim()) {
      Alert.alert('Error', 'Please enter the buyer\'s name');
      return;
    }

    // Validate sale price
    const price = parseFloat(salePrice);
    if (!price || price <= 0) {
      Alert.alert('Error', 'Please enter a valid sale price');
      return;
    }

    // Get current admin user
    let processedBy: string;
    try {
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Unable to identify the user processing the sale. Please log in again.');
        return;
      }
      processedBy = user.id;
    } catch (error) {
      Alert.alert('Error', 'Unable to identify the user processing the sale. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      await recordSale(selectedItem.id, {
        soldPrice: price,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim() || undefined,
        buyerPhone: buyerPhone.trim() || undefined,
        processedBy,
      });

      Alert.alert(
        'Sale Recorded',
        `Item ${selectedItem.itemNumber} has been marked as sold for $${price.toFixed(2)}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSelectedItem(null);
              setBuyerName('');
              setBuyerEmail('');
              setBuyerPhone('');
              setSalePrice('');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setSelectedItem(null);
    setBuyerName('');
    setBuyerEmail('');
    setBuyerPhone('');
    setSalePrice('');
    setQrCodeInput('');
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Point of Sale</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      <View style={styles.scanSection}>
        <Text style={styles.sectionTitle}>Scan Item</Text>
        <Text style={styles.helpText}>
          Scan or enter the item QR code to begin a sale
        </Text>
        
        <TextInput
          style={styles.qrInput}
          placeholder="Enter or scan item QR code"
          value={qrCodeInput}
          onChangeText={setQrCodeInput}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleScanItem}
        />
        
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScanItem}
          disabled={loadingItem || !qrCodeInput.trim()}
        >
          {loadingItem ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.scanButtonText}>Load Item</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.noteText}>
          Note: QR code scanning with camera will be added in a future update
        </Text>
      </View>

      {selectedItem && (
        <View style={styles.saleSection}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNumber}>{selectedItem.itemNumber}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{selectedItem.status}</Text>
              </View>
            </View>
            
            <Text style={styles.itemDescription}>
              {selectedItem.description || 'No description'}
            </Text>
            
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>Original Price</Text>
                <Text style={styles.originalPrice}>${selectedItem.originalPrice.toFixed(2)}</Text>
              </View>
              
              {selectedItem.enablePriceReduction && selectedItem.priceReductionTimes && selectedItem.priceReductionTimes.length > 0 && (
                <View>
                  <Text style={styles.priceLabel}>Current Price</Text>
                  <Text style={styles.currentPrice}>
                    ${getCurrentPrice(selectedItem).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {selectedItem.enablePriceReduction && selectedItem.priceReductionTimes && selectedItem.priceReductionTimes.length > 0 && (
              <View style={styles.reductionInfo}>
                <Text style={styles.reductionLabel}>Price Reductions:</Text>
                {selectedItem.priceReductionTimes
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((reduction, idx) => {
                    const reductionPrice = reduction.isPercentage
                      ? selectedItem.originalPrice * (1 - reduction.price / 100)
                      : reduction.price;
                    return (
                      <Text key={idx} style={styles.reductionText}>
                        {reduction.time}: ${reductionPrice.toFixed(2)}
                      </Text>
                    );
                  })}
              </View>
            )}
          </View>

          <View style={styles.buyerSection}>
            <Text style={styles.sectionTitle}>Buyer Information</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>
                Buyer Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={buyerName}
                onChangeText={setBuyerName}
                placeholder="Enter buyer's full name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={buyerEmail}
                onChangeText={setBuyerEmail}
                placeholder="buyer@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={buyerPhone}
                onChangeText={setBuyerPhone}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Sale Price <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={salePrice}
                onChangeText={setSalePrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <Text style={styles.helpText}>
                Current price: ${getCurrentPrice(selectedItem).toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClear}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Clear</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleRecordSale}
              disabled={submitting || !buyerName.trim() || !salePrice}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Record Sale</Text>
              )}
            </TouchableOpacity>
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
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
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
  scanSection: {
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
    marginBottom: 16,
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
  saleSection: {
    padding: 20,
    paddingTop: 0,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statusBadge: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 18,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  reductionInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  reductionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reductionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  buyerSection: {
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  required: {
    color: '#DC3545',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E5E5E5',
  },
  cancelButtonText: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#28A745',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
});
