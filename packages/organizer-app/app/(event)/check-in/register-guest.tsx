import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useEvent, createGuestSeller, getCurrentUser } from 'shared';

export default function RegisterGuestSellerScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { event, loading: eventLoading } = useEvent(eventId);
  const router = useRouter();

  const [photoIdVerified, setPhotoIdVerified] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('USA');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate photo ID verification
    if (!photoIdVerified) {
      Alert.alert('Verification Required', 'You must verify the seller\'s photo ID before proceeding.');
      return;
    }

    // Validate required fields
    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s first name');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s last name');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s phone number');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s email address');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s street address');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s city');
      return;
    }
    if (!state.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s state');
      return;
    }
    if (!zipCode.trim()) {
      Alert.alert('Error', 'Please enter the seller\'s zip code');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Validate phone format (basic)
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    if (!phoneRegex.test(phone.trim()) || phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    // Get current admin user ID (who is verifying)
    let verifiedBy: string;
    try {
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Unable to identify the verifying user. Please log in again.');
        return;
      }
      verifiedBy = user.id;
    } catch (error) {
      Alert.alert('Error', 'Unable to identify the verifying user. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      const seller = await createGuestSeller({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        country: country.trim() || 'USA',
        photoIdVerifiedBy: verifiedBy,
      });

      Alert.alert(
        'Seller Registered',
        `${seller.firstName} ${seller.lastName} has been registered as a guest seller.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to check-in with seller ID
              router.replace(`/(event)/check-in?id=${eventId}&sellerId=${seller.id}`);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to register seller');
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Register Guest Seller</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo ID Verification</Text>
          <View style={styles.verificationBox}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>
                  I have verified the seller's photo ID
                </Text>
                <Text style={styles.helpText}>
                  Please check the seller's government-issued photo ID and confirm the information matches.
                </Text>
              </View>
              <Switch
                value={photoIdVerified}
                onValueChange={setPhotoIdVerified}
                trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
                thumbColor={photoIdVerified ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seller Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>
              First Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Last Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Phone Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Email Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="seller@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>
              Street Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main Street"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Address Line 2 (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={addressLine2}
              onChangeText={setAddressLine2}
              placeholder="Apt, Suite, Unit, etc."
              autoCapitalize="words"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfWidth]}>
              <Text style={styles.label}>
                City <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.field, styles.halfWidth]}>
              <Text style={styles.label}>
                State <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={state}
                onChangeText={setState}
                placeholder="State"
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfWidth]}>
              <Text style={styles.label}>
                Zip Code <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="12345"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            <View style={[styles.field, styles.halfWidth]}>
              <Text style={styles.label}>Country</Text>
              <TextInput
                style={styles.textInput}
                value={country}
                onChangeText={setCountry}
                placeholder="USA"
                autoCapitalize="words"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!photoIdVerified || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!photoIdVerified || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Register Seller</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.noteText}>
          * Required fields. All information will be verified against the seller's photo ID.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingTop: 40,
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
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  verificationBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  field: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
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
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
});

