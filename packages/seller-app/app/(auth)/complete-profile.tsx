import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { createSellerAfterPhoneProfile, getCurrentSeller, getCurrentUser } from 'shared';
import { resolveSellerPostAuthRedirect } from '../../lib/postAuthRedirect';
import { theme } from '../../lib/theme';

export default function CompleteSellerProfileScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailOptional, setEmailOptional] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user?.id || !user.phone) {
          router.replace('/(auth)/login');
          return;
        }
        const existing = await getCurrentSeller(user.id);
        if (!cancelled && existing) {
          router.replace(resolveSellerPostAuthRedirect(redirect));
        }
      } catch {
        if (!cancelled) router.replace('/(auth)/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redirect, router]);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'Please enter your first and last name.');
      return;
    }

    setBusy(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id || !user.phone) {
        router.replace('/(auth)/login');
        return;
      }

      await createSellerAfterPhoneProfile({
        authUserId: user.id,
        phoneE164: user.phone,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactEmail: emailOptional.trim() || null,
      });

      router.replace(resolveSellerPostAuthRedirect(redirect));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save profile';
      Alert.alert('Error', message);
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.activityIndicator} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Almost done</Text>
      <Text style={styles.subtitle}>
        Add your name so we can label your items and payouts. Email is optional.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>First name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!busy}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoComplete="family-name"
          editable={!busy}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          style={styles.input}
          value={emailOptional}
          onChangeText={setEmailOptional}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          editable={!busy}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 28,
  },
  field: {
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
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  primaryButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
});
