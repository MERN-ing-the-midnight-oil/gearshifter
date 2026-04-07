import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { useEvent, useAuth, getEventSwapRegistrationFields, getEventSwapRegistrationPageSettings, getSellerSwapRegistration, saveSellerSwapRegistration, updateSeller } from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import type { SwapRegistrationFieldDefinition } from 'shared';

export default function SwapRegistrationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading: eventLoading } = useEvent(id);
  const { user } = useAuth();
  const router = useRouter();
  
  const [fieldDefinitions, setFieldDefinitions] = useState<SwapRegistrationFieldDefinition[]>([]);
  const [pageSettings, setPageSettings] = useState<any>(null);
  const [existingRegistration, setExistingRegistration] = useState<any>(null);
  const [loadingFields, setLoadingFields] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (event && user) {
      loadFieldDefinitions();
      loadExistingRegistration();
    }
  }, [event, user]);

  const loadFieldDefinitions = async () => {
    if (!event) return;
    
    setLoadingFields(true);
    try {
      const [fields, settings] = await Promise.all([
        getEventSwapRegistrationFields(event.id),
        getEventSwapRegistrationPageSettings(event.id),
      ]);
      
      setFieldDefinitions(fields.sort((a, b) => a.displayOrder - b.displayOrder));
      setPageSettings(settings);
      
      // Initialize form data with default values
      const initialData: Record<string, unknown> = {};
      fields.forEach((field) => {
        if (field.defaultValue) {
          initialData[field.name] = field.defaultValue;
        } else if (field.fieldType === 'boolean') {
          initialData[field.name] = false;
        } else if (field.fieldType === 'number' || field.fieldType === 'decimal') {
          initialData[field.name] = '';
        } else {
          initialData[field.name] = '';
        }
      });
      setFormData(initialData);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load registration form');
    } finally {
      setLoadingFields(false);
    }
  };

  const loadExistingRegistration = async () => {
    if (!event || !user) return;
    
    try {
      const registration = await getSellerSwapRegistration(user.id, event.id);
      if (registration) {
        setExistingRegistration(registration);
        // Merge existing data with form data
        setFormData((prev) => ({
          ...prev,
          ...registration.registrationData,
        }));
      }
    } catch (error) {
      console.error('Failed to load existing registration:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || !event) return;

    // Get required fields (that are not optional)
    const requiredFields = fieldDefinitions
      .filter((f) => f.isRequired && !f.isOptional)
      .map((f) => f.name);

    // Validate required fields
    for (const fieldName of requiredFields) {
      const value = formData[fieldName];
      if (value === undefined || value === null || value === '') {
        const field = fieldDefinitions.find((f) => f.name === fieldName);
        Alert.alert('Error', `Please fill in ${field?.label || fieldName}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Save swap registration
      await saveSellerSwapRegistration(
        user.id,
        event.id,
        formData,
        requiredFields
      );

      // Update seller profile with suggested field values
      const updateData: any = {};
      fieldDefinitions.forEach((field) => {
        if (field.isSuggestedField && field.suggestedFieldType) {
          const value = formData[field.name];
          
          switch (field.suggestedFieldType) {
            case 'profile_photo':
              if (value) updateData.profilePhotoUrl = String(value);
              break;
            case 'address':
              if (value) {
                // Parse address if it's a structured object, otherwise use as string
                if (typeof value === 'object') {
                  updateData.address = (value as any).line1;
                  updateData.addressLine2 = (value as any).line2;
                  updateData.city = (value as any).city;
                  updateData.state = (value as any).state;
                  updateData.zipCode = (value as any).zipCode;
                  updateData.country = (value as any).country || 'USA';
                } else {
                  updateData.address = String(value);
                }
              }
              break;
            case 'contact_info':
              if (value) updateData.contactInfo = typeof value === 'object' ? value : { info: value };
              break;
            case 'marketing_opt_in':
              updateData.marketingOptIn = Boolean(value);
              break;
          }
        }
      });

      if (Object.keys(updateData).length > 0) {
        await updateSeller(user.id, updateData);
      }

      Alert.alert(
        'Success',
        existingRegistration
          ? 'Registration updated successfully!'
          : 'Registration completed successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save registration');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: SwapRegistrationFieldDefinition) => {
    const value = formData[field.name];
    const isRequired = field.isRequired && !field.isOptional;

    switch (field.fieldType) {
      case 'text':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={String(value || '')}
              onChangeText={(text) => setFormData({ ...formData, [field.name]: text })}
              placeholder={field.placeholder || field.label}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'textarea':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={String(value || '')}
              onChangeText={(text) => setFormData({ ...formData, [field.name]: text })}
              placeholder={field.placeholder || field.label}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'number':
      case 'decimal':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={String(value || '')}
              onChangeText={(text) => {
                const num = field.fieldType === 'decimal' ? parseFloat(text) || 0 : parseInt(text) || 0;
                setFormData({ ...formData, [field.name]: text === '' ? '' : num });
              }}
              placeholder={field.placeholder || '0'}
              keyboardType="decimal-pad"
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'boolean':
        return (
          <View key={field.id} style={styles.field}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>
                  {field.label} {isRequired && <Text style={styles.required}>*</Text>}
                </Text>
                {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
              </View>
              <Switch
                value={Boolean(value)}
                onValueChange={(val) => setFormData({ ...formData, [field.name]: val })}
              />
            </View>
          </View>
        );

      case 'dropdown':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.dropdownOption,
                    value === option && styles.dropdownOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, [field.name]: option })}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      value === option && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'date':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={String(value || '')}
              onChangeText={(text) => setFormData({ ...formData, [field.name]: text })}
              placeholder={field.placeholder || 'YYYY-MM-DD'}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'time':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={String(value || '')}
              onChangeText={(text) => setFormData({ ...formData, [field.name]: text })}
              placeholder={field.placeholder || 'HH:MM'}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  if (eventLoading || loadingFields) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!event || !user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fieldDefinitions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoText}>No registration fields required for this event</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get fields organized by groups
  const getFieldsByGroup = () => {
    if (!pageSettings || !pageSettings.fieldGroups || pageSettings.fieldGroups.length === 0) {
      // No groups defined, return all fields in default group
      return {
        groups: [{ id: 'default', title: 'Registration Information', fields: fieldDefinitions }],
        unassigned: [],
      };
    }

    const groups = pageSettings.fieldGroups
      .sort((a: any, b: any) => a.order - b.order)
      .map((group: any) => ({
        ...group,
        fields: fieldDefinitions.filter((f) => group.fields.includes(f.name)),
      }));

    const assignedFields = new Set(
      pageSettings.fieldGroups.flatMap((g: any) => g.fields)
    );
    const unassigned = fieldDefinitions.filter((f) => !assignedFields.has(f.name));

    return { groups, unassigned };
  };

  const { groups, unassigned } = getFieldsByGroup();
  const pageTitle = pageSettings?.pageTitle || (existingRegistration ? 'Update Registration' : 'Register for Swap');
  const pageDescription = pageSettings?.pageDescription;
  const welcomeMessage = pageSettings?.welcomeMessage;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{pageTitle}</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
        {pageDescription && (
          <Text style={styles.description}>{pageDescription}</Text>
        )}
      </View>

      <View style={styles.form}>
        {welcomeMessage && (
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeText}>{welcomeMessage}</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {existingRegistration
              ? 'Update your registration information below. Optional fields can be skipped.'
              : 'Complete the registration form below. Fields marked with * are required, but you can skip optional fields.'}
          </Text>
        </View>

        {groups.map((group: any) => (
          <View key={group.id} style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.description && (
              <Text style={styles.groupDescription}>{group.description}</Text>
            )}
            {group.fields.map((field: SwapRegistrationFieldDefinition) => renderField(field))}
          </View>
        ))}

        {unassigned.length > 0 && (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Additional Information</Text>
            {unassigned.map((field: SwapRegistrationFieldDefinition) => renderField(field))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {existingRegistration ? 'Update Registration' : 'Complete Registration'}
            </Text>
          )}
        </TouchableOpacity>
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
    backgroundColor: '#F5F5F5',
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
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  welcomeBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#1976D2',
    lineHeight: 22,
  },
  fieldGroup: {
    marginBottom: 32,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  form: {
    padding: 20,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
  },
  field: {
    marginBottom: 24,
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
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: {
    minHeight: 100,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  dropdownScroll: {
    marginHorizontal: -4,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#666',
  },
  dropdownOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

