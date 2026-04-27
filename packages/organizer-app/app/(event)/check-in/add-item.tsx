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
  createItem,
  updateItemStatus,
  getEventFieldDefinitions,
  getEventItemCategoryTree,
  isUuidString,
  type ItemFieldDefinition,
  type ItemCategory,
} from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';

export default function CheckInAddItemScreen() {
  const { sellerId, eventId } = useLocalSearchParams<{ sellerId: string; eventId: string }>();
  const { event, loading: eventLoading } = useEvent(eventId);
  const router = useRouter();

  const [fieldDefinitions, setFieldDefinitions] = useState<ItemFieldDefinition[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  /** When true (default), item is moved to registered (`checked_in`) in one step; when false, stays pre-registered (`pending`). */
  const [registerAtCheckIn, setRegisterAtCheckIn] = useState(true);

  useEffect(() => {
    if (event) {
      loadFieldDefinitions();
      loadCategories();
    }
  }, [event]);

  const loadFieldDefinitions = async () => {
    if (!event) return;
    setLoadingFields(true);
    try {
      const fields = await getEventFieldDefinitions(event.id);
      setFieldDefinitions(fields.sort((a, b) => a.displayOrder - b.displayOrder));
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
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load form fields');
    } finally {
      setLoadingFields(false);
    }
  };

  const loadCategories = async () => {
    if (!event) return;
    try {
      const tree = await getEventItemCategoryTree(event.id);
      setCategories(tree);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSubmit = async () => {
    if (!sellerId || !event) return;

    for (const field of fieldDefinitions) {
      if (field.isRequired) {
        const value = formData[field.name];
        if (value === undefined || value === null || value === '') {
          Alert.alert('Error', `Please fill in ${field.label}`);
          return;
        }
      }
    }

    const priceField = fieldDefinitions.find((f) => f.isPriceField);
    const price = priceField ? parseFloat(String(formData[priceField.name] || '')) : null;
    if (priceField && (!price || price <= 0)) {
      Alert.alert('Error', `Please enter a valid ${priceField.label}`);
      return;
    }

    const priceReductionField = fieldDefinitions.find((f) => f.isPriceReductionField);
    if (priceReductionField && formData[priceReductionField.name]) {
      const reductionValue = parseFloat(String(formData[priceReductionField.name] || ''));
      if (priceReductionField.priceReductionPercentage) {
        if (reductionValue <= 0 || reductionValue >= 100) {
          Alert.alert('Error', 'Reduction percentage must be between 1 and 99');
          return;
        }
      } else {
        if (!reductionValue || reductionValue <= 0 || reductionValue >= (price || 0)) {
          Alert.alert('Error', 'Reduced price must be less than original price');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const customFields: Record<string, unknown> = {};
      const legacyData: Record<string, unknown> = {};

      const flattenCategories = (cats: ItemCategory[]): ItemCategory[] => {
        const result: ItemCategory[] = [];
        cats.forEach((cat) => {
          result.push(cat);
          if (cat.children) result.push(...flattenCategories(cat.children));
        });
        return result;
      };

      fieldDefinitions.forEach((field) => {
        const value = formData[field.name];
        if (field.name === 'category_id') {
          if (isUuidString(value)) legacyData.categoryId = value.trim();
          else if (value != null && String(value).trim() !== '') {
            legacyData.category = String(value).trim();
          }
        } else if (field.name === 'category') {
          if (isUuidString(value)) legacyData.categoryId = value.trim();
          else if (value != null && String(value).trim() !== '') {
            legacyData.category = String(value).trim();
          }
        } else if (field.isPriceField) {
          legacyData.originalPrice = parseFloat(String(value || 0));
        } else if (field.isPriceReductionField) {
          legacyData.reducedPrice = parseFloat(String(value || 0));
          legacyData.enablePriceReduction = !!value;
          if (field.priceReductionTimeControl === 'seller' && formData[`${field.name}_time`]) {
            const reductionTime = formData[`${field.name}_time`] as string;
            if (!legacyData.priceReductionTimes) {
              legacyData.priceReductionTimes = [];
            }
            (legacyData.priceReductionTimes as Array<{ time: string; price: number; isPercentage?: boolean }>).push({
              time: reductionTime,
              price: parseFloat(String(value || 0)),
              isPercentage: field.priceReductionPercentage,
            });
          } else if (event?.organization && !event.organization.priceReductionSettings.sellerCanSetTime) {
            const defaultTime = event.organization.priceReductionSettings.defaultReductionTime;
            if (defaultTime && value) {
              if (!legacyData.priceReductionTimes) {
                legacyData.priceReductionTimes = [];
              }
              (legacyData.priceReductionTimes as Array<{ time: string; price: number; isPercentage?: boolean }>).push({
                time: defaultTime,
                price: parseFloat(String(value || 0)),
                isPercentage: field.priceReductionPercentage,
              });
            }
          }
        } else {
          customFields[field.name] = value;
        }
      });

      if (legacyData.categoryId && !legacyData.category) {
        const match = flattenCategories(categories).find((c) => c.id === legacyData.categoryId);
        if (match) legacyData.category = match.name;
      }

      const created = await createItem(sellerId, event.id, {
        ...legacyData,
        customFields: customFields as Record<string, unknown>,
      });

      if (registerAtCheckIn) {
        await updateItemStatus(created.id, 'checked_in', { checkedInAt: new Date() });
      }

      const successBody = registerAtCheckIn
        ? 'The item is registered at check-in. You can print a label from item details if needed.'
        : 'The item is saved as pre-registered. Open it from the seller list when they hand in the gear to register it.';

      Alert.alert('Success', successBody, [
        {
          text: 'Add Another',
          onPress: () => {
            const initialData: Record<string, unknown> = {};
            fieldDefinitions.forEach((field) => {
              if (field.defaultValue) initialData[field.name] = field.defaultValue;
              else if (field.fieldType === 'boolean') initialData[field.name] = false;
              else initialData[field.name] = '';
            });
            setFormData(initialData);
          },
        },
        { text: 'Back to seller', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: ItemFieldDefinition) => {
    const value = formData[field.name];
    const isRequired = field.isRequired;

    if (field.isPriceReductionField && event?.organization) {
      const priceSettings = event.organization.priceReductionSettings;
      if (!priceSettings.sellerCanSetReduction) return null;
    }

    switch (field.fieldType) {
      case 'text':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
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
            <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
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
            <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
            <View style={styles.priceInputContainer}>
              {field.isPriceField && <Text style={styles.currencySymbol}>$</Text>}
              <TextInput
                style={styles.priceInput}
                value={String(value || '')}
                onChangeText={(text) => {
                  const num = field.fieldType === 'decimal' ? parseFloat(text) || 0 : parseInt(text, 10) || 0;
                  setFormData({ ...formData, [field.name]: text === '' ? '' : num });
                }}
                placeholder={field.placeholder || '0'}
                keyboardType="decimal-pad"
              />
            </View>
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );
      case 'boolean':
        return (
          <View key={field.id} style={styles.field}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
                {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
              </View>
              <Switch
                value={Boolean(value)}
                onValueChange={(val) => setFormData({ ...formData, [field.name]: val })}
                trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
                thumbColor={Boolean(value) ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
        );
      case 'dropdown':
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
              {(field.options || []).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.dropdownOption, value === option && styles.dropdownOptionSelected]}
                  onPress={() => setFormData({ ...formData, [field.name]: option })}
                >
                  <Text style={[styles.dropdownOptionText, value === option && styles.dropdownOptionTextSelected]}>
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
            <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
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
        if (field.isPriceReductionField && event?.organization) {
          const priceSettings = event.organization.priceReductionSettings;
          if (!priceSettings.sellerCanSetTime) {
            return (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>
                    {priceSettings.defaultReductionTime || 'Set by organization'}
                  </Text>
                </View>
                <Text style={styles.helpText}>Price reduction time is controlled by the organization</Text>
              </View>
            );
          }
          if (priceSettings.allowedReductionTimes && priceSettings.allowedReductionTimes.length > 0) {
            return (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
                  {priceSettings.allowedReductionTimes.map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[styles.dropdownOption, value === time && styles.dropdownOptionSelected]}
                      onPress={() => setFormData({ ...formData, [field.name]: time })}
                    >
                      <Text style={[styles.dropdownOptionText, value === time && styles.dropdownOptionTextSelected]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
              </View>
            );
          }
        }
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>{field.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
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

  const renderCategoryField = () => {
    const categoryField = fieldDefinitions.find((f) => f.name === 'category' || f.name === 'category_id');
    if (!categoryField || categories.length === 0) return null;
    const flattenCategories = (cats: ItemCategory[]): ItemCategory[] => {
      const result: ItemCategory[] = [];
      cats.forEach((cat) => {
        result.push(cat);
        if (cat.children) result.push(...flattenCategories(cat.children));
      });
      return result;
    };
    const flatCategories = flattenCategories(categories);
    const value = formData[categoryField.name];
    const isRequired = categoryField.isRequired;
    return (
      <View key={categoryField.id} style={styles.field}>
        <Text style={styles.label}>{categoryField.label} {isRequired && <Text style={styles.required}>*</Text>}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {flatCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryChip, value === category.id && styles.categoryChipSelected]}
              onPress={() => setFormData({ ...formData, [categoryField.name]: category.id })}
            >
              <Text style={[styles.categoryChipText, value === category.id && styles.categoryChipTextSelected]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {categoryField.helpText && <Text style={styles.helpText}>{categoryField.helpText}</Text>}
      </View>
    );
  };

  if (eventLoading || loadingFields) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!event || !sellerId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Event or seller not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Item (Check-In)</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
      </View>
      <View style={styles.form}>
        {renderCategoryField()}
        {fieldDefinitions
          .filter((f) => f.name !== 'category' && f.name !== 'category_id')
          .map((field) => renderField(field))}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Turn off &quot;Register at check-in&quot; only if the seller is entering details now but dropping off gear later
            (saves as pre-registered).
          </Text>
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.label}>Register at check-in</Text>
            <Text style={styles.helpText}>
              On: create + register in one step. Off: pre-register only; register when they hand in the item.
            </Text>
          </View>
          <Switch
            value={registerAtCheckIn}
            onValueChange={setRegisterAtCheckIn}
            trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
            thumbColor={registerAtCheckIn ? '#FFFFFF' : '#F4F3F4'}
          />
        </View>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>{registerAtCheckIn ? 'Add & register item' : 'Add item (pre-register)'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  loadingText: { marginTop: 10, color: '#666' },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666' },
  form: { padding: 20 },
  field: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  required: { color: '#DC3545' },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: { minHeight: 100 },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingLeft: 12,
  },
  currencySymbol: { fontSize: 18, fontWeight: '600', color: '#666', marginRight: 4 },
  priceInput: { flex: 1, padding: 12, fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabelContainer: { flex: 1, marginRight: 12 },
  categoryScroll: { marginHorizontal: -4 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  categoryChipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  categoryChipText: { fontSize: 14, color: '#666' },
  categoryChipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  dropdownScroll: { marginHorizontal: -4 },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  dropdownOptionSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  dropdownOptionText: { fontSize: 14, color: '#666' },
  dropdownOptionTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  helpText: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  readOnlyText: { fontSize: 16, color: '#666', fontStyle: 'italic' },
  infoBox: { backgroundColor: '#E3F2FD', borderRadius: 8, padding: 12, marginBottom: 24 },
  infoText: { fontSize: 14, color: '#1976D2' },
  submitButton: { backgroundColor: '#007AFF', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  errorText: { fontSize: 18, fontWeight: '600', color: '#DC3545', marginBottom: 20 },
  backButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
