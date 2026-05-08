import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  devBypassPhoneVerificationSession,
  FORM_CONTROL_MAX_WIDTH,
  signInWithPhone,
  verifyPhoneOTP,
} from 'shared';
import { continueSellerFlowAfterPhoneAuth } from '../../lib/afterSellerPhoneSession';
import { extractEventIdFromSellerRedirect } from '../../lib/postAuthRedirect';
import { theme } from '../../lib/theme';

const showDevPhoneBypass =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? true
    : typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SHOW_DEV_PHONE_BYPASS === '1';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { phone, redirect } = useLocalSearchParams<{ phone?: string; redirect?: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  const phoneE164 = typeof phone === 'string' ? phone : '';

  const notifyBypassFailure = (title: string, message: string) => {
    setBypassError(message);
    if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
      globalThis.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleVerify = async () => {
    if (!phoneE164) {
      Alert.alert('Missing phone', 'Go back and request a new code.');
      return;
    }
    const token = code.replace(/\D/g, '').trim();
    if (token.length < 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your text message.');
      return;
    }

    setBusy(true);
    try {
      const otpResult = await verifyPhoneOTP(phoneE164, token);
      await continueSellerFlowAfterPhoneAuth(router, redirect, {
        knownPhoneE164: phoneE164,
        sessionUser: otpResult?.user ?? null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      Alert.alert('Could not verify', message);
    } finally {
      setBusy(false);
    }
  };

  const handleSkipVerification = async () => {
    if (!phoneE164) {
      notifyBypassFailure('Missing phone', 'Go back to the previous screen.');
      return;
    }
    setBypassError(null);
    setBypassLoading(true);
    try {
      const checkInEventId = extractEventIdFromSellerRedirect(redirect);
      const sessionUser = await devBypassPhoneVerificationSession(phoneE164, {
        checkInEventId,
      });
      await continueSellerFlowAfterPhoneAuth(router, redirect, {
        knownPhoneE164: phoneE164,
        sessionUser,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bypass failed';
      notifyBypassFailure('Skip verification failed', message);
    } finally {
      setBypassLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phoneE164) {
      Alert.alert('Missing phone', 'Go back to the previous screen.');
      return;
    }
    setBusy(true);
    try {
      await signInWithPhone({ phone: phoneE164 });
      Alert.alert('Code sent', 'Check your messages for a new code.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not resend';
      Alert.alert('Resend failed', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter code</Text>
      <Text style={styles.subtitle}>
        We sent a code to {phoneE164 || 'your phone'}. Enter it below to continue.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>One-time code</Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={8}
          autoComplete="one-time-code"
          editable={!busy && !bypassLoading}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (busy || bypassLoading) && styles.primaryButtonDisabled]}
        onPress={handleVerify}
        disabled={busy || bypassLoading}
      >
        {busy ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
        )}
      </TouchableOpacity>

      {showDevPhoneBypass ? (
        <TouchableOpacity
          style={[
            styles.devBypassButton,
            (busy || bypassLoading) && styles.primaryButtonDisabled,
          ]}
          onPress={handleSkipVerification}
          disabled={busy || bypassLoading}
        >
          {bypassLoading ? (
            <ActivityIndicator color={theme.pureWhite} />
          ) : (
            <Text style={styles.devBypassButtonText}>SKIP VERIFICATION</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {showDevPhoneBypass ? (
        <Text style={styles.devBypassCaption}>
          Dev: same as login — signs you in without Twilio. Requires dev-phone-session-bypass deployed and
          ALLOW_DEV_PHONE_BYPASS=true on hosted projects (local Supabase works without it).
        </Text>
      ) : null}
      {bypassError ? <Text style={styles.devBypassError}>{bypassError}</Text> : null}

      <TouchableOpacity style={styles.secondary} onPress={handleResend} disabled={busy || bypassLoading}>
        <Text style={styles.secondaryText}>Resend code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondary}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(auth)/login');
        }}
        disabled={busy || bypassLoading}
      >
        <Text style={styles.secondaryText}>Change phone number</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 28,
  },
  inputContainer: {
    width: '100%',
    maxWidth: FORM_CONTROL_MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  primaryButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    maxWidth: FORM_CONTROL_MAX_WIDTH,
    alignSelf: 'center',
    marginTop: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  devBypassButton: {
    backgroundColor: '#B00000',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    maxWidth: FORM_CONTROL_MAX_WIDTH,
    alignSelf: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#7A0000',
  },
  devBypassButtonText: {
    color: theme.pureWhite,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  devBypassCaption: {
    marginTop: 8,
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    maxWidth: FORM_CONTROL_MAX_WIDTH,
    alignSelf: 'center',
  },
  devBypassError: {
    marginTop: 10,
    fontSize: 13,
    color: theme.error,
    textAlign: 'center',
    maxWidth: 360,
    fontWeight: '500',
    alignSelf: 'center',
  },
  secondary: {
    marginTop: 18,
    alignItems: 'center',
  },
  secondaryText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
  },
});
