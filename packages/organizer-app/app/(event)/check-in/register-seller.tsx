import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  useEvent,
  lookupSellersByPhoneForCheckIn,
  sendSellerCheckInSignupSms,
  STAFF_MOBILE_EDGE_PADDING,
  STAFF_MOBILE_HEADER_PADDING_TOP,
  STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  type Seller,
} from 'shared';
import { popOrCheckInHome } from '../../../lib/checkInNavigation';

const showDevPhoneBypass =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? true
    : typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SHOW_DEV_PHONE_BYPASS === '1';

function firstQueryParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Yields so the click task can finish (avoids Chrome “click handler took Nms” / INP for long async chains). */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Web: RN `Alert.alert` is often a no-op; use a blocking dialog so staff always see feedback. */
function staffAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
    setTimeout(() => {
      globalThis.alert(`${title}\n\n${message}`);
      onOk?.();
    }, 0);
    return;
  }
  if (onOk) {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  } else {
    Alert.alert(title, message);
  }
}

/** Web cannot show multi-button `Alert` reliably; approximate Cancel / prepare / continue with confirms. */
async function staffExistingSellerChoice(
  detail: string,
  prepareLabel: string,
  onPrepare: () => Promise<void> | void,
  onContinue: () => void
): Promise<void> {
  if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
    await yieldToMain();
    const goContinue = globalThis.confirm(
      `Seller already exists\n\n${detail}\n\n` +
        'OK = continue check-in on this device. Cancel = sign-in / bypass options.'
    );
    if (goContinue) {
      onContinue();
      return;
    }
    const goPrepare = globalThis.confirm(`OK = ${prepareLabel} for the seller app on their phone. Cancel = close.`);
    if (goPrepare) {
      try {
        await onPrepare();
      } catch (e) {
        staffAlert('Error', e instanceof Error ? e.message : 'Request failed');
      }
    }
    return;
  }
  await new Promise<void>((resolve) => {
    Alert.alert('Seller already exists', detail, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
      {
        text: prepareLabel,
        onPress: () => {
          void (async () => {
            try {
              await onPrepare();
            } catch (e) {
              staffAlert('Error', e instanceof Error ? e.message : 'Request failed');
            } finally {
              resolve();
            }
          })();
        },
      },
      {
        text: 'Continue check-in',
        onPress: () => {
          onContinue();
          resolve();
        },
      },
    ]);
  });
}

