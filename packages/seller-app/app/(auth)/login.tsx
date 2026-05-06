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
  normalizePhoneE164US,
  signInWithPhone,
} from 'shared';
import { continueSellerFlowAfterPhoneAuth } from '../../lib/afterSellerPhoneSession';
import { theme } from '../../lib/theme';

const showDevPhoneBypass =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? true
    : typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SHOW_DEV_PHONE_BYPASS === '1';

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [phoneRaw, setPhoneRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  const handleSendCode = async () => {
    let phoneE164: string;
    try {
      phoneE164 = normalizePhoneE164US(phoneRaw);
    } catch (e) {
      Alert.alert('Invalid phone', e instanceof Error ? e.message : 'Please check the number.');
      return;
    }

    setLoading(true);
    try {
      await signInWithPhone({ phone: phoneE164 });
      router.push({
        pathname: '/(auth)/verify-phone',
        params: {
          phone: phoneE164,
          ...(redirect ? { redirect: String(redirect) } : {}),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not send code';
      Alert.alert('SMS error', message);
    } finally {
      setLoading(false);
    }
  };

  const notifyBypassFailure = (title: string, message: string) => {
    setBypassError(message);
    if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
      globalThis.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSkipVerification = async () => {
    setBypassError(null);
    let phoneE164: string;
    try {
      phoneE164 = normalizePhoneE164US(phoneRaw);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please check the number.';
      notifyBypassFailure('Invalid phone', message);
      return;
    }

    setBypassLoading(true);
    try {
      const sessionUser = await devBypassPhoneVerificationSession(phoneE164);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Sign in with your phone number. We will text you a one-time code.</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Mobile phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 555 123 4567"
          value={phoneRaw}
          onChangeText={setPhoneRaw}
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!loading && !bypassLoading}
        />
        <Text style={styles.hint}>US numbers can be entered with or without +1.</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        onPress={handleSendCode}
        disabled={loading || bypassLoading}
      >
        {loading ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.primaryButtonText}>Send code</Text>
        )}
      </TouchableOpacity>

      {showDevPhoneBypass ? (
        <TouchableOpacity
          style={[
            styles.devBypassButton,
            (loading || bypassLoading) && styles.primaryButtonDisabled,
          ]}
          onPress={handleSkipVerification}
          disabled={loading || bypassLoading}
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
          Dev: signs you in like SMS OTP without Twilio. Requires the dev-phone-session-bypass Edge Function
          deployed; for hosted Supabase set function secret ALLOW_DEV_PHONE_BYPASS=true (local CLI works
          without it).
        </Text>
      ) : null}
      {bypassError ? <Text style={styles.devBypassError}>{bypassError}</Text> : null}

      <TouchableOpacity
        style={styles.secondary}
        onPress={() => router.push('/(auth)/signup')}
        disabled={loading || bypassLoading}
      >
        <Text style={styles.secondaryText}>New here? Create an account (same flow)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 340,
  },
  inputContainer: {
    width: '100%',
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
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.textSecondary,
  },
  primaryButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    width: '100%',
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
    width: '100%',
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
    maxWidth: 340,
  },
  devBypassError: {
    marginTop: 10,
    fontSize: 13,
    color: theme.error,
    textAlign: 'center',
    maxWidth: 360,
    fontWeight: '500',
  },
  secondary: {
    marginTop: 24,
    padding: 12,
  },
  secondaryText: {
    color: theme.link,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
