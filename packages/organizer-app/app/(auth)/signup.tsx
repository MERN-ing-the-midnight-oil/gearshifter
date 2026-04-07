import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { signUpAsAdmin } from 'shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { theme } from '../../lib/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    organizationName: '',
    organizationSlug: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateSlug = (slug: string) => {
    // Slug should be lowercase, alphanumeric with hyphens
    const re = /^[a-z0-9-]+$/;
    return re.test(slug) && slug.length >= 3;
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleOrganizationNameChange = (text: string) => {
    setFormData({
      ...formData,
      organizationName: text,
      organizationSlug: formData.organizationSlug || generateSlug(text),
    });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!formData.password) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!formData.firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }

    if (!formData.lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return;
    }

    if (!formData.organizationName.trim()) {
      Alert.alert('Error', 'Please enter your organization name');
      return;
    }

    if (!formData.organizationSlug.trim()) {
      Alert.alert('Error', 'Please enter an organization slug');
      return;
    }

    if (!validateSlug(formData.organizationSlug)) {
      Alert.alert('Error', 'Organization slug must be lowercase letters, numbers, and hyphens only (e.g., "bellingham-bike-swap")');
      return;
    }

    setSubmitting(true);
    try {
      await signUpAsAdmin({
        email: formData.email.trim(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        organizationName: formData.organizationName.trim(),
        organizationSlug: formData.organizationSlug.trim(),
      });

      Alert.alert(
        'Success',
        'Account created successfully! You can now create and manage events.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(dashboard)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Too many signup attempts. Please wait a few minutes and try again.';
        } else if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('slug') || error.message.includes('unique')) {
          errorMessage = 'An organization with this slug already exists. Please choose a different one.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password is too weak. Please choose a stronger password.';
        }
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Organizer Account</Text>
        <Text style={styles.subtitle}>Set up your organization and start managing events</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="admin@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Password <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Confirm Password <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              placeholder="Re-enter your password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              First Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              placeholder="John"
              autoCapitalize="words"
              autoComplete="given-name"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Last Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              placeholder="Doe"
              autoCapitalize="words"
              autoComplete="family-name"
              editable={!submitting}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Organization Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.organizationName}
              onChangeText={handleOrganizationNameChange}
              placeholder="Bellingham Ski Swap"
              autoCapitalize="words"
              editable={!submitting}
            />
            <Text style={styles.helpText}>The name of your organization</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Organization Slug <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.organizationSlug}
              onChangeText={(text) => setFormData({ ...formData, organizationSlug: text.toLowerCase() })}
              placeholder="bellingham-bike-swap"
              autoCapitalize="none"
              editable={!submitting}
            />
            <Text style={styles.helpText}>URL-friendly identifier (lowercase, hyphens only). This slug will appear in your organization's website URLs.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={styles.submitButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
          disabled={submitting}
        >
          <Text style={styles.loginButtonText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  field: {
    marginBottom: 20,
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
  helpText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  loginButton: {
    padding: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
  },
});

