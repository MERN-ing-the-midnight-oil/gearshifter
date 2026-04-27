import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import {
  useEvent,
  useAuth,
  getCurrentSeller,
  getEventSwapRegistrationFields,
  getEventSwapRegistrationPageSettings,
  getSellerSwapRegistration,
  saveSellerSwapRegistration,
  updateSeller,
  isSellerSwapRegistrationWindowOpen,
  getEventItemCategoryTree,
  flattenItemCategoriesForPicker,
  PLANNED_ITEM_CATEGORY_IDS_KEY,
  type Seller,
  type SellerSwapRegistration,
  type SwapRegistrationPageSettings,
  type FieldGroup,
  type SwapRegistrationFieldDefinition,
} from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';

function resolveEventRouteId(raw: string | string[] | undefined): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim();
  return null;
}

/** Page settings group with field definitions resolved (differs from `FieldGroup.fields` which is name keys only). */
type FieldGroupWithDefinitions = Omit<FieldGroup, 'fields'> & {
  fields: SwapRegistrationFieldDefinition[];
};

export default function SwapRegistrationScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = resolveEventRouteId(idParam);
  const { event, loading: eventLoading } = useEvent(eventId);
  const { user } = useAuth();
  const router = useRouter();
  
  const [fieldDefinitions, setFieldDefinitions] = useState<SwapRegistrationFieldDefinition[]>([]);
  const [pageSettings, setPageSettings] = useState<SwapRegistrationPageSettings | null>(null);
  const [existingRegistration, setExistingRegistration] = useState<SellerSwapRegistration | null>(null);
  const [loadingFields, setLoadingFields] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [itemCategoryOptions, setItemCategoryOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedItemCategoryIds, setSelectedItemCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setSeller(null);
      setSellerLoading(false);
      return;
    }
    let cancelled = false;
    setSellerLoading(true);
    getCurrentSeller(user.id)
      .then((row) => {
        if (!cancelled) setSeller(row ?? null);
      })
      .catch((err) => {
        console.error('Failed to load seller profile:', err);
        if (!cancelled) setSeller(null);
      })
      .finally(() => {
        if (!cancelled) setSellerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!eventId) {
      setLoadingFields(false);
      return;
    }
    if (!event) {
      if (!eventLoading) {
        setLoadingFields(false);
      }
      return;
    }
    if (!user) {
      setLoadingFields(false);
      return;
    }
    if (sellerLoading) {
      return;
    }
    if (!seller) {
      setLoadingFields(false);
      return;
    }

    let cancelled = false;

    const loadRegistrationForm = async () => {
      setLoadingFields(true);
      try {
        const [fields, settings, registration, itemCatTree] = await Promise.all([
          getEventSwapRegistrationFields(event.id),
          getEventSwapRegistrationPageSettings(event.id),
          getSellerSwapRegistration(seller.id, event.id),
          getEventItemCategoryTree(event.id),
        ]);
        if (cancelled) return;

        const sorted = [...fields].sort((a, b) => a.displayOrder - b.displayOrder);
        setFieldDefinitions(sorted);
        setPageSettings(settings);
        setExistingRegistration(registration);
        setItemCategoryOptions(flattenItemCategoriesForPicker(itemCatTree));

        const initialData: Record<string, unknown> = {};
        sorted.forEach((field) => {
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
        const regData = (registration?.registrationData ?? {}) as Record<string, unknown>;
        const rawPlan = regData[PLANNED_ITEM_CATEGORY_IDS_KEY];
        const planned = Array.isArray(rawPlan)
          ? rawPlan.filter((x): x is string => typeof x === 'string')
          : [];
        setSelectedItemCategoryIds(planned);
        const swapFieldValues = { ...regData };
        delete swapFieldValues[PLANNED_ITEM_CATEGORY_IDS_KEY];
        Object.assign(initialData, swapFieldValues);
        setFormData(initialData);
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load registration form');
        }
      } finally {
        if (!cancelled) {
          setLoadingFields(false);
        }
      }
    };

    loadRegistrationForm();
    return () => {
      cancelled = true;
    };
  }, [eventId, event, user, eventLoading, seller, sellerLoading]);

  const handleSubmit = async () => {
    if (!user || !event || !seller) return;
    if (event.archivedAt) {
      Alert.alert('Unavailable', 'This event is archived and registration cannot be changed.');
      return;
    }
    if (!isSellerSwapRegistrationWindowOpen(event) && !existingRegistration) {
      Alert.alert('Registration closed', 'The registration period for this event is over.');
      return;
    }

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

    if (itemCategoryOptions.length > 0 && selectedItemCategoryIds.length === 0) {
      Alert.alert('Item types', 'Select at least one item type you may bring to this swap.');
      return;
    }

    setSubmitting(true);
    try {
      const registrationPayload = {
        ...formData,
        [PLANNED_ITEM_CATEGORY_IDS_KEY]: selectedItemCategoryIds,
      };
      await saveSellerSwapRegistration(seller.id, event.id, registrationPayload, requiredFields);

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
        await updateSeller(seller.id, updateData);
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

  if (eventLoading || loadingFields || (Boolean(user) && sellerLoading)) {
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

  if (event.archivedAt) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoTitle}>Event archived</Text>
        <Text style={[styles.infoText, styles.signInExplainer]}>
          This swap is no longer active. Registration and updates are not available.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoTitle}>Sign in to register</Text>
        <Text style={[styles.infoText, styles.signInExplainer]}>
          You need a seller account to complete registration for {event.name}.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: '/(auth)/login',
              params: { redirect: `/event/${event.id}/register` },
            })
          }
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            router.push({
              pathname: '/(auth)/signup',
              params: { redirect: `/event/${event.id}/register` },
            })
          }
        >
          <Text style={styles.secondaryButtonText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backButton, styles.backButtonMuted]} onPress={() => router.back()}>
          <Text style={styles.backButtonMutedText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (user && !sellerLoading && !seller) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoTitle}>Seller profile not found</Text>
        <Text style={[styles.infoText, styles.signInExplainer]}>
          Your account is signed in, but there is no seller profile linked to it yet. Finish signing up as a
          seller, or sign in with a seller account, then try again.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: '/(auth)/signup',
              params: { redirect: `/event/${event.id}/register` },
            })
          }
        >
          <Text style={styles.primaryButtonText}>Create seller account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backButton, styles.backButtonMuted]} onPress={() => router.back()}>
          <Text style={styles.backButtonMutedText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const registrationWindowOpen = isSellerSwapRegistrationWindowOpen(event);
  if (!loadingFields && !registrationWindowOpen && !existingRegistration) {
    const now = new Date();
    const open = event.registrationOpenDate ? new Date(event.registrationOpenDate) : null;
    const close = event.registrationCloseDate ? new Date(event.registrationCloseDate) : null;
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
    const reason =
      open && now < open
        ? `Registration opens on ${fmt(open)}.`
        : close && now > close
          ? `Registration closed on ${fmt(close)}.`
          : (event.status as string) !== 'registration'
            ? 'This event is not in the registration phase right now.'
            : 'Registration is not open for this event right now.';

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoTitle}>Registration is not open</Text>
        <Text style={[styles.infoText, styles.signInExplainer]}>
          {reason} Check the event page for dates and status, or contact the organizer if you need help.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(`/event/${event.id}`)}>
          <Text style={styles.primaryButtonText}>View event</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backButton, styles.backButtonMuted]} onPress={() => router.back()}>
          <Text style={styles.backButtonMutedText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fieldDefinitions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoTitle}>Registration form not set up yet</Text>
        <Text style={[styles.infoText, styles.signInExplainer]}>
          This event’s organization has not defined any swap registration questions yet. In the organizer app,
          sign in as an org admin and open Swap registration fields to add at least one field (for example a
          short text question), then reload this page.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get fields organized by groups
  const getFieldsByGroup = () => {
    if (!pageSettings || !pageSettings.fieldGroups || pageSettings.fieldGroups.length === 0) {
      const defaultGroup: FieldGroupWithDefinitions = {
        id: 'default',
        title: 'Registration Information',
        order: 0,
        fields: fieldDefinitions,
      };
      return { groups: [defaultGroup], unassigned: [] };
    }

    const groups: FieldGroupWithDefinitions[] = pageSettings.fieldGroups
      .sort((a: FieldGroup, b: FieldGroup) => a.order - b.order)
      .map((group: FieldGroup) => ({
        ...group,
        fields: fieldDefinitions.filter((f) => group.fields.includes(f.name)),
      }));

    const assignedFields = new Set(pageSettings.fieldGroups.flatMap((g: FieldGroup) => g.fields));
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

        {!registrationWindowOpen && existingRegistration && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Registration is closed to new sellers, but you can still update the answers you already submitted.
            </Text>
          </View>
        )}

        {itemCategoryOptions.length > 0 && (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Item types</Text>
            <Text style={styles.groupDescription}>
              Choose the categories you plan to list. When you pre-register items, only these types will be offered
              (within what the organizer allows for this event).
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
              {itemCategoryOptions.map((opt) => {
                const selected = selectedItemCategoryIds.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                    onPress={() => {
                      setSelectedItemCategoryIds((prev) =>
                        prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selected && styles.dropdownOptionTextSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.helpText}>Select one or more. You can change this later while registration stays open.</Text>
          </View>
        )}

        {groups.map((group) => (
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
  noticeBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  noticeText: {
    fontSize: 14,
    color: '#6D4C41',
    lineHeight: 20,
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
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  signInExplainer: {
    marginBottom: 20,
    textAlign: 'center',
    color: '#444',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
    maxWidth: 320,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
    maxWidth: 320,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
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
  backButtonMuted: {
    marginTop: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C5C5C5',
  },
  backButtonMutedText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

