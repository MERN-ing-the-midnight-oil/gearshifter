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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { signInWithEmail, signOut } from 'shared';
import { theme } from '../../lib/theme';
import { AXEL_TEST_ADMIN_EMAIL, AXEL_TEST_ADMIN_PASSWORD } from '../../lib/testAxelAdmin';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ signout?: string }>();
  const signOutHandled = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Dev: open `/(auth)/login?signout=1` to clear session and show this form (see root _layout).
  useEffect(() => {
    if (!__DEV__ || signOutHandled.current) return;
    const v = params.signout;
    const raw = Array.isArray(v) ? v[0] : v;
    if (raw !== '1' && raw !== 'true') return;
    signOutHandled.current = true;
    (async () => {
      try {
        setLoading(true);
        await signOut();
        router.replace('/(auth)/login');
      } catch (e) {
        console.warn('[login] signout intent failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.signout, router]);

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
      // Navigation will be handled by the auth guard
      router.replace('/(dashboard)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const fillAxelTest = () => {
    setEmail(AXEL_TEST_ADMIN_EMAIL);
    setPassword(AXEL_TEST_ADMIN_PASSWORD);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Admin Login</Text>
      <Text style={styles.subtitle}>Sign in to manage your events</Text>

      <View style={styles.testRow}>
        <TouchableOpacity style={styles.testFillButton} onPress={fillAxelTest} disabled={loading}>
          <Text style={styles.testFillButtonText}>Fill Axel test credentials</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.testLinkButton}
          onPress={() => router.push('/(auth)/test-login')}
          disabled={loading}
        >
          <Text style={styles.testLinkButtonText}>Open Axel test sign-in page →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="admin@example.com"
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
          placeholder="••••••••"
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
      >
        {loading ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.loginButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signupButton}
        onPress={() => router.push('/(auth)/signup')}
        disabled={loading}
      >
        <Text style={styles.signupButtonText}>Create New Account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => router.push('/(auth)/forgot-password')}
        disabled={loading}
      >
        <Text style={styles.forgotButtonText}>Forgot Password?</Text>
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
    paddingVertical: 36,
  },
  testRow: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  testFillButton: {
    backgroundColor: theme.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
    ...(Platform.OS === 'web' && {
      // @ts-ignore web
      cursor: 'pointer',
    }),
  },
  testFillButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  testLinkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  testLinkButtonText: {
    color: theme.link,
    fontSize: 15,
    fontWeight: '600',
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
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
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
  loginButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  signupButton: {
    marginTop: 20,
    padding: 12,
  },
  signupButtonText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 10,
    padding: 12,
  },
  forgotButtonText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
  },
});
