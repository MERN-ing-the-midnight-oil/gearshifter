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
  createItem,
  getItem,
  getCurrentSeller,
  updateItem,
  getEventFieldDefinitions,
  getEventItemCategoryTree,
  getSellerSwapRegistration,
  filterItemCategoriesBySellerPlan,
  PLANNED_ITEM_CATEGORY_IDS_KEY,
  isUuidString,
  type ItemFieldDefinition,
  type ItemCategory,
  type Item,
} from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';

export default function AddItemScreen() {
  const params = useLocalSearchParams<{ id: string; itemId?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const itemIdParam = typeof params.itemId === 'string' ? params.itemId : undefined;

  const { event, loading: eventLoading } = useEvent(id);
  const { user } = useAuth();
  const router = useRouter();

  const [fieldDefinitions, setFieldDefinitions] = useState<ItemFieldDefinition[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [sellerListingName, setSellerListingName] = useState('');
  const [sellerPrice, setSellerPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    prefillAppliedRef.current = false;
  }, [itemIdParam]);

  useEffect(() => {
    if (!id) {
      setLoadingFields(false);
      return;
    }
    if (!event) {
      if (!eventLoading) {
        setLoadingFields(false);
      }
      return;
    }
    loadFieldDefinitions();
    loadCategories();
  }, [id, event, eventLoading, user?.id]);

  useEffect(() => {
    if (!itemIdParam) {
      setEditingItem(null);
      setLoadingItem(false);
      return;
    }
    if (!event || !user?.id) {
      return;
    }
    let cancelled = false;
    setLoadingItem(true);
    (async () => {
      try {
        const [item, seller] = await Promise.all([getItem(itemIdParam), getCurrentSeller(user.id)]);
        if (cancelled) return;
        if (!item || !seller) {
          Alert.alert('Error', 'Item not found');
          router.back();
          return;
        }
        if (item.eventId !== event.id) {
          Alert.alert('Error', 'This item belongs to another event');
          router.back();
          return;
        }
        if (item.sellerId !== seller.id) {
          Alert.alert('Error', 'You can only edit your own items');
          router.back();
          return;
        }
        if (item.status !== 'pending') {
          Alert.alert(
            'Cannot edit',
            'You can only change items that are still pre-registered (before staff check-in).'
          );
          router.back();
          return;
        }
        setEditingItem(item);
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load item');
          router.back();
        }
      } finally {
        if (!cancelled) setLoadingItem(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemIdParam, event?.id, user?.id]);

  useEffect(() => {
    if (!editingItem || fieldDefinitions.length === 0 || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    setSellerListingName(editingItem.sellerItemLabel ?? '');
    const op = editingItem.originalPrice;
    setSellerPrice(op != null && !Number.isNaN(Number(op)) ? String(Number(op)) : '');
    setFormData((prev) => {
      const next = { ...prev };
      const cf = editingItem.customFields || {};
      Object.keys(cf).forEach((k) => {
        next[k] = cf[k];
      });
      const catField = fieldDefinitions.find((f) => f.name === 'category' || f.name === 'category_id');
      if (catField && editingItem.categoryId) {
        next[catField.name] = editingItem.categoryId;
      }
      fieldDefinitions.forEach((f) => {
        if (f.name === 'description' && editingItem.description) {
          next[f.name] = editingItem.description;
        }
      });
      if (editingItem.donateIfUnsold !== undefined) {
        const donateField = fieldDefinitions.find((x) => x.name === 'donate_if_unsold' || x.name === 'donateIfUnsold');
        if (donateField) next[donateField.name] = editingItem.donateIfUnsold;
      }
      return next;
    });
  }, [editingItem, fieldDefinitions]);

  const loadFieldDefinitions = async () => {
    if (!event) return;
    
    setLoadingFields(true);
    try {
      const fields = await getEventFieldDefinitions(event.id);
      setFieldDefinitions(fields.sort((a, b) => a.displayOrder - b.displayOrder));
      
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
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load form fields');
    } finally {
      setLoadingFields(false);
    }
  };

  const loadCategories = async () => {
    if (!event) return;

    try {
      let tree = await getEventItemCategoryTree(event.id);
      if (user?.id) {
        const seller = await getCurrentSeller(user.id);
        if (seller) {
          const reg = await getSellerSwapRegistration(seller.id, event.id);
          const raw = reg?.registrationData?.[PLANNED_ITEM_CATEGORY_IDS_KEY];
          if (Array.isArray(raw) && raw.length > 0) {
            const planned = new Set(raw.filter((x): x is string => typeof x === 'string'));
            tree = filterItemCategoriesBySellerPlan(tree, planned);
          }
        }
      }
      setCategories(tree);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || !event) return;

    const basePrice = parseFloat(String(sellerPrice || '').replace(/,/g, ''));

    // Validate required fields (price lives in sellerPrice, not formData — see filtered isPriceField)
    for (const field of fieldDefinitions) {
      if (!field.isRequired) continue;
      if (field.isPriceField) {
        if (!String(sellerPrice || '').trim() || Number.isNaN(basePrice) || basePrice <= 0) {
          Alert.alert('Error', `Please fill in ${field.label}`);
          return;
        }
        continue;
      }
      const value = formData[field.name];
      if (value === undefined || value === null || value === '') {
        Alert.alert('Error', `Please fill in ${field.label}`);
        return;
      }
    }

    if (!String(sellerPrice || '').trim() || Number.isNaN(basePrice) || basePrice <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    // Validate price reduction if enabled
    const priceReductionField = fieldDefinitions.find((f) => f.isPriceReductionField);
    if (priceReductionField && formData[priceReductionField.name]) {
      const reductionValue = parseFloat(String(formData[priceReductionField.name] || ''));
      if (priceReductionField.priceReductionPercentage) {
        if (reductionValue <= 0 || reductionValue >= 100) {
          Alert.alert('Error', 'Reduction percentage must be between 1 and 99');
          return;
        }
      } else {
        if (!reductionValue || reductionValue <= 0 || reductionValue >= basePrice) {
          Alert.alert('Error', 'Reduced price must be less than original price');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Build custom fields object (exclude special fields that go to legacy columns)
      const customFields: Record<string, unknown> = {};
      const legacyData: any = {};

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

        // Never send free-text category values into category_id (UUID) — PostgREST returns 400.
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
          legacyData.originalPrice = basePrice;
        } else if (field.isPriceReductionField) {
          legacyData.reducedPrice = parseFloat(String(value || 0));
          legacyData.enablePriceReduction = !!value;
          
          // Handle price reduction time
          if (field.priceReductionTimeControl === 'seller' && formData[`${field.name}_time`]) {
            // Seller set the time
            const reductionTime = formData[`${field.name}_time`] as string;
            // Store in price_reduction_times array
            if (!legacyData.priceReductionTimes) {
              legacyData.priceReductionTimes = [];
            }
            legacyData.priceReductionTimes.push({
              time: reductionTime,
              price: parseFloat(String(value || 0)),
              isPercentage: field.priceReductionPercentage,
            });
          } else if (event?.organization && !event.organization.priceReductionSettings.sellerCanSetTime) {
            // Org controls time - use default time
            const defaultTime = event.organization.priceReductionSettings.defaultReductionTime;
            if (defaultTime && value) {
              if (!legacyData.priceReductionTimes) {
                legacyData.priceReductionTimes = [];
              }
              legacyData.priceReductionTimes.push({
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

      legacyData.originalPrice = basePrice;

      if (legacyData.categoryId && !legacyData.category) {
        const match = flattenCategories(categories).find((c) => c.id === legacyData.categoryId);
        if (match) legacyData.category = match.name;
      }

      if (editingItem) {
        const seller = await getCurrentSeller(user.id);
        if (!seller) {
          throw new Error('Seller profile not found');
        }
        await updateItem(editingItem.id, seller.id, {
          ...legacyData,
          customFields,
          sellerItemLabel: sellerListingName.trim() || null,
        });
        // Use `/` + query, not `/(tabs)/index`: on web the public path is `/` (groups/index are stripped); `/(tabs)/index` is an unmatched URL.
        router.replace(`/?eventId=${encodeURIComponent(event.id)}`);
        return;
      }

      const createdItem = await createItem(user.id, event.id, {
        ...legacyData,
        customFields,
        sellerItemLabel: sellerListingName.trim() || undefined,
      });

      console.log('[add-item] Item created:', {
        id: createdItem.id,
        eventId: createdItem.eventId,
        sellerId: createdItem.sellerId,
        itemNumber: createdItem.itemNumber,
        sellerItemLabel: createdItem.sellerItemLabel,
        status: createdItem.status,
        categoryId: createdItem.categoryId,
        category: createdItem.category,
        description: createdItem.description,
        originalPrice: createdItem.originalPrice,
        reducedPrice: createdItem.reducedPrice,
        enablePriceReduction: createdItem.enablePriceReduction,
        donateIfUnsold: createdItem.donateIfUnsold,
        customFields: createdItem.customFields,
        qrCode: createdItem.qrCode,
        createdAt: createdItem.createdAt?.toISOString?.() ?? createdItem.createdAt,
      });

      router.replace(`/?eventId=${encodeURIComponent(event.id)}`);
    } catch (error) {
      console.error('[add-item] submit failed', {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: ItemFieldDefinition) => {
    const value = formData[field.name];
    const isRequired = field.isRequired;
    
    // Check if field should be shown based on org price reduction settings
    if (field.isPriceReductionField && event?.organization) {
      const priceSettings = event.organization.priceReductionSettings;
      if (!priceSettings.sellerCanSetReduction) {
        // Seller can't set price reductions - hide this field
        return null;
      }
    }

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
            <View style={styles.priceInputContainer}>
              {field.isPriceField && <Text style={styles.currencySymbol}>$</Text>}
              <TextInput
                style={styles.priceInput}
                value={String(value || '')}
                onChangeText={(text) => {
                  const num = field.fieldType === 'decimal' ? parseFloat(text) || 0 : parseInt(text) || 0;
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
        // For price reduction time fields, check org settings
        if (field.isPriceReductionField && event?.organization) {
          const priceSettings = event.organization.priceReductionSettings;
          if (!priceSettings.sellerCanSetTime) {
            // Seller can't set time - show read-only with org's default time
            return (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>
                  {field.label} {isRequired && <Text style={styles.required}>*</Text>}
                </Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>
                    {priceSettings.defaultReductionTime || 'Set by organization'}
                  </Text>
                </View>
                <Text style={styles.helpText}>
                  Price reduction time is controlled by the organization
                </Text>
              </View>
            );
          }
          
          // Seller can set time - show dropdown if allowed times are specified
          if (priceSettings.allowedReductionTimes && priceSettings.allowedReductionTimes.length > 0) {
            return (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>
                  {field.label} {isRequired && <Text style={styles.required}>*</Text>}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
                  {priceSettings.allowedReductionTimes.map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.dropdownOption,
                        value === time && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, [field.name]: time })}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          value === time && styles.dropdownOptionTextSelected,
                        ]}
                      >
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

  const renderCategoryField = () => {
    const categoryField = fieldDefinitions.find((f) => f.name === 'category' || f.name === 'category_id');
    if (!categoryField || categories.length === 0) return null;

    const value = formData[categoryField.name];
    const isRequired = categoryField.isRequired;

    // Flatten categories for display
    const flattenCategories = (cats: ItemCategory[]): ItemCategory[] => {
      const result: ItemCategory[] = [];
      cats.forEach((cat) => {
        result.push(cat);
        if (cat.children) {
          result.push(...flattenCategories(cat.children));
        }
      });
      return result;
    };

    const flatCategories = flattenCategories(categories);

    return (
      <View key={categoryField.id} style={styles.field}>
        <Text style={styles.label}>
          {categoryField.label} {isRequired && <Text style={styles.required}>*</Text>}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {flatCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                value === category.id && styles.categoryChipSelected,
              ]}
              onPress={() => setFormData({ ...formData, [categoryField.name]: category.id })}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  value === category.id && styles.categoryChipTextSelected,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {categoryField.helpText && <Text style={styles.helpText}>{categoryField.helpText}</Text>}
      </View>
    );
  };

  if (eventLoading || loadingFields || (itemIdParam && loadingItem)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{itemIdParam ? 'Loading item…' : 'Loading...'}</Text>
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

  if (!user) {
    const redirectPath =
      itemIdParam && id
        ? `/event/${id}/add-item?itemId=${encodeURIComponent(itemIdParam)}`
        : `/event/${id}/add-item`;
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.signInTitle}>Sign in to list items</Text>
        <Text style={styles.signInSubtitle}>You need a seller account to pre-register items for {event.name}.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { redirect: redirectPath } })}
        >
          <Text style={styles.backButtonText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.backButton, styles.secondaryOutline]}
          onPress={() => router.push({ pathname: '/(auth)/signup', params: { redirect: redirectPath } })}
        >
          <Text style={styles.secondaryOutlineText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textLink} onPress={() => router.back()}>
          <Text style={styles.textLinkLabel}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{editingItem ? 'Edit item' : 'Pre-register item'}</Text>
        <Text style={styles.subtitle}>{event.name}</Text>
        {editingItem ? (
          <Text style={styles.editHint}>
            Tag #{editingItem.itemNumber} · You can change details until you hand this item in at the event.
          </Text>
        ) : null}
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Item name (your dashboard)</Text>
          <TextInput
            style={styles.textInput}
            value={sellerListingName}
            onChangeText={setSellerListingName}
            placeholder="e.g. Blue Burton snowboard"
          />
          <Text style={styles.helpText}>
            This name is only for you in the app. It is not printed on the physical tag.
          </Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>
            Your price <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={sellerPrice}
              onChangeText={setSellerPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.helpText}>The price you are asking for this item at the swap.</Text>
        </View>

        {renderCategoryField()}
        {fieldDefinitions
          .filter(
            (f) =>
              f.name !== 'category' &&
              f.name !== 'category_id' &&
              !f.isPriceField
          )
          .map((field) => renderField(field))}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 This pre-registers your item; staff will confirm it at check-in. Make sure all information is accurate.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>{editingItem ? 'Save changes' : 'Pre-register'}</Text>
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
  editHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    lineHeight: 20,
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
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingLeft: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
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
  categoryScroll: {
    marginHorizontal: -4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  signInTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  signInSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  secondaryOutline: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryOutlineText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textLink: {
    marginTop: 20,
    paddingVertical: 8,
  },
  textLinkLabel: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
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
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
});
