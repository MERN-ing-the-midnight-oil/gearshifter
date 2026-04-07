import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { signUpAsSeller } from 'shared';
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
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePhone = (phone: string) => {
    // Basic phone validation - accepts formats like +1234567890, (123) 456-7890, etc.
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10;
  };

  const handleSubmit = async () => {
    try {
      console.log('handleSubmit called', { formData });
      
      // Validate required fields
      console.log('Checking email...', formData.email.trim());
      if (!formData.email.trim()) {
        console.log('Validation failed: email empty');
        alert('Error: Please enter your email address');
        return;
      }

      console.log('Validating email format...');
      if (!validateEmail(formData.email)) {
        console.log('Validation failed: invalid email');
        alert('Error: Please enter a valid email address');
        return;
      }

      console.log('Checking password...');
      if (!formData.password) {
        console.log('Validation failed: password empty');
        alert('Error: Please enter a password');
        return;
      }

      console.log('Checking password length...', formData.password.length);
      if (formData.password.length < 6) {
        console.log('Validation failed: password too short');
        alert('Error: Password must be at least 6 characters');
        return;
      }

      console.log('Checking password match...');
      if (formData.password !== formData.confirmPassword) {
        console.log('Validation failed: passwords do not match');
        alert('Error: Passwords do not match');
        return;
      }

      console.log('Checking first name...');
      if (!formData.firstName.trim()) {
        console.log('Validation failed: first name empty');
        alert('Error: Please enter your first name');
        return;
      }

      console.log('Checking last name...');
      if (!formData.lastName.trim()) {
        console.log('Validation failed: last name empty');
        alert('Error: Please enter your last name');
        return;
      }

      console.log('Checking phone...');
      if (!formData.phone.trim()) {
        console.log('Validation failed: phone empty');
        alert('Error: Please enter your phone number');
        return;
      }

      console.log('Validating phone format...');
      if (!validatePhone(formData.phone)) {
        console.log('Validation failed: invalid phone');
        alert('Error: Please enter a valid phone number');
        return;
      }

      console.log('All validations passed, proceeding with signup...');

      setSubmitting(true);
      console.log('Starting signup process...');
      
      console.log('Calling signUpAsSeller with:', {
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
      });
      
      const result = await signUpAsSeller({
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });

      console.log('Signup successful:', result);

      // Use browser alert for web compatibility
      alert('Account created successfully! You can now browse events and list items for sale.');
      console.log('Navigating to tabs...');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        // Handle common Supabase errors
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Too many signup attempts. Please wait a few minutes and try again, or use a different email address.';
        } else if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password is too weak. Please choose a stronger password.';
        } else if (error.message.includes('auth_user_id') || error.message.includes('column')) {
          errorMessage = 'Database error. Please check the console for details.';
        }
      }
      alert(`Error: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to sell items at swap events</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>
            Email <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Text style={styles.helpText}>This will be your permanent account email</Text>
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
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Phone Number <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="+1 (555) 123-4567"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Text style={styles.helpText}>You can update this later in your profile</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Your email is permanent and tied to your account. You can update your name and phone number later.
          </Text>
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
          style={styles.loginLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? Sign in
          </Text>
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
  submitButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: theme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: theme.link,
  },
});



