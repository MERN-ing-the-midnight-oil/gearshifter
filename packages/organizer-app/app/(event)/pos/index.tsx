import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  useEvent,
  getItem,
  parseItemQRCode,
  getCurrentPrice,
  completePosSaleWithBuyerReceipt,
  createPosReceiptIntent,
  completePosReceiptIntent,
  cancelPosReceiptIntent,
  getItemCheckInPhotoSignedUrl,
  normalizePhoneE164US,
  type Item,
} from 'shared';

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
  const [verifyPhotoUrl, setVerifyPhotoUrl] = useState<string | null>(null);
  const [verifyPhotoLoading, setVerifyPhotoLoading] = useState(false);

  const [receiptMode, setReceiptMode] = useState<'sms' | 'qr'>('sms');
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrIntentUrl, setQrIntentUrl] = useState<string | null>(null);
  const [qrIntentToken, setQrIntentToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedItem?.checkInPhotoStoragePath?.trim()) {
      setVerifyPhotoUrl(null);
      setVerifyPhotoLoading(false);
      return;
    }
    setVerifyPhotoLoading(true);
    getItemCheckInPhotoSignedUrl(selectedItem.checkInPhotoStoragePath, 7200)
      .then((url) => {
        if (!cancelled) setVerifyPhotoUrl(url);
      })
      .finally(() => {
        if (!cancelled) setVerifyPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItem?.id, selectedItem?.checkInPhotoStoragePath]);

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

    let buyerPhoneE164: string;
    try {
      buyerPhoneE164 = normalizePhoneE164US(buyerPhone);
    } catch (e) {
      Alert.alert(
        'Invalid phone',
        e instanceof Error ? e.message : 'Enter a valid mobile number so we can text the digital receipt.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await completePosSaleWithBuyerReceipt({
        itemId: selectedItem.id,
        soldPrice: price,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim() || undefined,
        buyerPhone: buyerPhoneE164,
      });

      Alert.alert(
        'Sale recorded',
        `Item ${selectedItem.itemNumber} is marked sold for $${price.toFixed(
          2
        )}. The buyer should receive a text receipt momentarily; the sale only completes after our provider accepts that message. The receipt includes a QR exit staff can scan to see check-in photos.`,
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

  const resetQrHandoff = () => {
    setQrModalVisible(false);
    setQrIntentUrl(null);
    setQrIntentToken(null);
  };

  const handleShowReceiptQr = async () => {
    if (!selectedItem) return;
    if (!buyerName.trim()) {
      Alert.alert('Error', 'Please enter the buyer\'s name');
      return;
    }
    const price = parseFloat(salePrice);
    if (!price || price <= 0) {
      Alert.alert('Error', 'Please enter a valid sale price');
      return;
    }

    let optionalPhone: string | undefined;
    if (buyerPhone.trim()) {
      try {
        optionalPhone = normalizePhoneE164US(buyerPhone);
      } catch (e) {
        Alert.alert(
          'Invalid phone',
          e instanceof Error ? e.message : 'Clear the phone field or enter a valid number.'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const { intentPublicUrl, intentToken } = await createPosReceiptIntent({
        itemId: selectedItem.id,
        soldPrice: price,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim() || undefined,
        buyerPhone: optionalPhone,
      });
      setQrIntentUrl(intentPublicUrl);
      setQrIntentToken(intentToken);
      setQrModalVisible(true);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create receipt QR');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteQrHandoff = async () => {
    if (!qrIntentToken) return;
    setSubmitting(true);
    try {
      await completePosReceiptIntent(qrIntentToken);
      resetQrHandoff();
      Alert.alert(
        'Sale recorded',
        `Item ${selectedItem?.itemNumber ?? ''} is marked sold. The buyer should have a photo of the receipt QR or the preview page.`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetQrHandoff();
              setSelectedItem(null);
              setBuyerName('');
              setBuyerEmail('');
              setBuyerPhone('');
              setSalePrice('');
              setQrCodeInput('');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not complete sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelQrHandoff = async () => {
    if (!qrIntentToken) {
      resetQrHandoff();
      return;
    }
    setSubmitting(true);
    try {
      await cancelPosReceiptIntent(qrIntentToken);
      resetQrHandoff();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not cancel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    resetQrHandoff();
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
    <>
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

          {selectedItem.checkInPhotoStoragePath ? (
            <View style={styles.verifyPhotoSection}>
              <Text style={styles.verifyPhotoTitle}>Check-in photo — verify before sale</Text>
              <Text style={styles.verifyPhotoHint}>
                Compare this image to the physical item and tag number {selectedItem.itemNumber} to confirm they
                match.
              </Text>
              {verifyPhotoLoading ? (
                <ActivityIndicator style={styles.verifyPhotoSpinner} color="#007AFF" />
              ) : verifyPhotoUrl ? (
                <Image
                  source={{ uri: verifyPhotoUrl }}
                  style={styles.verifyPhoto}
                  resizeMode="cover"
                  accessibilityLabel="Item as photographed at check-in"
                />
              ) : (
                <Text style={styles.verifyPhotoError}>Could not load check-in photo. Pull Clear and scan again.</Text>
              )}
            </View>
          ) : (
            <View style={styles.verifyPhotoSectionMuted}>
              <Text style={styles.verifyPhotoMutedText}>
                No check-in photo on file for this item. If your team captures photos at check-in, they will appear here
                for an extra verification step.
              </Text>
            </View>
          )}

          <View style={styles.buyerSection}>
            <Text style={styles.sectionTitle}>Buyer Information</Text>

            <Text style={styles.subsectionLabel}>Receipt</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modePill, receiptMode === 'sms' && styles.modePillActive]}
                onPress={() => {
                  setReceiptMode('sms');
                  resetQrHandoff();
                }}
              >
                <Text style={[styles.modePillText, receiptMode === 'sms' && styles.modePillTextActive]}>Text receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modePill, receiptMode === 'qr' && styles.modePillActive]}
                onPress={() => {
                  setReceiptMode('qr');
                  resetQrHandoff();
                }}
              >
                <Text style={[styles.modePillText, receiptMode === 'qr' && styles.modePillTextActive]}>QR handoff</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modeHint}>
              {receiptMode === 'sms'
                ? 'We text a receipt link before marking sold (carrier must accept the SMS).'
                : 'Show a QR the buyer can photograph. You confirm when they have it — nothing is sold until you tap “Receipt received”.'}
            </Text>

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
              <Text style={styles.label}>
                Buyer mobile{' '}
                {receiptMode === 'sms' ? <Text style={styles.required}>*</Text> : <Text style={styles.optionalMark}>(optional)</Text>}
              </Text>
              <TextInput
                style={styles.textInput}
                value={buyerPhone}
                onChangeText={setBuyerPhone}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
              />
              <Text style={styles.helpText}>
                {receiptMode === 'sms'
                  ? 'Required for text receipt: we send the SMS first; the sale completes only after the carrier accepts it. Receipt includes photos and QRs for exit.'
                  : 'Optional for QR handoff. Leave blank if the buyer only needs the QR or preview page.'}
              </Text>
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

            {receiptMode === 'sms' ? (
              <TouchableOpacity
                style={[styles.button, styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleRecordSale}
                disabled={submitting || !buyerName.trim() || !salePrice || !buyerPhone.trim()}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Record sale (text receipt)</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleShowReceiptQr}
                disabled={submitting || !buyerName.trim() || !salePrice}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Show receipt QR</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
    </View>
      )}
    </ScrollView>
      <Modal visible={qrModalVisible} animationType="fade" transparent onRequestClose={handleCancelQrHandoff}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Buyer receipt QR</Text>
            <Text style={styles.modalHint}>
              Ask the buyer to photograph this QR (or open the link on their phone). When they have it, tap{' '}
              <Text style={styles.modalHintBold}>Receipt received</Text> to mark the item sold.
            </Text>
            {qrIntentUrl ? (
              <View style={styles.modalQrWrap}>
                <QRCode value={qrIntentUrl} size={220} />
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.button, styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleCompleteQrHandoff}
              disabled={submitting || !qrIntentToken}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Receipt received — complete sale</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.modalSecondary]} onPress={handleCancelQrHandoff} disabled={submitting}>
              <Text style={styles.modalSecondaryText}>Cancel handoff</Text>
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
  verifyPhotoSection: {
    backgroundColor: '#FFF8E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F5D78E',
  },
  verifyPhotoSectionMuted: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  verifyPhotoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  verifyPhotoHint: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 12,
  },
  verifyPhotoSpinner: {
    marginVertical: 20,
  },
  verifyPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#ECECEC',
  },
  verifyPhotoError: {
    fontSize: 14,
    color: '#856404',
  },
  verifyPhotoMutedText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
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
  optionalMark: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  subsectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modePill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
  },
  modePillActive: {
    backgroundColor: '#007AFF',
  },
  modePillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },
  modeHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1A1A1A',
  },
  modalHint: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalHintBold: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalQrWrap: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  modalSecondary: {
    marginTop: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CCC',
  },
  modalSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
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