export default function RegisterSellerScreen() {
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = firstQueryParam(params.eventId);
  const { event, loading: eventLoading } = useEvent(eventId ?? null);
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendSignInText = async (opts: {
    forExistingSeller: boolean;
    phoneRaw: string;
    /** When false, caller owns `submitting` (e.g. bypass wraps lookup + send). */
    manageSubmitting?: boolean;
  }) => {
    const manage = opts.manageSubmitting !== false;
    if (!eventId) {
      staffAlert('Missing event', 'Open Register Seller from check-in again so the event is in the URL.');
      return;
    }
    if (manage) setSubmitting(true);
    try {
      if (Platform.OS === 'web') await yieldToMain();
      const { simulatedSms } = await sendSellerCheckInSignupSms({
        phone: opts.phoneRaw,
        eventId,
        resendForExistingSeller: opts.forExistingSeller,
      });
      const devHint =
        'No text was sent (dev mode). Ask the seller to open the seller app, enter this phone number, then tap SKIP VERIFICATION on the login screen (or on the code screen if they already tapped Send code).';
      const prodHint = opts.forExistingSeller
        ? 'Ask the seller to open the seller app, enter the code from the text, and sign in. They can then show their account QR for check-in.'
        : 'Ask the seller to open the seller app, sign in with this phone number, enter the code from the text, and complete their name and email on their device. When they are done, use “Check in a pre-registered seller” and scan their QR code (or look up by phone again).';
      const title = simulatedSms ? 'Dev: sign-in prepared' : 'Text sent';
      const body = simulatedSms ? devHint : prodHint;
      staffAlert(title, body, () => popOrCheckInHome(router, eventId));
    } catch (err) {
      staffAlert('Error', err instanceof Error ? err.message : 'Failed to send sign-in text');
    } finally {
      if (manage) setSubmitting(false);
    }
  };

  const goToReviewItems = (sellerId: string) => {
    if (!eventId) return;
    router.replace(
      `/(event)/check-in/review-items?eventId=${eventId}&sellerId=${sellerId}` as any
    );
  };

  const handleSubmit = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      staffAlert('Error', "Please enter the seller's phone number");
      return;
    }
    const digits = trimmedPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      staffAlert('Error', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }
    if (!eventId) {
      staffAlert('Error', 'Missing event');
      return;
    }

    await yieldToMain();
    const matches = await lookupSellersByPhoneForCheckIn(trimmedPhone).catch(() => [] as Seller[]);
    if (matches.length > 0) {
      const existing = matches[0]!;
      if (matches.length > 1) {
        staffAlert(
          'Multiple matches',
          'More than one seller matches this number. Use check-in search to pick the right one.'
        );
        return;
      }
      const prepareSignInLabel = showDevPhoneBypass ? 'Bypass verification' : 'Text sign-in code';
      await staffExistingSellerChoice(
        `A seller with this phone number already exists — ${existing.firstName} ${existing.lastName}. Continue check-in here, or send them a new sign-in for the seller app.`,
        prepareSignInLabel,
        () => sendSignInText({ forExistingSeller: true, phoneRaw: trimmedPhone }),
        () => goToReviewItems(existing.id)
      );
      return;
    }

    await sendSignInText({ forExistingSeller: false, phoneRaw: trimmedPhone });
  };

  /** Dev: same server path as “Text seller” (dev-phone-session-bypass); explicit control for staff testing without Twilio. */
  const handleBypassVerification = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      staffAlert('Error', "Please enter the seller's phone number");
      return;
    }
    const digits = trimmedPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      staffAlert('Error', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }
    if (!eventId) {
      staffAlert('Error', 'Missing event');
      return;
    }

    await yieldToMain();
    setSubmitting(true);
    try {
      const matches = await lookupSellersByPhoneForCheckIn(trimmedPhone).catch(() => [] as Seller[]);
      if (matches.length > 1) {
        staffAlert(
          'Multiple matches',
          'More than one seller matches this number. Use check-in search to pick the right one.'
        );
        return;
      }
      if (matches.length === 1) {
        const existing = matches[0]!;
        await staffExistingSellerChoice(
          `${existing.firstName} ${existing.lastName} — run dev bypass so they can use SKIP VERIFICATION in the seller app, or continue check-in here.`,
          'Bypass verification',
          () => sendSignInText({ forExistingSeller: true, phoneRaw: trimmedPhone, manageSubmitting: false }),
          () => goToReviewItems(existing.id)
        );
        return;
      }

      await sendSignInText({ forExistingSeller: false, phoneRaw: trimmedPhone, manageSubmitting: false });
    } catch (e) {
      staffAlert('Error', e instanceof Error ? e.message : 'Bypass failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (eventLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => popOrCheckInHome(router, eventId)}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => popOrCheckInHome(router, eventId)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Register New Seller</Text>
          <Text style={styles.subtitle}>{event.name}</Text>
          <Text style={styles.helpText}>
            Enter the seller&apos;s mobile number only. We&apos;ll text them a sign-in code for the seller app so they
            can enter their name, email, and the rest of their profile—the same flow as when they sign up on their own.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              Phone number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>US 10-digit or international with +country code.</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Text seller to sign in</Text>
            )}
          </TouchableOpacity>

          {showDevPhoneBypass ? (
            <>
              <TouchableOpacity
                style={[styles.devBypassButton, submitting && styles.submitButtonDisabled]}
                onPress={() => void handleBypassVerification()}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.devBypassButtonText}>BYPASS VERIFICATION</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.devBypassCaption}>
                Dev only: prepares the same sign-in as the seller app&apos;s SKIP VERIFICATION (no Twilio). Requires
                ALLOW_DEV_PHONE_BYPASS or local Supabase; deploy dev-phone-session-bypass and send-seller-check-in-sms.
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: STAFF_MOBILE_EDGE_PADDING,
    paddingTop: STAFF_MOBILE_EDGE_PADDING,
    paddingBottom: STAFF_MOBILE_EDGE_PADDING + 24,
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  devBypassButton: {
    backgroundColor: '#B00000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
    minHeight: STAFF_MOBILE_MIN_TOUCH_HEIGHT,
    borderWidth: 2,
    borderColor: '#7A0000',
    width: '100%',
    maxWidth: 400,
  },
  devBypassButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  devBypassCaption: {
    marginTop: 10,
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 400,
    alignSelf: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
});
