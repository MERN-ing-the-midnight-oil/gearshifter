import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Switch, Pressable } from 'react-native';
import { useAuth, useAdminOrganization, createEvent, signOut } from 'shared';
import { useRouter } from 'expo-router';
import { useState, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { theme } from '../../lib/theme';
import { InlineWebCalendar } from '../../components/InlineWebCalendar';

// Conditionally import DateTimePicker only for native platforms
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DateTimePicker = Platform.OS !== 'web' 
  ? require('@react-native-community/datetimepicker').default 
  : null;

const createPortalWeb =
  Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      (require('react-dom') as { createPortal: (node: ReactNode, container: Element | DocumentFragment) => ReactNode })
        .createPortal
    : null;

// Web Date Picker Modal Component
const WebDatePickerModal = ({ 
  visible, 
  value, 
  onClose, 
  onSelect, 
  mode = 'date',
  minimumDate,
  title,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSelect: (date: Date) => void;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  title?: string;
}) => {
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const [selectedDate, setSelectedDate] = useState<Date>(value || new Date());
  const [selectedTime, setSelectedTime] = useState<{ hours: number; minutes: number }>(() => {
    if (value) {
      return { hours: value.getHours(), minutes: value.getMinutes() };
    }
    return { hours: 9, minutes: 0 };
  });
  const prevVisibleRef = useRef(false);
  const [inputMountKey, setInputMountKey] = useState(0);

  // When modal is closed, keep internal state aligned with parent `value` for the next open.
  useEffect(() => {
    if (!visible && value) {
      setSelectedDate(value);
      setSelectedTime({ hours: value.getHours(), minutes: value.getMinutes() });
    }
  }, [value, visible]);

  // On open: sync from `value` and remount the time field; date uses react-datepicker (web).
  useLayoutEffect(() => {
    if (visible && !prevVisibleRef.current) {
      if (value) {
        setSelectedDate(value);
        setSelectedTime({ hours: value.getHours(), minutes: value.getMinutes() });
      }
      setInputMountKey((k) => k + 1);
    }
    prevVisibleRef.current = visible;
  }, [visible, value]);

  const handleConfirm = () => {
    const date = new Date(selectedDate);
    if (mode === 'datetime') {
      date.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    }
    onSelect(date);
    onClose();
  };

  const selectedCombined = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    return d;
  }, [selectedDate, selectedTime]);

  if (Platform.OS !== 'web') return null;

  // Portaled overlay (not RN Modal): react-native-web Modal wraps content in a focus trap.
  // Native <input type="date"> calendar UI moves focus outside that subtree, the trap
  // refocuses inside the modal and the picker collapses — feels like the dialog closed.
  if (typeof document === 'undefined' || !createPortalWeb) return null;

  const pickerUi = visible ? (
    <View style={webPickerStyles.modalOverlay}>
      <Pressable style={webPickerStyles.modalBackdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss date picker" />
      <Pressable
        style={webPickerStyles.modalContent}
        onPress={(e) => {
          const ev = e as unknown as { stopPropagation?: () => void };
          ev.stopPropagation?.();
        }}
        {...(Platform.OS === 'web'
          ? ({
              onMouseDown: (e: { stopPropagation?: () => void }) => e.stopPropagation?.(),
            } as object)
          : {})}
      >
        <View style={webPickerStyles.modalHeader}>
          <Text style={webPickerStyles.modalTitle}>
            {title ?? (mode === 'date' ? 'Select Date' : 'Select Date & Time')}
          </Text>
          <TouchableOpacity onPress={onClose} style={webPickerStyles.closeButton}>
            <Text style={webPickerStyles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={webPickerStyles.pickerContainer}>
          <View style={webPickerStyles.dateInputContainer}>
            <Text style={webPickerStyles.inputLabel}>Date</Text>
            <InlineWebCalendar
              key={`web-cal-${inputMountKey}`}
              selected={selectedCombined}
              minDate={minimumDate}
              showTimeSelect={mode === 'datetime'}
              onChange={(d) => {
                setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
                if (mode === 'datetime') {
                  setSelectedTime({ hours: d.getHours(), minutes: d.getMinutes() });
                }
              }}
            />
          </View>

        </View>

        <View style={webPickerStyles.modalFooter}>
          <TouchableOpacity onPress={onClose} style={webPickerStyles.cancelButton}>
            <Text style={webPickerStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirm} style={webPickerStyles.confirmButton}>
            <Text style={webPickerStyles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </View>
  ) : null;

  return createPortalWeb(pickerUi, document.body);
};

export default function CreateEventScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization, loading: orgLoading, error: orgError } = useAdminOrganization(user?.id || null);
  const signOutButtonRef = useRef<any>(null);
  
  // Log component state
  useEffect(() => {
    console.log('[CreateEvent] Component mounted/updated:', {
      hasUser: !!user,
      userId: user?.id,
      hasOrganization: !!organization,
      organizationId: organization?.id,
      organizationName: organization?.name,
      orgLoading,
      orgError: orgError?.message,
    });
  }, [user, organization, orgLoading, orgError]);

  // Attach direct DOM event listener for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Try to find the button after a short delay to ensure it's rendered
      const timer = setTimeout(() => {
        if (signOutButtonRef.current) {
          const element = signOutButtonRef.current;
          const node = element?._nativeNode || element?.base || element;
          
          if (node && node.addEventListener) {
            console.log('[CreateEvent] Attaching DOM event listener to sign out button');
            const handleClick = (e: Event) => {
              console.log('[CreateEvent] DOM click event fired on sign out button!');
              e.preventDefault();
              e.stopPropagation();
              handleSignOut();
            };
            
            node.addEventListener('click', handleClick);
            
            return () => {
              node.removeEventListener('click', handleClick);
            };
          } else {
            console.warn('[CreateEvent] Could not find DOM node for sign out button');
          }
        } else {
          console.warn('[CreateEvent] signOutButtonRef.current is null');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Set today's date at midnight for default registration open date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [formData, setFormData] = useState({
    name: '',
    eventDate: null as Date | null,
    registrationOpenDate: today,
    registrationCloseDate: null as Date | null,
    shopOpenTime: null as Date | null,
    shopCloseTime: null as Date | null,
    gearDropOffStartTime: null as Date | null,
    gearDropOffEndTime: null as Date | null,
    gearDropOffPlace: '',
    pickupStartTime: null as Date | null,
    pickupEndTime: null as Date | null,
    priceDropTimes: [] as Date[],
    priceDropAmountControl: 'organization' as 'organization' | 'seller',
    allowSellerPriceDrops: false,
    maxSellerPriceDrops: null as number | null,
    minTimeBetweenSellerPriceDrops: null as number | null, // in minutes
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState<{
    eventDate?: boolean;
    registrationOpenDate?: boolean;
    registrationCloseDate?: boolean;
    shopOpenTime?: boolean;
    shopCloseTime?: boolean;
    gearDropOffStartTime?: boolean;
    gearDropOffEndTime?: boolean;
    pickupStartTime?: boolean;
    pickupEndTime?: boolean;
    priceDropTime?: { [key: number]: boolean };
  }>({});

  // Helper functions to format dates
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  const formatDateTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper to format date for HTML5 date input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to format datetime for HTML5 datetime-local input (YYYY-MM-DDTHH:MM)
  const formatDateTimeForInput = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to parse HTML5 input values to Date
  const parseInputDate = (value: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  const handleDateChange = (field: 'eventDate' | 'registrationOpenDate' | 'registrationCloseDate' | 'shopOpenTime' | 'shopCloseTime' | 'gearDropOffStartTime' | 'gearDropOffEndTime' | 'pickupStartTime' | 'pickupEndTime', event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker({ ...showPicker, [field]: false });
      if (event.type === 'set' && selectedDate) {
        setFormData({ ...formData, [field]: selectedDate });
      }
    } else {
      // iOS: update value as user scrolls, close on dismiss
      if (event.type === 'set' && selectedDate) {
        setFormData({ ...formData, [field]: selectedDate });
      } else if (event.type === 'dismissed') {
        setShowPicker({ ...showPicker, [field]: false });
      }
    }
  };

  const handlePriceDropTimeChange = (index: number, event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: false } });
      if (event.type === 'set' && selectedDate) {
        const newPriceDropTimes = [...formData.priceDropTimes];
        newPriceDropTimes[index] = selectedDate;
        setFormData({ ...formData, priceDropTimes: newPriceDropTimes });
      }
    } else {
      // iOS: update value as user scrolls, close on dismiss
      if (event.type === 'set' && selectedDate) {
        const newPriceDropTimes = [...formData.priceDropTimes];
        newPriceDropTimes[index] = selectedDate;
        setFormData({ ...formData, priceDropTimes: newPriceDropTimes });
      } else if (event.type === 'dismissed') {
        setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: false } });
      }
    }
  };

  const addPriceDropTime = () => {
    const defaultDate = formData.shopOpenTime || formData.eventDate || new Date();
    setFormData({ ...formData, priceDropTimes: [...formData.priceDropTimes, defaultDate] });
  };

  const removePriceDropTime = (index: number) => {
    const newPriceDropTimes = formData.priceDropTimes.filter((_, i) => i !== index);
    setFormData({ ...formData, priceDropTimes: newPriceDropTimes });
  };

  const handleSubmit = async () => {
    console.log('[CreateEvent] handleSubmit called');
    console.log('[CreateEvent] User:', { id: user?.id, email: user?.email });
    console.log('[CreateEvent] Organization:', organization);
    console.log('[CreateEvent] Form data:', {
      name: formData.name,
      eventDate: formData.eventDate,
      registrationOpenDate: formData.registrationOpenDate,
      registrationCloseDate: formData.registrationCloseDate,
      shopOpenTime: formData.shopOpenTime,
      shopCloseTime: formData.shopCloseTime,
      priceDropTimes: formData.priceDropTimes,
    });
    console.log('[CreateEvent] Submitting state:', submitting);

    if (!user || !organization) {
      console.error('[CreateEvent] Missing user or organization:', { user: !!user, organization: !!organization });
      Alert.alert('Error', 'Organization not found');
      return;
    }

    // Validate required fields
    if (!formData.name.trim()) {
      console.warn('[CreateEvent] Validation failed: Event name is empty');
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    if (!formData.eventDate) {
      console.warn('[CreateEvent] Validation failed: Event date is missing');
      Alert.alert('Error', 'Please select an event date');
      return;
    }

    // Validate date logic (only if dates are provided)
    if (formData.registrationOpenDate && formData.registrationCloseDate) {
      if (formData.registrationOpenDate >= formData.registrationCloseDate) {
        console.warn('[CreateEvent] Validation failed: Registration close date must be after open date');
        Alert.alert('Error', 'Registration close date must be after open date');
      return;
    }
    }

    if (formData.registrationCloseDate && formData.eventDate < formData.registrationCloseDate) {
      console.warn('[CreateEvent] Validation failed: Event date must be after registration close date');
      Alert.alert('Error', 'Event date must be after registration close date');
      return;
    }

    if (formData.shopOpenTime && formData.shopCloseTime) {
      if (formData.shopCloseTime <= formData.shopOpenTime) {
      console.warn('[CreateEvent] Validation failed: Shop close time must be after open time');
      Alert.alert('Error', 'Shop close time must be after open time');
      return;
      }
    }

    if (formData.pickupStartTime && formData.pickupEndTime && formData.pickupEndTime <= formData.pickupStartTime) {
      Alert.alert('Error', 'Pickup end time must be after pickup start time');
      return;
    }
    if (formData.gearDropOffStartTime && formData.gearDropOffEndTime && formData.gearDropOffEndTime <= formData.gearDropOffStartTime) {
      Alert.alert('Error', 'Gear drop-off end time must be after start time');
      return;
    }
    if ((formData.pickupStartTime || formData.pickupEndTime) && formData.shopCloseTime) {
      if (formData.pickupStartTime && formData.pickupStartTime < formData.shopCloseTime) {
        Alert.alert('Error', 'Pickup window start should be on or after shop close time');
        return;
      }
    }

    // Validate price drop times
    for (let i = 0; i < formData.priceDropTimes.length; i++) {
      const priceDropTime = formData.priceDropTimes[i];
      if (formData.shopOpenTime && priceDropTime < formData.shopOpenTime) {
        console.warn(`[CreateEvent] Validation failed: Price drop time ${i + 1} must be after shop open time`);
        Alert.alert('Error', `Price drop time ${i + 1} must be after shop open time`);
        return;
      }
      if (formData.shopCloseTime && priceDropTime > formData.shopCloseTime) {
        console.warn(`[CreateEvent] Validation failed: Price drop time ${i + 1} must be before shop close time`);
        Alert.alert('Error', `Price drop time ${i + 1} must be before shop close time`);
        return;
      }
    }

    console.log('[CreateEvent] All validations passed, calling createEvent API');
    setSubmitting(true);
    try {
      const eventPayload = {
        name: formData.name.trim(),
        eventDate: formData.eventDate,
        registrationOpenDate: formData.registrationOpenDate || undefined,
        registrationCloseDate: formData.registrationCloseDate || undefined,
        shopOpenTime: formData.shopOpenTime || undefined,
        shopCloseTime: formData.shopCloseTime || undefined,
        gearDropOffStartTime: formData.gearDropOffStartTime || undefined,
        gearDropOffEndTime: formData.gearDropOffEndTime || undefined,
        gearDropOffPlace: formData.gearDropOffPlace?.trim() || undefined,
        pickupStartTime: formData.pickupStartTime || undefined,
        pickupEndTime: formData.pickupEndTime || undefined,
        priceDropTime: formData.priceDropTimes.length > 0 ? formData.priceDropTimes[0] : undefined,
        // DB enum is `active` | `closed` (see event_status migration), not legacy registration/checkin/...
        status: 'active',
        settings: {
          priceDropTimes: formData.priceDropTimes.length > 0 ? formData.priceDropTimes : undefined,
          priceDropAmountControl: formData.priceDropTimes.length > 0 ? formData.priceDropAmountControl : undefined,
          allowSellerPriceDrops: formData.allowSellerPriceDrops,
          maxSellerPriceDrops: formData.maxSellerPriceDrops || undefined,
          minTimeBetweenSellerPriceDrops: formData.minTimeBetweenSellerPriceDrops || undefined,
        },
      };
      console.log('[CreateEvent] Calling createEvent with:', {
        organizationId: organization.id,
        payload: {
          ...eventPayload,
          eventDate: eventPayload.eventDate?.toISOString(),
          registrationOpenDate: eventPayload.registrationOpenDate?.toISOString(),
          registrationCloseDate: eventPayload.registrationCloseDate?.toISOString(),
          shopOpenTime: eventPayload.shopOpenTime?.toISOString(),
          shopCloseTime: eventPayload.shopCloseTime?.toISOString(),
          priceDropTime: eventPayload.priceDropTime?.toISOString(),
        },
      });
      
      const result = await createEvent(organization.id, eventPayload);
      console.log('[CreateEvent] Event created successfully:', result);

      router.replace('/(dashboard)');
    } catch (error) {
      console.error('[CreateEvent] Error creating event:', error);
      console.error('[CreateEvent] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      });
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create event');
    } finally {
      console.log('[CreateEvent] Setting submitting to false');
      setSubmitting(false);
    }
  };


  const handleSignOut = async () => {
    console.log('[CreateEvent] handleSignOut called');
    console.log('[CreateEvent] Platform:', Platform.OS);
    console.log('[CreateEvent] Current user:', { id: user?.id, email: user?.email });
    
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            console.log('[CreateEvent] Sign out cancelled by user');
          },
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await performSignOut();
          },
        },
      ]
    );
  };

  const performSignOut = async () => {
    console.log('[CreateEvent] performSignOut called - starting sign out process...');
    try {
      console.log('[CreateEvent] Calling signOut()...');
      await signOut();
      console.log('[CreateEvent] signOut() completed successfully');
      console.log('[CreateEvent] Navigating to login page...');
      router.replace('/(auth)/login');
      console.log('[CreateEvent] Navigation complete');
    } catch (error: any) {
      console.error('[CreateEvent] Sign out error:', error);
      console.error('[CreateEvent] Error details:', {
        message: error?.message,
        stack: error?.stack,
        error: error,
      });
      const errorMessage = error?.message || 'Failed to sign out';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Create New Event</Text>
          <View style={styles.buttonRow}>
            {/* Sign out using TouchableOpacity with ref for DOM listener */}
            <TouchableOpacity
              ref={signOutButtonRef}
              onPress={() => {
                console.log('[CreateEvent] Sign out TouchableOpacity onPress');
                handleSignOut();
              }}
              activeOpacity={0.7}
              style={styles.signOutButton}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
        {organization && (
          <Text style={styles.subtitle}>{organization.name}</Text>
        )}
        {user?.email && (
          <Text style={styles.userEmail}>Logged in as: {user.email}</Text>
        )}
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>
            Event Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="e.g., Musical Instrument Swap 2026"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Event Date <Text style={styles.required}>*</Text>
          </Text>
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker({ ...showPicker, eventDate: true })}
              >
                <Text style={[styles.pickerButtonText, !formData.eventDate && styles.placeholderText]}>
                  {formData.eventDate ? formatDate(formData.eventDate) : 'Select event date'}
                </Text>
              </TouchableOpacity>
              <WebDatePickerModal
                visible={!!showPicker.eventDate}
            value={formData.eventDate}
                onClose={() => setShowPicker({ ...showPicker, eventDate: false })}
                onSelect={(date) => {
                  setFormData({ ...formData, eventDate: date });
                  setShowPicker({ ...showPicker, eventDate: false });
                }}
                mode="date"
                title="Event date"
                minimumDate={new Date()}
              />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker({ ...showPicker, eventDate: true })}
              >
                <Text style={[styles.pickerButtonText, !formData.eventDate && styles.placeholderText]}>
                  {formData.eventDate ? formatDate(formData.eventDate) : 'Select event date'}
                </Text>
              </TouchableOpacity>
              {showPicker.eventDate && (
                <View>
                  <DateTimePicker
                    value={formData.eventDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => handleDateChange('eventDate', event, selectedDate)}
                    minimumDate={new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => setShowPicker({ ...showPicker, eventDate: false })}
                    >
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
          <Text style={styles.helpText}>The main date of the swap event</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Registration Open Date (Optional)
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, registrationOpenDate: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.registrationOpenDate && styles.placeholderText]}>
                    {formData.registrationOpenDate ? formatDate(formData.registrationOpenDate) : 'Select registration open date'}
                  </Text>
                </TouchableOpacity>
                {formData.registrationOpenDate && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, registrationOpenDate: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.registrationOpenDate}
            value={formData.registrationOpenDate}
                  onClose={() => setShowPicker({ ...showPicker, registrationOpenDate: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, registrationOpenDate: date });
                    setShowPicker({ ...showPicker, registrationOpenDate: false });
                  }}
                  mode="date"
                  title="Registration open date"
                  minimumDate={new Date()}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, registrationOpenDate: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.registrationOpenDate && styles.placeholderText]}>
                    {formData.registrationOpenDate ? formatDate(formData.registrationOpenDate) : 'Select registration open date'}
                  </Text>
                </TouchableOpacity>
                {formData.registrationOpenDate && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, registrationOpenDate: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.registrationOpenDate && (
                  <View>
                    <DateTimePicker
                      value={formData.registrationOpenDate || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('registrationOpenDate', event, selectedDate)}
                      minimumDate={new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, registrationOpenDate: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When sellers can start registering</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Registration Close Date (Optional)
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, registrationCloseDate: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.registrationCloseDate && styles.placeholderText]}>
                    {formData.registrationCloseDate ? formatDate(formData.registrationCloseDate) : 'Select registration close date'}
                  </Text>
                </TouchableOpacity>
                {formData.registrationCloseDate && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, registrationCloseDate: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.registrationCloseDate}
            value={formData.registrationCloseDate}
                  onClose={() => setShowPicker({ ...showPicker, registrationCloseDate: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, registrationCloseDate: date });
                    setShowPicker({ ...showPicker, registrationCloseDate: false });
                  }}
                  mode="date"
                  title="Registration close date"
                  minimumDate={formData.registrationOpenDate || new Date()}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, registrationCloseDate: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.registrationCloseDate && styles.placeholderText]}>
                    {formData.registrationCloseDate ? formatDate(formData.registrationCloseDate) : 'Select registration close date'}
                  </Text>
                </TouchableOpacity>
                {formData.registrationCloseDate && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, registrationCloseDate: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.registrationCloseDate && (
                  <View>
                    <DateTimePicker
                      value={formData.registrationCloseDate || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('registrationCloseDate', event, selectedDate)}
                      minimumDate={formData.registrationOpenDate || new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, registrationCloseDate: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>Last day sellers can register</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Shop Open Time (Optional)
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, shopOpenTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.shopOpenTime && styles.placeholderText]}>
                    {formData.shopOpenTime ? formatDateTime(formData.shopOpenTime) : 'Select shop open time'}
                  </Text>
                </TouchableOpacity>
                {formData.shopOpenTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, shopOpenTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.shopOpenTime}
                  value={formData.shopOpenTime}
                  onClose={() => setShowPicker({ ...showPicker, shopOpenTime: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, shopOpenTime: date });
                    setShowPicker({ ...showPicker, shopOpenTime: false });
                  }}
                  mode="datetime"
                  title="Shop open time"
                  minimumDate={formData.eventDate || new Date()}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, shopOpenTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.shopOpenTime && styles.placeholderText]}>
                    {formData.shopOpenTime ? formatDateTime(formData.shopOpenTime) : 'Select shop open time'}
                  </Text>
                </TouchableOpacity>
                {formData.shopOpenTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, shopOpenTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.shopOpenTime && (
                  <View>
                    <DateTimePicker
                      value={formData.shopOpenTime || new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('shopOpenTime', event, selectedDate)}
                      minimumDate={formData.eventDate || new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, shopOpenTime: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When the swap opens for shopping</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Shop Close Time (Optional)
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, shopCloseTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.shopCloseTime && styles.placeholderText]}>
                    {formData.shopCloseTime ? formatDateTime(formData.shopCloseTime) : 'Select shop close time'}
                  </Text>
                </TouchableOpacity>
                {formData.shopCloseTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, shopCloseTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.shopCloseTime}
                  value={formData.shopCloseTime}
                  onClose={() => setShowPicker({ ...showPicker, shopCloseTime: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, shopCloseTime: date });
                    setShowPicker({ ...showPicker, shopCloseTime: false });
                  }}
                  mode="datetime"
                  title="Shop close time"
                  minimumDate={formData.shopOpenTime || formData.eventDate || new Date()}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, shopCloseTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.shopCloseTime && styles.placeholderText]}>
                    {formData.shopCloseTime ? formatDateTime(formData.shopCloseTime) : 'Select shop close time'}
                  </Text>
                </TouchableOpacity>
                {formData.shopCloseTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, shopCloseTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.shopCloseTime && (
                  <View>
                    <DateTimePicker
                      value={formData.shopCloseTime || new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('shopCloseTime', event, selectedDate)}
                      minimumDate={formData.shopOpenTime || formData.eventDate || new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, shopCloseTime: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When the swap closes</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Gear drop-off – start time
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, gearDropOffStartTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.gearDropOffStartTime && styles.placeholderText]}>
                    {formData.gearDropOffStartTime ? formatDateTime(formData.gearDropOffStartTime) : 'Select gear drop-off start'}
                  </Text>
                </TouchableOpacity>
                {formData.gearDropOffStartTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, gearDropOffStartTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.gearDropOffStartTime}
                  value={formData.gearDropOffStartTime}
                  onClose={() => setShowPicker({ ...showPicker, gearDropOffStartTime: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, gearDropOffStartTime: date });
                    setShowPicker({ ...showPicker, gearDropOffStartTime: false });
                  }}
                  mode="datetime"
                  title="Gear drop-off start"
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, gearDropOffStartTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.gearDropOffStartTime && styles.placeholderText]}>
                    {formData.gearDropOffStartTime ? formatDateTime(formData.gearDropOffStartTime) : 'Select gear drop-off start'}
                  </Text>
                </TouchableOpacity>
                {formData.gearDropOffStartTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, gearDropOffStartTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.gearDropOffStartTime && (
                  <View>
                    <DateTimePicker
                      value={formData.gearDropOffStartTime || new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('gearDropOffStartTime', event, selectedDate)}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, gearDropOffStartTime: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When sellers can start dropping off gear</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Gear drop-off – end time
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, gearDropOffEndTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.gearDropOffEndTime && styles.placeholderText]}>
                    {formData.gearDropOffEndTime ? formatDateTime(formData.gearDropOffEndTime) : 'Select gear drop-off end'}
                  </Text>
                </TouchableOpacity>
                {formData.gearDropOffEndTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, gearDropOffEndTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.gearDropOffEndTime}
                  value={formData.gearDropOffEndTime}
                  onClose={() => setShowPicker({ ...showPicker, gearDropOffEndTime: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, gearDropOffEndTime: date });
                    setShowPicker({ ...showPicker, gearDropOffEndTime: false });
                  }}
                  mode="datetime"
                  title="Gear drop-off end"
                  minimumDate={formData.gearDropOffStartTime || undefined}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, gearDropOffEndTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.gearDropOffEndTime && styles.placeholderText]}>
                    {formData.gearDropOffEndTime ? formatDateTime(formData.gearDropOffEndTime) : 'Select gear drop-off end'}
                  </Text>
                </TouchableOpacity>
                {formData.gearDropOffEndTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, gearDropOffEndTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.gearDropOffEndTime && (
                  <View>
                    <DateTimePicker
                      value={formData.gearDropOffEndTime || new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('gearDropOffEndTime', event, selectedDate)}
                      {...(formData.gearDropOffStartTime
                        ? { minimumDate: formData.gearDropOffStartTime }
                        : {})}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, gearDropOffEndTime: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When the gear drop-off window ends</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Gear drop-off – place
          </Text>
          <TextInput
            style={styles.textInput}
            value={formData.gearDropOffPlace}
            onChangeText={(text) => setFormData({ ...formData, gearDropOffPlace: text })}
            placeholder="e.g., Main Hall, 123 Oak St"
            autoCapitalize="words"
          />
          <Text style={styles.helpText}>Where sellers should drop off their gear (address or room name)</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Seller pickup window – start (Optional)
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, pickupStartTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.pickupStartTime && styles.placeholderText]}>
                    {formData.pickupStartTime ? formatDateTime(formData.pickupStartTime) : 'Select pickup window start'}
                  </Text>
                </TouchableOpacity>
                {formData.pickupStartTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, pickupStartTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.pickupStartTime}
                  value={formData.pickupStartTime}
                  onClose={() => setShowPicker({ ...showPicker, pickupStartTime: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, pickupStartTime: date });
                    setShowPicker({ ...showPicker, pickupStartTime: false });
                  }}
                  mode="datetime"
                  title="Seller pickup window start"
                  minimumDate={formData.shopCloseTime || formData.eventDate || new Date()}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, pickupStartTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.pickupStartTime && styles.placeholderText]}>
                    {formData.pickupStartTime ? formatDateTime(formData.pickupStartTime) : 'Select pickup window start'}
                  </Text>
                </TouchableOpacity>
                {formData.pickupStartTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, pickupStartTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.pickupStartTime && (
                  <View>
                    <DateTimePicker
                      value={formData.pickupStartTime || new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('pickupStartTime', event, selectedDate)}
                      minimumDate={formData.shopCloseTime || formData.eventDate || new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, pickupStartTime: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When sellers can start picking up unsold equipment (typically after shop closes)</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Seller pickup window – end (Optional)
          </Text>
          <View style={styles.dateFieldRow}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, pickupEndTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.pickupEndTime && styles.placeholderText]}>
                    {formData.pickupEndTime ? formatDateTime(formData.pickupEndTime) : 'Select pickup window end'}
                  </Text>
                </TouchableOpacity>
                {formData.pickupEndTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, pickupEndTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                <WebDatePickerModal
                  visible={!!showPicker.pickupEndTime}
                  value={formData.pickupEndTime}
                  onClose={() => setShowPicker({ ...showPicker, pickupEndTime: false })}
                  onSelect={(date) => {
                    setFormData({ ...formData, pickupEndTime: date });
                    setShowPicker({ ...showPicker, pickupEndTime: false });
                  }}
                  mode="datetime"
                  title="Seller pickup window end"
                  minimumDate={formData.pickupStartTime || formData.shopCloseTime || formData.eventDate || new Date()}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonWithClear]}
                  onPress={() => setShowPicker({ ...showPicker, pickupEndTime: true })}
                >
                  <Text style={[styles.pickerButtonText, !formData.pickupEndTime && styles.placeholderText]}>
                    {formData.pickupEndTime ? formatDateTime(formData.pickupEndTime) : 'Select pickup window end'}
                  </Text>
                </TouchableOpacity>
                {formData.pickupEndTime && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setFormData({ ...formData, pickupEndTime: null })}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {showPicker.pickupEndTime && (
                  <View>
                    <DateTimePicker
                      value={formData.pickupEndTime || new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => handleDateChange('pickupEndTime', event, selectedDate)}
                      minimumDate={formData.pickupStartTime || formData.shopCloseTime || formData.eventDate || new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowPicker({ ...showPicker, pickupEndTime: false })}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.helpText}>When the pickup window ends</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Organization Price Drop Times (Optional)</Text>
          <Text style={styles.helpText}>Set automatic price reduction times for all items</Text>
          
          {formData.priceDropTimes.map((priceDropTime, index) => (
            <View key={index} style={styles.priceDropTimeRow}>
              <View style={styles.priceDropTimeInput}>
                {Platform.OS === 'web' ? (
                  <>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: true } })}
                    >
                      <Text style={[styles.pickerButtonText, !priceDropTime && styles.placeholderText]}>
                        {priceDropTime ? formatDateTime(priceDropTime) : `Price drop ${index + 1}`}
                      </Text>
                    </TouchableOpacity>
                    <WebDatePickerModal
                      visible={!!showPicker.priceDropTime?.[index]}
                      value={priceDropTime}
                      onClose={() => setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: false } })}
                      onSelect={(date) => {
                        const newPriceDropTimes = [...formData.priceDropTimes];
                        newPriceDropTimes[index] = date;
                        setFormData({ ...formData, priceDropTimes: newPriceDropTimes });
                        setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: false } });
                      }}
                      mode="datetime"
                      title={`Organization price drop ${index + 1}`}
                      minimumDate={formData.shopOpenTime || formData.eventDate || new Date()}
                    />
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: true } })}
                    >
                      <Text style={[styles.pickerButtonText, !priceDropTime && styles.placeholderText]}>
                        {priceDropTime ? formatDateTime(priceDropTime) : `Price drop ${index + 1}`}
                      </Text>
                    </TouchableOpacity>
                    {showPicker.priceDropTime?.[index] && (
                      <View>
                        <DateTimePicker
                          value={priceDropTime || new Date()}
                          mode="datetime"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => handlePriceDropTimeChange(index, event, selectedDate)}
                          minimumDate={formData.shopOpenTime || formData.eventDate || new Date()}
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => setShowPicker({ ...showPicker, priceDropTime: { ...showPicker.priceDropTime, [index]: false } })}
                          >
                            <Text style={styles.doneButtonText}>Done</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePriceDropTime(index)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={addPriceDropTime}
          >
            <Text style={styles.addButtonText}>+ Add Price Drop Time</Text>
          </TouchableOpacity>

          {formData.priceDropTimes.length > 0 && (
            <View style={styles.priceDropControlSection}>
              <Text style={styles.controlLabel}>Who Sets Price Drop Amount/Percentage?</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setFormData({ ...formData, priceDropAmountControl: 'organization' })}
                >
                  <View style={styles.radioButton}>
                    {formData.priceDropAmountControl === 'organization' && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>Organization</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setFormData({ ...formData, priceDropAmountControl: 'seller' })}
                >
                  <View style={styles.radioButton}>
                    {formData.priceDropAmountControl === 'seller' && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>Seller</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>
                {formData.priceDropAmountControl === 'organization' 
                  ? 'Organization will set the price drop amount/percentage for all items'
                  : 'Sellers will choose their own price drop amount/percentage for each item'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.label}>Allow Sellers to Set Price Drop Times</Text>
              <Text style={styles.helpText}>Let sellers create their own individual price drop times</Text>
            </View>
            <Switch
              value={formData.allowSellerPriceDrops}
              onValueChange={(value) => setFormData({ ...formData, allowSellerPriceDrops: value })}
              trackColor={{ false: theme.border, true: theme.button }}
              thumbColor={formData.allowSellerPriceDrops ? theme.buttonText : theme.textSecondary}
            />
          </View>
          
          {formData.allowSellerPriceDrops && (
            <View style={styles.sellerPriceDropControls}>
              <View style={styles.controlField}>
                <Text style={styles.controlLabel}>
                  Maximum Number of Price Drops (Optional)
                </Text>
                <TextInput
                  style={styles.numberInput}
                  value={formData.maxSellerPriceDrops?.toString() || ''}
                  onChangeText={(text) => {
                    const num = text === '' ? null : parseInt(text, 10);
                    setFormData({ 
                      ...formData, 
                      maxSellerPriceDrops: (num !== null && !isNaN(num) && num > 0) ? num : null 
                    });
                  }}
                  placeholder="e.g., 3"
                  keyboardType="numeric"
                />
                <Text style={styles.helpText}>Maximum number of price drops each seller can create</Text>
              </View>

              <View style={styles.controlField}>
                <Text style={styles.controlLabel}>
                  Minimum Time Between Price Drops (Optional)
                </Text>
                <View style={styles.timeInputRow}>
                  <TextInput
                    style={[styles.numberInput, styles.timeInput]}
                    value={formData.minTimeBetweenSellerPriceDrops ? Math.floor(formData.minTimeBetweenSellerPriceDrops / 60).toString() : ''}
                    onChangeText={(text) => {
                      const hours = text === '' ? 0 : parseInt(text, 10);
                      const minutes = formData.minTimeBetweenSellerPriceDrops ? formData.minTimeBetweenSellerPriceDrops % 60 : 0;
                      const totalMinutes = (hours * 60) + minutes;
                      setFormData({ 
                        ...formData, 
                        minTimeBetweenSellerPriceDrops: (totalMinutes > 0) ? totalMinutes : null 
                      });
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.timeLabel}>hours</Text>
                  <TextInput
                    style={[styles.numberInput, styles.timeInput]}
                    value={formData.minTimeBetweenSellerPriceDrops ? (formData.minTimeBetweenSellerPriceDrops % 60).toString() : ''}
                    onChangeText={(text) => {
                      const mins = text === '' ? 0 : parseInt(text, 10);
                      const hours = formData.minTimeBetweenSellerPriceDrops ? Math.floor(formData.minTimeBetweenSellerPriceDrops / 60) : 0;
                      const totalMinutes = (hours * 60) + mins;
                      setFormData({ 
                        ...formData, 
                        minTimeBetweenSellerPriceDrops: (totalMinutes > 0) ? totalMinutes : null 
                      });
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.timeLabel}>minutes</Text>
                </View>
                <Text style={styles.helpText}>Minimum time that must pass between price drops</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 After creating the event, you can configure item fields, categories, and registration on the dashboard.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {!organization && !orgLoading && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>⚠️ Cannot Create Event</Text>
              <Text style={styles.errorText}>
                Your user account is not associated with an organization. You need to be set up as an admin user first.
              </Text>
              <Text style={styles.errorDetails}>
                To fix this:{'\n'}
                1. In Supabase: SQL Editor → run scripts/sql/add-admin-by-email.sql (edit the email to match your account){'\n'}
                2. Or run scripts/sql/create-admin-user.sql and set your auth user UUID from Authentication → Users
              </Text>
              {orgError && (
                <Text style={styles.errorDetails}>
                  Error: {orgError.message}
                </Text>
              )}
            </View>
          )}
          
          {orgLoading && (
            <Text style={styles.infoText}>Loading organization...</Text>
          )}
          {submitting && (
            <Text style={styles.infoText}>Submitting...</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              (submitting || !organization) && styles.submitButtonDisabled,
              pressed && styles.submitButtonPressed,
            ]}
            onPress={(e) => {
              console.log('[CreateEvent] Button pressed - Pressable onPress');
              console.log('[CreateEvent] Event object:', e);
              console.log('[CreateEvent] Button state:', { 
                submitting, 
                hasOrganization: !!organization,
                organizationId: organization?.id,
                organizationName: organization?.name,
              });
              if (!organization) {
                console.error('[CreateEvent] Cannot submit: organization is null');
                Alert.alert('Error', 'Organization not loaded. Please refresh the page.');
                return;
              }
              if (submitting) {
                console.warn('[CreateEvent] Already submitting, ignoring click');
                return;
              }
              handleSubmit();
            }}
            disabled={submitting || !organization}
          >
            {submitting ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <Text style={styles.submitButtonText}>Create Event</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 4,
  },
  userEmail: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.error || '#dc3545',
    borderRadius: 6,
    ...(Platform.OS === 'web' && {
      // @ts-ignore - web-specific styles
      cursor: 'pointer',
      userSelect: 'none',
    }),
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  required: {
    color: theme.error,
  },
  textInput: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pickerButton: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerButtonWithClear: {
    flex: 1,
  },
  pickerButtonText: {
    fontSize: 16,
    color: theme.text,
  },
  dateFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    backgroundColor: theme.offWhite,
    borderRadius: 8,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  clearButtonText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderText: {
    color: theme.textSecondary,
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
  helpText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: theme.offWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: theme.text,
  },
  buttonContainer: {
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    cursor: Platform.OS === 'web' ? 'pointer' : 'default',
  },
  submitButtonPressed: {
    opacity: 0.8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: Platform.OS === 'web' ? 'not-allowed' : 'default',
  },
  submitButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: theme.error,
    fontSize: 14,
    marginBottom: 8,
    padding: 8,
    backgroundColor: theme.offWhite,
    borderRadius: 8,
  },
  infoText: {
    color: theme.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 12,
    color: '#856404',
    marginTop: 8,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
  },
  priceDropTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  priceDropTimeInput: {
    flex: 1,
  },
  removeButton: {
    backgroundColor: theme.error,
    borderRadius: 8,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: theme.offWhite,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: theme.button,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  sellerPriceDropControls: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  controlField: {
    marginBottom: 20,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 0,
    minWidth: 80,
  },
  timeLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    minWidth: 50,
  },
  priceDropControlSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  radioGroup: {
    marginTop: 12,
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.button,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.button,
  },
  radioLabel: {
    fontSize: 16,
    color: theme.text,
  },
});

const webPickerStyles = StyleSheet.create({
  modalOverlay: {
    // RN web: fixed full-viewport overlay (not in RN core ViewStyle typings)
    ...({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100000,
    } as object),
    flex: 1,
    width: '100%',
    minHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 0,
  },
  modalContent: {
    zIndex: 1,
    ...(Platform.OS === 'web' ? ({ position: 'relative' } as object) : {}),
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    width: Platform.OS === 'web' ? 400 : '90%',
    maxWidth: 500,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: theme.offWhite,
  },
  closeButtonText: {
    fontSize: 24,
    color: theme.textSecondary,
    lineHeight: 24,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  timeInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: theme.offWhite,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 48,
  },
  timeInput: {
    backgroundColor: theme.offWhite,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 48,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.offWhite,
  },
  cancelButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.button,
  },
  confirmButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});



