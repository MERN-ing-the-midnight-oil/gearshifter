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
import { normalizePhoneE164US, signInWithPhone } from 'shared';
import { theme } from '../../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [phoneRaw, setPhoneRaw] = useState('');
  const [loading, setLoading] = useState(false);

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
          editable={!loading}
        />
        <Text style={styles.hint}>US numbers can be entered with or without +1.</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        onPress={handleSendCode}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.primaryButtonText}>Send code</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondary}
        onPress={() => router.push('/(auth)/signup')}
        disabled={loading}
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
