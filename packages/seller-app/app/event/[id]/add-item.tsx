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
  Modal,
} from 'react-native';
import {
  useEvent,
  useAuth,
  createItem,
  getItem,
  getCurrentSeller,
  updateItem,
  getEventFieldDefinitions,
  getItemFieldDefinitionsForCategory,
  getEventItemCategoryTree,
  getCategory,
  flattenItemCategoriesForPicker,
  resolveGearTagTemplateForCategory,
  getDefaultGearTagTemplate,
  isUuidString,
  resolveTagFieldDataType,
  tagFieldDropdownOptions,
  type ItemFieldDefinition,
  type ItemCategory,
  type Item,
  type GearTagTemplate,
  type TagField,
} from 'shared';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useMemo } from 'react';
import { setSellerDashboardEventId } from '../../../lib/sellerDashboardEventStorage';

type TagFieldMeta = { name: string; label: string; defaultLabel?: string };

function skipStandaloneTagField(fieldKey: string): boolean {
  return (
    fieldKey === 'original_price' ||
    fieldKey === 'category' ||
    fieldKey === 'category_id' ||
    fieldKey === 'item_number'
  );
}

/** Built-in tag field keys (aligned with organizer gear tag editor). */
const GEAR_TAG_BUILTIN_META: TagFieldMeta[] = [
  { name: 'item_number', label: 'Item Number', defaultLabel: 'Item #' },
  { name: 'category', label: 'Category' },
  { name: 'description', label: 'Description' },
  { name: 'size', label: 'Size' },
  { name: 'original_price', label: 'Original Price', defaultLabel: 'Price' },
  { name: 'reduced_price', label: 'Reduced Price' },
  { name: 'price_reduction_time', label: 'Price Reduction Time', defaultLabel: 'Reduces At' },
  { name: 'price_reduction_times', label: 'Price Reduction Schedule', defaultLabel: 'Price Schedule' },
  { name: 'current_price', label: 'Current Price', defaultLabel: 'Current' },
  { name: 'seller_name', label: 'Seller Name' },
  { name: 'donate_if_unsold', label: 'Donate if Unsold' },
];

