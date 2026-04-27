import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { signInWithEmail } from 'shared';
import { theme } from '../../lib/theme';
import { AXEL_TEST_ADMIN_EMAIL, AXEL_TEST_ADMIN_PASSWORD } from '../../lib/testAxelAdmin';

/**
 * Dedicated test sign-in for Axel Admin (Bellingham Ski Swap).
 * Create the account first: `yarn create:axel-admin` from repo root (needs Supabase env).
 */
export default function TestLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState(AXEL_TEST_ADMIN_EMAIL);
  const [password, setPassword] = useState(AXEL_TEST_ADMIN_PASSWORD);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail({ email: email.trim(), password });
      router.replace('/(dashboard)');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to sign in';
      Alert.alert('Sign-in failed', `${msg}\n\nRun yarn create:axel-admin if this user is missing.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.badge}>Test account</Text>
      <Text style={styles.title}>Axel Admin</Text>
      <Text style={styles.subtitle}>Bellingham Ski Swap · organizer sign-in</Text>

      <View style={styles.hintBox}>
        <Text style={styles.hintText}>
          Default password is &quot;asdfasdf&quot;. Create this user from the repo:{' '}
          <Text style={styles.hintMono}>yarn create:axel-admin</Text>
          {'\n'}(needs <Text style={styles.hintMono}>.env</Text> with Supabase URL + service role key.)
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          editable={!loading}
        />
      </View>

      <TouchableOpacity
        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        {...(Platform.OS === 'web' && { accessibilityRole: 'button' as const })}
      >
        {loading ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.loginButtonText}>Sign in as Axel Admin</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={loading}>
        <Text style={styles.backButtonText}>← Back to main login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.buttonText,
    backgroundColor: theme.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  hintBox: {
    width: '100%',
    maxWidth: 400,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 24,
  },
  hintText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  hintMono: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12,
    color: theme.text,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
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
  loginButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    padding: 12,
  },
  backButtonText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
  },
});
