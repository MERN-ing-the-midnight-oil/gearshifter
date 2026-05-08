import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  STAFF_FLOW_CONTENT_MAX_WIDTH,
  STAFF_MOBILE_EDGE_PADDING,
  STAFF_MOBILE_HEADER_PADDING_TOP,
  STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  getItem,
  updateItemStatus,
  useEvent,
  formatSellerItemStatusLabel,
  uploadItemCheckInPhotoFromUri,
  getItemCheckInPhotoSignedUrl,
  itemHasCheckInReceiveDocumentation,
  MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH,
  updateItemCheckInStaffDescription,
  notifySellerOnCheckIn,
  type Item,
  type ItemStatus,
} from 'shared';
import { printItemTag } from '../../../hardware/tagPrinter';

function organizerCheckInStatusLabel(status: ItemStatus): string {
  if (status === 'checked_in') return 'Registered';
  return formatSellerItemStatusLabel(status);
}

function statusBadgeStyleFor(status: ItemStatus) {
  switch (status) {
    case 'pending':
      return styles.statusPending;
    case 'checked_in':
      return styles.statusCheckedin;
    case 'for_sale':
      return styles.statusForsale;
    case 'sold':
      return styles.statusSold;
    case 'picked_up':
      return styles.statusPickedup;
    case 'donated':
      return styles.statusDonated;
    default:
      return styles.statusPending;
  }
}