export default function AddItemScreen() {
  const params = useLocalSearchParams<{ id: string; itemId?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const itemIdParam = typeof params.itemId === 'string' ? params.itemId : undefined;

  const { event, loading: eventLoading } = useEvent(id);
  const { user } = useAuth();
  const router = useRouter();

  const [fieldDefinitions, setFieldDefinitions] = useState<ItemFieldDefinition[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [sellerListingName, setSellerListingName] = useState('');
  const [sellerPrice, setSellerPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [gearTemplate, setGearTemplate] = useState<GearTagTemplate | null>(null);
  const [itemTypesTree, setItemTypesTree] = useState<ItemCategory[]>([]);
  const [loadingItemTypes, setLoadingItemTypes] = useState(true);
  const [itemTypeId, setItemTypeId] = useState<string | null>(null);
  const [itemTypeMenuVisible, setItemTypeMenuVisible] = useState(false);
  const prefillAppliedRef = useRef(false);

  const itemTypeOptions = useMemo(() => flattenItemCategoriesForPicker(itemTypesTree), [itemTypesTree]);

  const effectiveItemTypeId = useMemo(
    () => (itemIdParam ? editingItem?.categoryId ?? undefined : itemTypeId ?? undefined),
    [itemIdParam, editingItem?.categoryId, itemTypeId]
  );

  const selectedItemTypeLabel = useMemo(() => {
    if (!effectiveItemTypeId) return '';
    return itemTypeOptions.find((o) => o.id === effectiveItemTypeId)?.label ?? '';
  }, [effectiveItemTypeId, itemTypeOptions]);

  const availableTagFieldMeta: TagFieldMeta[] = useMemo(() => {
    const out: TagFieldMeta[] = [...GEAR_TAG_BUILTIN_META];
    const seen = new Set(out.map((x) => x.name));
    fieldDefinitions.forEach((f) => {
      if (!seen.has(f.name)) {
        seen.add(f.name);
        out.push({ name: f.name, label: f.label });
      }
    });
    return out;
  }, [fieldDefinitions]);

  useEffect(() => {
    prefillAppliedRef.current = false;
  }, [itemIdParam]);

  useEffect(() => {
    if (!event?.id || !user?.id) {
      setLoadingItemTypes(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingItemTypes(true);
      try {
        const tree = await getEventItemCategoryTree(event.id);
        if (!cancelled) setItemTypesTree(tree);
      } catch (err) {
        console.error('Failed to load item types:', err);
        if (!cancelled) setItemTypesTree([]);
      } finally {
        if (!cancelled) setLoadingItemTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.id, user?.id]);

  useEffect(() => {
    if (itemIdParam || itemTypeOptions.length !== 1 || itemTypeId) return;
    setItemTypeId(itemTypeOptions[0].id);
  }, [itemIdParam, itemTypeOptions, itemTypeId]);

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

  useEffect(() => {
    if (!event?.id) return;
    if (itemIdParam && !editingItem) return;

    let cancelled = false;

    const run = async () => {
      const cid = itemIdParam ? editingItem?.categoryId : itemTypeId ?? undefined;

      if (!cid) {
        if (!itemIdParam) {
          if (!cancelled) {
            setFieldDefinitions([]);
            setLoadingFields(false);
          }
        } else if (editingItem && !editingItem.categoryId) {
          setLoadingFields(true);
          try {
            const orgFields = await getEventFieldDefinitions(event.id);
            const fields = orgFields
              .filter((f) => !f.categoryId)
              .sort((a, b) => a.displayOrder - b.displayOrder);
            if (!cancelled) setFieldDefinitions(fields);
          } catch (error) {
            if (!cancelled) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load form fields');
            }
          } finally {
            if (!cancelled) setLoadingFields(false);
          }
        }
        return;
      }

      setLoadingFields(true);
      try {
        const orgFields = await getEventFieldDefinitions(event.id);
        const scoped = orgFields.filter((f) => !f.categoryId || f.categoryId === cid);
        const catFields = await getItemFieldDefinitionsForCategory(cid);
        if (cancelled) return;
        const byName = new Map<string, ItemFieldDefinition>();
        scoped.forEach((f) => byName.set(f.name, f));
        catFields.forEach((f) => byName.set(f.name, f));
        const merged = [...byName.values()].sort((a, b) => a.displayOrder - b.displayOrder);
        setFieldDefinitions(merged);

        if (!itemIdParam) {
          const initialData: Record<string, unknown> = {};
          merged.forEach((field) => {
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
          setSellerPrice('');
        }
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load form fields');
        }
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [event?.id, itemIdParam, editingItem, itemTypeId]);

  useEffect(() => {
    if (!event?.organizationId) {
      setGearTemplate(null);
      return;
    }
    const cid = itemIdParam ? editingItem?.categoryId : itemTypeId ?? undefined;
    if (!cid) {
      setGearTemplate(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let tpl = await resolveGearTagTemplateForCategory(event.organizationId, cid);
        if (!tpl) tpl = await getDefaultGearTagTemplate(event.organizationId);
        if (!cancelled) setGearTemplate(tpl);
      } catch {
        if (!cancelled) setGearTemplate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.organizationId, itemIdParam, editingItem?.categoryId, itemTypeId]);

  /** Seed form keys for tag-template-only fields (not in category/org field definitions). */
  useEffect(() => {
    if (!gearTemplate?.tagFields?.length || fieldDefinitions.length === 0) return;
    setFormData((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const tf of gearTemplate.tagFields ?? []) {
        if (skipStandaloneTagField(tf.field)) continue;
        if (fieldDefinitions.some((fd) => fd.name === tf.field)) continue;
        if (Object.prototype.hasOwnProperty.call(next, tf.field)) continue;
        const dt = resolveTagFieldDataType(tf);
        next[tf.field] = dt === 'boolean' ? false : '';
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [gearTemplate, fieldDefinitions]);

  const handleSubmit = async () => {
    if (!user || !event) return;

    if (!itemIdParam) {
      if (itemTypeOptions.length === 0) {
        Alert.alert(
          'No item types',
          'This event does not have any item types available yet. Ask the organizer to configure item types under Manage Event.'
        );
        return;
      }
      if (!itemTypeId) {
        Alert.alert('Item type required', 'Choose the item type that matches what you are selling.');
        return;
      }
    }

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

    const tplReq = gearTemplate?.requiredFields ?? [];
    for (const reqName of tplReq) {
      if (skipStandaloneTagField(reqName)) continue;
      const tagTf = gearTemplate?.tagFields?.find((t) => t.field === reqName);
      const tagDt = tagTf ? resolveTagFieldDataType(tagTf) : undefined;
      const v = formData[reqName];
      if (tagDt === 'boolean') {
        if (typeof v !== 'boolean') {
          Alert.alert(
            'Error',
            `Please choose yes or no for ${tagTf?.label || fieldDefinitions.find((f) => f.name === reqName)?.label || reqName}`
          );
          return;
        }
        continue;
      }
      if (v === undefined || v === null || v === '') {
        Alert.alert(
          'Error',
          `Please fill in ${tagTf?.label || fieldDefinitions.find((f) => f.name === reqName)?.label || reqName}`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      // Build custom fields object (exclude special fields that go to legacy columns)
      const customFields: Record<string, unknown> = {};
      const legacyData: any = {};

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

      if (gearTemplate?.tagFields) {
        for (const tf of gearTemplate.tagFields) {
          if (skipStandaloneTagField(tf.field)) continue;
          if (fieldDefinitions.some((fd) => fd.name === tf.field)) continue;
          const tfVal = formData[tf.field];
          if (tfVal !== undefined) {
            customFields[tf.field] = tfVal;
          }
        }
      }

      legacyData.originalPrice = basePrice;

      if (!editingItem && itemTypeId) {
        legacyData.categoryId = itemTypeId;
      }

      if (legacyData.categoryId && !legacyData.category) {
        try {
          const match = await getCategory(String(legacyData.categoryId));
          if (match) legacyData.category = match.name;
        } catch {
          // optional display name
        }
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
        await setSellerDashboardEventId(event.id);
        router.replace({ pathname: '/(tabs)', params: { eventId: event.id } });
        return;
      }

      await createItem(user.id, event.id, {
        ...legacyData,
        customFields,
        sellerItemLabel: sellerListingName.trim() || undefined,
      });

      await setSellerDashboardEventId(event.id);
      router.replace({ pathname: '/(tabs)', params: { eventId: event.id } });
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

    const tagSpec = gearTemplate?.tagFields?.find((tf) => tf.field === field.name);
    if (tagSpec) {
      const tagDt = resolveTagFieldDataType(tagSpec);
      const dropdownOpts = tagFieldDropdownOptions(tagSpec);

      if (tagDt === 'dropdown' && dropdownOpts.length > 0) {
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
              {dropdownOpts.map((option, optIdx) => (
                <TouchableOpacity
                  key={`${field.name}-tag-dd-${optIdx}-${option}`}
                  style={[styles.dropdownOption, value === option && styles.dropdownOptionSelected]}
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
      }

      if (tagDt === 'boolean') {
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
      }

      if (tagDt === 'number') {
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={value === undefined || value === null ? '' : String(value)}
              onChangeText={(text) => {
                if (text.trim() === '') {
                  setFormData({ ...formData, [field.name]: '' });
                } else {
                  const n = parseFloat(text.replace(/,/g, ''));
                  setFormData({
                    ...formData,
                    [field.name]: Number.isFinite(n) ? n : text,
                  });
                }
              }}
              placeholder={field.placeholder || field.label}
              keyboardType="decimal-pad"
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );
      }

      if (tagDt === 'integer') {
        return (
          <View key={field.id} style={styles.field}>
            <Text style={styles.label}>
              {field.label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={value === undefined || value === null ? '' : String(value)}
              onChangeText={(text) => {
                if (text.trim() === '') {
                  setFormData({ ...formData, [field.name]: '' });
                } else {
                  const n = parseInt(text.replace(/[^\d-]/g, ''), 10);
                  setFormData({
                    ...formData,
                    [field.name]: Number.isFinite(n) ? n : '',
                  });
                }
              }}
              placeholder={field.placeholder || field.label}
              keyboardType="number-pad"
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );
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

  /** Extra inputs for fields that exist on the gear tag template but not in org/category definitions. */
  const renderSupplementaryTagField = (tf: TagField) => {
    if (skipStandaloneTagField(tf.field)) return null;
    if (fieldDefinitions.some((fd) => fd.name === tf.field)) return null;

    const value = formData[tf.field];
    const label =
      tf.label ||
      availableTagFieldMeta.find((m) => m.name === tf.field)?.defaultLabel ||
      availableTagFieldMeta.find((m) => m.name === tf.field)?.label ||
      tf.field;
    const isRequired = gearTemplate?.requiredFields?.includes(tf.field) ?? false;
    const tagDt = resolveTagFieldDataType(tf);
    const dropdownOpts = tagFieldDropdownOptions(tf);
    const key = `tag-sup-${tf.field}`;

    if (tagDt === 'dropdown' && dropdownOpts.length > 0) {
      return (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>
            {label} {isRequired && <Text style={styles.required}>*</Text>}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
            {dropdownOpts.map((option, optIdx) => (
              <TouchableOpacity
                key={`${tf.field}-sup-dd-${optIdx}-${option}`}
                style={[styles.dropdownOption, value === option && styles.dropdownOptionSelected]}
                onPress={() => setFormData({ ...formData, [tf.field]: option })}
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
        </View>
      );
    }

    if (tagDt === 'boolean') {
      return (
        <View key={key} style={styles.field}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.label}>
                {label} {isRequired && <Text style={styles.required}>*</Text>}
              </Text>
            </View>
            <Switch
              value={Boolean(value)}
              onValueChange={(val) => setFormData({ ...formData, [tf.field]: val })}
            />
          </View>
        </View>
      );
    }

    if (tagDt === 'number') {
      return (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>
            {label} {isRequired && <Text style={styles.required}>*</Text>}
          </Text>
          <TextInput
            style={styles.textInput}
            value={value === undefined || value === null ? '' : String(value)}
            onChangeText={(text) => {
              if (text.trim() === '') {
                setFormData({ ...formData, [tf.field]: '' });
              } else {
                const n = parseFloat(text.replace(/,/g, ''));
                setFormData({
                  ...formData,
                  [tf.field]: Number.isFinite(n) ? n : text,
                });
              }
            }}
            keyboardType="decimal-pad"
            placeholder={label}
          />
        </View>
      );
    }

    if (tagDt === 'integer') {
      return (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>
            {label} {isRequired && <Text style={styles.required}>*</Text>}
          </Text>
          <TextInput
            style={styles.textInput}
            value={value === undefined || value === null ? '' : String(value)}
            onChangeText={(text) => {
              if (text.trim() === '') {
                setFormData({ ...formData, [tf.field]: '' });
              } else {
                const n = parseInt(text.replace(/[^\d-]/g, ''), 10);
                setFormData({
                  ...formData,
                  [tf.field]: Number.isFinite(n) ? n : '',
                });
              }
            }}
            keyboardType="number-pad"
            placeholder={label}
          />
        </View>
      );
    }

    return (
      <View key={key} style={styles.field}>
        <Text style={styles.label}>
          {label} {isRequired && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={styles.textInput}
          value={String(value ?? '')}
          onChangeText={(text) => setFormData({ ...formData, [tf.field]: text })}
          placeholder={label}
          maxLength={
            tagDt === 'any'
              ? undefined
              : tf.maxLength != null
                ? Math.min(Math.max(1, tf.maxLength), 5000)
                : undefined
          }
        />
      </View>
    );
  };

  const showTypeSpecificForm = itemIdParam ? !!editingItem : !!itemTypeId;

  if (
    eventLoading ||
    (user && loadingItemTypes) ||
    (itemIdParam && loadingItem) ||
    (!itemIdParam && user && itemTypeId && loadingFields)
  ) {
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
          <Text style={styles.label}>Item nickname</Text>
          <TextInput
            style={styles.textInput}
            value={sellerListingName}
            onChangeText={setSellerListingName}
            placeholder="e.g. Blue Burton snowboard"
          />
          <Text style={styles.helpText}>
            This nickname is only for you in the app. It is not printed on the physical tag.
          </Text>
        </View>

        {editingItem ? (
          <View style={styles.field}>
            <Text style={styles.label}>Item type</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>
                {selectedItemTypeLabel || editingItem.category?.trim() || '—'}
              </Text>
            </View>
            <Text style={styles.helpText}>Item type cannot be changed after pre-registration.</Text>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>
              Item type <Text style={styles.required}>*</Text>
            </Text>
            {itemTypeOptions.length === 0 ? (
              <Text style={styles.helpText}>
                No item types are set up for this event. Ask the organizer to choose item types under Manage Event → Item
                types at this event.
              </Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectInputRow}
                  onPress={() => setItemTypeMenuVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.selectInputText, !itemTypeId && styles.selectInputPlaceholder]}
                    numberOfLines={2}
                  >
                    {itemTypeId ? selectedItemTypeLabel : 'Select item type'}
                  </Text>
                  <Text style={styles.selectInputChevron}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.helpText}>
                  This tells the swap which gear tag layout to use when staff print your label at check-in.
                </Text>
                <Modal
                  visible={itemTypeMenuVisible}
                  animationType="fade"
                  transparent
                  onRequestClose={() => setItemTypeMenuVisible(false)}
                >
                  <View style={styles.itemTypeModalRoot}>
                    <TouchableOpacity
                      style={styles.itemTypeModalBackdrop}
                      activeOpacity={1}
                      onPress={() => setItemTypeMenuVisible(false)}
                    />
                    <View style={styles.itemTypeModalSheet}>
                      <Text style={styles.itemTypeModalTitle}>Item type</Text>
                      <Text style={styles.itemTypeModalSubtitle}>
                        Choose the category that best matches your item.
                      </Text>
                      <ScrollView style={styles.itemTypeModalList} keyboardShouldPersistTaps="handled">
                        {itemTypeOptions.map((opt) => {
                          const selected = itemTypeId === opt.id;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[styles.itemTypeModalOption, selected && styles.itemTypeModalOptionSelected]}
                              onPress={() => {
                                setItemTypeId(opt.id);
                                setItemTypeMenuVisible(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.itemTypeModalOptionText,
                                  selected && styles.itemTypeModalOptionTextSelected,
                                ]}
                                numberOfLines={3}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <TouchableOpacity
                        style={styles.itemTypeModalDismiss}
                        onPress={() => setItemTypeMenuVisible(false)}
                      >
                        <Text style={styles.itemTypeModalDismissText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              </>
            )}
          </View>
        )}

        {showTypeSpecificForm ? (
          <>
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

            {fieldDefinitions
              .filter(
                (f) =>
                  f.name !== 'category' &&
                  f.name !== 'category_id' &&
                  !f.isPriceField
              )
              .map((field) => renderField(field))}

            {gearTemplate?.tagFields?.map((tf) => renderSupplementaryTagField(tf))}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 This pre-registers your item; staff will confirm it at check-in. Make sure all information is accurate.
              </Text>
            </View>
          </>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || (!itemIdParam && (!itemTypeId || itemTypeOptions.length === 0))) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || (!itemIdParam && (!itemTypeId || itemTypeOptions.length === 0))}
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
  selectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  selectInputText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingRight: 8,
  },
  selectInputPlaceholder: {
    color: '#999',
  },
  selectInputChevron: {
    fontSize: 12,
    color: '#666',
  },
  itemTypeModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  itemTypeModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  itemTypeModalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: '72%',
    paddingBottom: 8,
    zIndex: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  itemTypeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  itemTypeModalSubtitle: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  itemTypeModalList: {
    maxHeight: 360,
  },
  itemTypeModalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  itemTypeModalOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  itemTypeModalOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  itemTypeModalOptionTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
  itemTypeModalDismiss: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  itemTypeModalDismissText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
