import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { signInWithPhone, verifyPhoneOTP } from 'shared';
import { continueSellerFlowAfterPhoneAuth } from '../../lib/afterSellerPhoneSession';
import { theme } from '../../lib/theme';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { phone, redirect } = useLocalSearchParams<{ phone?: string; redirect?: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const phoneE164 = typeof phone === 'string' ? phone : '';

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
          editable={!busy}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
        onPress={handleVerify}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondary} onPress={handleResend} disabled={busy}>
        <Text style={styles.secondaryText}>Resend code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondary}
        onPress={() => router.back()}
        disabled={busy}
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