export default function CheckInItemDetailsScreen() {
  const { itemId, sellerId, eventId } = useLocalSearchParams<{
    itemId: string;
    sellerId: string;
    eventId: string;
  }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [checkInPreviewUrl, setCheckInPreviewUrl] = useState<string | null>(null);
  const [checkInPreviewLoading, setCheckInPreviewLoading] = useState(false);
  const [staffDescDraft, setStaffDescDraft] = useState('');
  const receiveWelcomeRef = useRef<string | null>(null);
  const { event } = useEvent(typeof eventId === 'string' ? eventId : null);

  useEffect(() => {
    if (item) setStaffDescDraft(item.checkInStaffDescription ?? '');
  }, [item?.id]);

  const receiveDocReady =
    !!item?.checkInPhotoStoragePath?.trim() ||
    staffDescDraft.trim().length >= MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH;

  useFocusEffect(
    useCallback(() => {
      if (!item || item.status !== 'pending') return;
      if (itemHasCheckInReceiveDocumentation(item)) return;
      const key = `${item.id}:receive-hint`;
      if (receiveWelcomeRef.current === key) return;
      receiveWelcomeRef.current = key;
      const web = Platform.OS === 'web';
      Alert.alert(
        'Receive this item',
        web
          ? 'Before registering, enter a short handoff description of the physical item. The seller cannot submit check-in photos in advance; staff documents receipt here.'
          : 'Before registering, take a check-in photo with the camera or write what you verified at handoff. Check-in photos are captured only by staff here, not by the seller ahead of time.',
        [{ text: 'OK' }]
      );
    }, [item])
  );

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    getItem(itemId)
      .then((data) => {
        if (!cancelled) setItem(data || null);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [itemId]);

  useEffect(() => {
    if (!item || !eventId || typeof eventId !== 'string') return;
    if (item.eventId !== eventId) {
      Alert.alert('Wrong event', 'This item belongs to a different event.');
      router.back();
    }
  }, [item, eventId, router]);

  useEffect(() => {
    let cancelled = false;
    if (!item?.checkInPhotoStoragePath?.trim()) {
      setCheckInPreviewUrl(null);
      setCheckInPreviewLoading(false);
      return;
    }
    setCheckInPreviewLoading(true);
    getItemCheckInPhotoSignedUrl(item.checkInPhotoStoragePath, 7200)
      .then((url) => {
        if (!cancelled) setCheckInPreviewUrl(url);
      })
      .finally(() => {
        if (!cancelled) setCheckInPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.checkInPhotoStoragePath]);

  const uploadAfterPick = useCallback(
    async (uri: string, mimeType: string) => {
      if (!item) return;
      setPhotoUploading(true);
      try {
        const next = await uploadItemCheckInPhotoFromUri(item.id, uri, mimeType);
        setItem(next);
      } catch (error) {
        Alert.alert('Photo', error instanceof Error ? error.message : 'Could not save check-in photo');
      } finally {
        setPhotoUploading(false);
      }
    },
    [item]
  );

  const openCameraAndUpload = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Check-in photo',
        'Taking a check-in photo requires the iOS or Android organizer app (camera is not available on web).'
      );
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera', 'Camera access is needed to take a check-in photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.72,
      allowsEditing: false,
    });
    if (result.canceled === true || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    await uploadAfterPick(asset.uri, mime);
  }, [uploadAfterPick]);

  const handleCheckIn = async () => {
    if (!item || item.status !== 'pending') return;
    const photoOk = !!item.checkInPhotoStoragePath?.trim();
    const descOk = staffDescDraft.trim().length >= MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH;
    if (!photoOk && !descOk) {
      Alert.alert(
        'Photo or handoff description required',
        Platform.OS === 'web'
          ? `On web, enter at least ${MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH} characters describing the physical item you accepted, then tap Register item again.`
          : `Take a check-in photo, or write at least ${MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH} characters describing the physical item you accepted (what you verified matches this listing).`
      );
      return;
    }
    setUpdating(true);
    try {
      let nextItem = item;
      if (!photoOk && descOk) {
        nextItem = await updateItemCheckInStaffDescription(item.id, staffDescDraft);
        setItem(nextItem);
      }
      const updated = await updateItemStatus(nextItem.id, 'checked_in', {
        checkedInAt: new Date(),
      });
      setItem(updated);
      void notifySellerOnCheckIn(updated.id);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to check in item');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkForSale = async () => {
    if (!item || item.status !== 'checked_in') return;
    setUpdating(true);
    try {
      const updated = await updateItemStatus(item.id, 'for_sale');
      setItem(updated);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to mark for sale');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintTag = async () => {
    if (!item) return;
    setPrinting(true);
    try {
      const ok = await printItemTag(item, undefined, event ?? null);
      if (!ok) {
        const msg =
          Platform.OS === 'web'
            ? 'Printing is only available when a Bluetooth printer is connected from the Stations flow.'
            : 'Could not print. Connect a thermal printer or try again.';
        Alert.alert('Print', msg);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintThenPhoto = async () => {
    if (!item) return;
    if (Platform.OS === 'web') {
      Alert.alert(
        'Print & photo',
        'This shortcut needs the native app: printing on web is limited and the camera is unavailable here.'
      );
      return;
    }
    setPrinting(true);
    try {
      const ok = await printItemTag(item, undefined, event ?? null);
      if (!ok) {
        Alert.alert(
          'Print',
          'Fix printing first, then you can take a check-in photo with the separate button.'
        );
        return;
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Print failed');
      return;
    } finally {
      setPrinting(false);
    }
    await openCameraAndUpload();
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity style={styles.errorScreenButton} onPress={() => router.back()}>
          <Text style={styles.errorScreenButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const description =
    item.description ||
    (item.customFields && typeof item.customFields.description === 'string'
      ? item.customFields.description
      : '') ||
    'No description';
  const statusLabel = organizerCheckInStatusLabel(item.status);
  const staffCharsLeft = Math.max(0, MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH - staffDescDraft.trim().length);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Item Details</Text>
        <Text style={styles.itemNumber}>{item.itemNumber}</Text>
        <View style={[styles.statusBadge, statusBadgeStyleFor(item.status)]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        {item.status === 'pending' && (
          <Text style={styles.hintText}>
            Pre-registered online. When the seller hands in this piece of gear, document what you received (photo or
            handoff notes), then tap Register item.
          </Text>
        )}
      </View>

      {item.status === 'pending' && (
        <View style={styles.receiveSection}>
          <Text style={styles.sectionTitle}>Receive at handoff (required)</Text>
          <View style={styles.receiveCallout}>
            <Text style={styles.receiveCalloutText}>
              Staff must either take a check-in photo with this device&apos;s camera or write a short description of the
              physical item you are accepting. Seller listings alone are not enough to register receipt.
            </Text>
          </View>
          <Text style={styles.label}>Handoff description (if not using a photo)</Text>
          <TextInput
            style={styles.staffDescInput}
            value={staffDescDraft}
            onChangeText={setStaffDescDraft}
            placeholder={`At least ${MIN_CHECK_IN_STAFF_DESCRIPTION_LENGTH} characters: what you see on the item and tag`}
            placeholderTextColor="#999"
            multiline
            editable={!updating && !photoUploading}
            textAlignVertical="top"
          />
          <Text style={styles.charHint}>
            {item.checkInPhotoStoragePath?.trim()
              ? 'Photo on file — description is optional.'
              : staffCharsLeft > 0
                ? `${staffCharsLeft} more character${staffCharsLeft === 1 ? '' : 's'} needed (or take a photo).`
                : 'Enough text to register without a photo.'}
          </Text>
          <Text style={[styles.sectionTitle, styles.photoBlockTitle]}>Check-in photo</Text>
          <Text style={styles.photoHint}>
            Use the camera so the image is captured at the event. Compare at POS to reduce tag switching.
          </Text>
          {checkInPreviewLoading ? (
            <ActivityIndicator style={styles.photoSpinner} color="#007AFF" />
          ) : checkInPreviewUrl ? (
            <Image
              source={{ uri: checkInPreviewUrl }}
              style={styles.checkInPhoto}
              resizeMode="cover"
              accessibilityLabel="Check-in reference photo"
            />
          ) : (
            <Text style={styles.photoEmpty}>No check-in photo yet</Text>
          )}
          {item.checkInPhotoCapturedAt ? (
            <Text style={styles.photoMeta}>
              Captured {new Date(item.checkInPhotoCapturedAt).toLocaleString()}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.photoButton, (photoUploading || printing || updating) && styles.buttonDisabled]}
            onPress={openCameraAndUpload}
            disabled={photoUploading || printing || updating}
          >
            {photoUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.photoButtonText}>
                {item.checkInPhotoStoragePath ? 'Retake check-in photo' : 'Open camera — take check-in photo'}
              </Text>
            )}
          </TouchableOpacity>
          {Platform.OS !== 'web' ? (
            <TouchableOpacity
              style={[styles.photoButtonSecondary, (photoUploading || printing || updating) && styles.buttonDisabled]}
              onPress={handlePrintThenPhoto}
              disabled={photoUploading || printing || updating}
            >
              <Text style={styles.photoButtonSecondaryText}>Print label then take photo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.value}>{description}</Text>
        {item.checkInStaffDescription ? (
          <>
            <Text style={styles.label}>Staff handoff notes (at check-in)</Text>
            <Text style={styles.value}>{item.checkInStaffDescription}</Text>
          </>
        ) : null}
        <Text style={styles.label}>Original price</Text>
        <Text style={styles.value}>${item.originalPrice.toFixed(2)}</Text>
        {item.reducedPrice != null && (
          <>
            <Text style={styles.label}>Reduced price</Text>
            <Text style={styles.value}>${item.reducedPrice.toFixed(2)}</Text>
          </>
        )}
        {item.checkedInAt && (
          <>
            <Text style={styles.label}>Checked in</Text>
            <Text style={styles.value}>{new Date(item.checkedInAt).toLocaleString()}</Text>
          </>
        )}
      </View>

      {item.status !== 'pending' && (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Check-in photo</Text>
          {checkInPreviewLoading ? (
            <ActivityIndicator style={styles.photoSpinner} color="#007AFF" />
          ) : checkInPreviewUrl ? (
            <Image
              source={{ uri: checkInPreviewUrl }}
              style={styles.checkInPhoto}
              resizeMode="cover"
              accessibilityLabel="Check-in reference photo"
            />
          ) : (
            <Text style={styles.photoEmpty}>No check-in photo on file</Text>
          )}
          {item.checkInPhotoCapturedAt ? (
            <Text style={styles.photoMeta}>
              Captured {new Date(item.checkInPhotoCapturedAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.secondaryButton, (printing || updating || photoUploading) && styles.buttonDisabled]}
          onPress={handlePrintTag}
          disabled={printing || updating || photoUploading}
        >
          {printing ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.secondaryButtonText}>Print label</Text>
          )}
        </TouchableOpacity>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (updating || photoUploading || !receiveDocReady) && styles.buttonDisabled,
            ]}
            onPress={handleCheckIn}
            disabled={updating || photoUploading || !receiveDocReady}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Register item</Text>
            )}
          </TouchableOpacity>
        )}
        {item.status === 'checked_in' && (
          <TouchableOpacity
            style={[styles.primaryButton, (updating || photoUploading) && styles.buttonDisabled]}
            onPress={handleMarkForSale}
            disabled={updating || photoUploading}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Mark for Sale</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: STAFF_MOBILE_EDGE_PADDING,
  },
  loadingText: { marginTop: 10, color: '#666' },
  header: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_HEADER_PADDING_TOP,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  itemNumber: { fontSize: 18, fontWeight: '600', color: '#666', marginBottom: 8 },
  hintText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPending: { backgroundColor: '#FFF3CD' },
  statusCheckedin: { backgroundColor: '#D1ECF1' },
  statusForsale: { backgroundColor: '#D4EDDA' },
  statusSold: { backgroundColor: '#D4EDDA' },
  statusPickedup: { backgroundColor: '#E2E3E5' },
  statusDonated: { backgroundColor: '#F8D7DA' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  section: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingVertical: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginHorizontal: STAFF_MOBILE_EDGE_PADDING,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 },
  label: { fontSize: 12, color: '#666', marginTop: 12, marginBottom: 4 },
  value: { fontSize: 16, color: '#1A1A1A' },
  actions: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: 20,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: STAFF_FLOW_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: STAFF_FLOW_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  secondaryButtonText: { color: '#007AFF', fontSize: 18, fontWeight: '600' },
  receiveSection: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingVertical: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginHorizontal: STAFF_MOBILE_EDGE_PADDING,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  receiveCallout: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  receiveCalloutText: { fontSize: 14, color: '#1565C0', lineHeight: 20 },
  staffDescInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 100,
    color: '#1A1A1A',
  },
  charHint: { fontSize: 12, color: '#666', marginTop: 6, marginBottom: 16 },
  photoBlockTitle: { marginTop: 4 },
  photoSection: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingVertical: STAFF_MOBILE_EDGE_PADDING,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginHorizontal: STAFF_MOBILE_EDGE_PADDING,
    borderRadius: 12,
  },
  photoHint: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  photoSpinner: { marginVertical: 16 },
  checkInPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#ECECEC',
    marginBottom: 8,
  },
  photoEmpty: { fontSize: 14, color: '#888', marginBottom: 8 },
  photoMeta: { fontSize: 12, color: '#888', marginBottom: 12 },
  photoButton: {
    backgroundColor: '#5856D6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: STAFF_FLOW_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 10,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  photoButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  photoButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: STAFF_FLOW_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#5856D6',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  photoButtonSecondaryText: { color: '#5856D6', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 18, fontWeight: '600', color: '#DC3545', marginBottom: 20 },
  errorScreenButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorScreenButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
