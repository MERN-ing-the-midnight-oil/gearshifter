import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  useAuth,
  useAdminOrganization,
  useAdminUser,
  getOrganizationGearTagTemplates,
  createGearTagTemplate,
  updateGearTagTemplate,
  deleteGearTagTemplate,
  getOrganizationCategories,
  TAG_SIZE_PRESETS,
  getBrands,
  getSizesByBrand,
  getTagSizePreset,
  AVAILABLE_QR_CODE_FIELDS,
  getQRCodeFieldsByCategory,
  sanitizeGearTagTemplatePriceSemantics,
  collectForbiddenShadowPriceTagFieldNames,
  isForbiddenShadowPriceTagFieldName,
  GEAR_TAG_ITEM_LIST_PRICE_FIELD,
  type GearTagTemplate,
  type TagField,
  type TagFieldDataType,
  type TagLayoutType,
  type QRCodePosition,
} from 'shared';
import { useState, useEffect, useCallback } from 'react';
import TagPreviewMockup from '../../components/TagPreviewMockup';
import { OrganizerBreadcrumbs, type OrganizerBreadcrumbItem } from '../../components/OrganizerBreadcrumbs';
import { cardShadow } from '../../lib/theme';

const DESKTOP_BREAKPOINT = 1100;
const STICKY_PREVIEW_BREAKPOINT = 1320;

const QR_POSITIONS: { value: QRCodePosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'center', label: 'Center' },
];

// Common item fields that can appear on tags
const TAG_FIELD_DATA_TYPES: { value: TagFieldDataType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'any', label: 'Any' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'dropdown', label: 'Dropdown' },
];

function coerceTagFieldDataType(raw: unknown): TagFieldDataType | undefined {
  if (
    raw === 'text' ||
    raw === 'any' ||
    raw === 'boolean' ||
    raw === 'number' ||
    raw === 'integer' ||
    raw === 'dropdown'
  ) {
    return raw;
  }
  return undefined;
}

function parseDropdownOptionsFromUnknown(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim());
}

function resolvedTagFieldDataType(tf: TagField): TagFieldDataType {
  return coerceTagFieldDataType(tf.dataType) ?? 'text';
}

/** Strip empty dropdown option strings and omit `dropdownOptions` when not a dropdown. */
function sanitizeTagFieldsForPersist(fields: TagField[]): TagField[] {
  return fields.map((tf) => {
    const dt = resolvedTagFieldDataType(tf);
    if (dt !== 'dropdown') {
      const { dropdownOptions: _omit, ...rest } = tf;
      return rest;
    }
    const opts = parseDropdownOptionsFromUnknown(tf.dropdownOptions).filter(Boolean);
    return {
      ...tf,
      dataType: 'dropdown' as TagFieldDataType,
      dropdownOptions: opts,
    };
  });
}

const AVAILABLE_FIELDS = [
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

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={collapsibleStyles.section}>
      <Pressable style={collapsibleStyles.header} onPress={onToggle}>
        <Text style={collapsibleStyles.title}>{title}</Text>
        <Text style={collapsibleStyles.chevron}>{expanded ? '▼' : '▶'}</Text>
      </Pressable>
      {expanded && <View style={collapsibleStyles.content}>{children}</View>}
    </View>
  );
}

const collapsibleStyles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chevron: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 4,
  },
});

export default function GearTagsScreen() {
  const getDefaultExpandedSections = (): Record<string, boolean> => ({
    printerSize: false,
    tagFields: false,
    categories: false,
    qrCode: false,
    defaultTemplate: false,
  });
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const useStickyPreview = width >= STICKY_PREVIEW_BREAKPOINT;
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [templates, setTemplates] = useState<GearTagTemplate[]>([]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(getDefaultExpandedSections);
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTag, setCreatingTag] = useState(false);
  const [savingTag, setSavingTag] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GearTagTemplate | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [showAddFieldRow, setShowAddFieldRow] = useState(false);
  /** `TagField.field` key for which row shows the detail editor (default + custom fields). */
  const [tagFieldEditKey, setTagFieldEditKey] = useState<string | null>(null);

  const [selectedBrand, setSelectedBrand] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    name: '',
    layoutType: 'standard' as TagLayoutType,
    selectedPresetId: undefined as string | undefined,
    widthMm: '50',
    heightMm: '30',
    tagFields: [] as TagField[],
    requiredFields: [] as string[],
    categoryIds: [] as string[],
    fontFamily: 'Arial',
    fontSize: '10',
    borderWidth: '0.5',
    qrCodeSize: '15',
    qrCodePosition: 'bottom-right' as QRCodePosition,
    qrCodeEnabled: true, // QR codes are always enabled on sticker tags
    qrCodeDataFields: ['item_number'] as string[],
    qrCodeSellerAccess: [] as string[],
    isDefault: false,
  });

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);

  const loadData = useCallback(async () => {
    const orgId = organization?.id;
    if (!orgId) return;

    setLoading(true);
    try {
      const [templatesData, categoriesData] = await Promise.all([
        getOrganizationGearTagTemplates(orgId),
        getOrganizationCategories(orgId),
      ]);

      setTemplates(templatesData);
      setCategories(categoriesData);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  /** Reload whenever this screen is focused (fixes stale list after save/navigation; avoids relying on `organization` ref alone). */
  useFocusEffect(
    useCallback(() => {
      if (!organization?.id) {
        setLoading(false);
        return;
      }
      void loadData();
    }, [organization?.id, loadData])
  );

  const createNewTag = async () => {
    if (!organization) {
      Alert.alert(
        'Cannot create tag',
        'No organization found. Please sign in with an organizer account.'
      );
      return;
    }

    // Ensure unique name to avoid 409 (organization_id + name unique constraint)
    const existingNames = new Set(templates.map((t) => t.name));
    let name = 'New Tag';
    let n = 1;
    while (existingNames.has(name)) {
      n += 1;
      name = `New Tag (${n})`;
    }

    setCreatingTag(true);
    try {
      // Start from a local draft instead of inserting a placeholder row.
      // The row is created when the user hits Save with valid tag fields.
      setEditingTemplate(null);
      setSelectedBrand(undefined);
      const seeded = sanitizeGearTagTemplatePriceSemantics([], []);
      setFormData({
        name,
        layoutType: 'standard',
        selectedPresetId: undefined,
        widthMm: '50',
        heightMm: '30',
        tagFields: seeded.tagFields,
        requiredFields: seeded.requiredFields ?? [],
        categoryIds: [],
        fontFamily: 'Arial',
        fontSize: '10',
        borderWidth: '0.5',
        qrCodeSize: '15',
        qrCodePosition: 'bottom-right',
        qrCodeEnabled: true,
        qrCodeDataFields: ['item_number'],
        qrCodeSellerAccess: [],
        isDefault: false,
      });
      setExpandedSections(getDefaultExpandedSections());
      // Skip create-options chooser and open directly in tag fields setup.
      setShowCreateOptions(false);
      setShowAddForm(true);
    } finally {
      setCreatingTag(false);
    }
  };

  const resetForm = () => {
    setSelectedBrand(undefined);
    setFormData({
      name: '',
      layoutType: 'standard',
      selectedPresetId: undefined,
      widthMm: '50',
      heightMm: '30',
      tagFields: [],
      requiredFields: [],
      categoryIds: [],
      fontFamily: 'Arial',
      fontSize: '10',
      borderWidth: '0.5',
      qrCodeSize: '15',
      qrCodePosition: 'bottom-right',
      qrCodeEnabled: true,
      qrCodeDataFields: ['item_number'], // Default: only item number
      qrCodeSellerAccess: [], // Default: sellers can't see QR code data (org users only)
      isDefault: false,
    });
    setShowAddForm(false);
    setShowCreateOptions(false);
    setEditingTemplate(null);
    setShowAddFieldRow(false);
    setNewFieldName('');
    setTagFieldEditKey(null);
  };

  const handleSave = async () => {
    console.log('[GearTags] Save button pressed, handleSave called');
    if (!organization) {
      console.log('[GearTags] Save aborted: no organization');
      Alert.alert('Error', 'No organization linked. Please link your account to an organization first.');
      return;
    }

    if (!formData.name.trim()) {
      console.log('[GearTags] Save aborted: template name is required');
      Alert.alert('Error', 'Template name is required');
      return;
    }

    if (formData.tagFields.length === 0) {
      console.log('[GearTags] Save aborted: at least one tag field required', {
        tagFieldsCount: formData.tagFields.length,
        requiredFieldsCount: formData.requiredFields.length,
        requiredFields: formData.requiredFields,
        tagFields: formData.tagFields,
      });
      Alert.alert('Error', 'At least one field must be added to the tag');
      return;
    }

    for (const tf of formData.tagFields) {
      if (resolvedTagFieldDataType(tf) === 'dropdown') {
        const opts = parseDropdownOptionsFromUnknown(tf.dropdownOptions).filter(Boolean);
        if (opts.length === 0) {
          Alert.alert(
            'Error',
            `Dropdown field "${tf.label || tf.field}" needs at least one menu option. Open Edit and add choices.`
          );
          return;
        }
      }
    }

    const shadowPriceFields = collectForbiddenShadowPriceTagFieldNames(formData.tagFields);
    if (shadowPriceFields.length > 0) {
      const msg = `Remove tag fields named: ${shadowPriceFields.join(', ')}. For the list price stored on each item (what it sells for at the swap), use only "Original Price" — not a custom field that looks like a second price.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Invalid tag field names', msg);
      }
      return;
    }

    const sanitized = sanitizeTagFieldsForPersist(formData.tagFields);
    const { tagFields: tagFieldsForApi, requiredFields: requiredFieldsForApi } =
      sanitizeGearTagTemplatePriceSemantics(sanitized, formData.requiredFields);

    console.log('[GearTags] Validation passed, calling API...', { editingTemplateId: editingTemplate?.id, formDataName: formData.name });
    setSavingTag(true);
    try {
      if (editingTemplate) {
        await updateGearTagTemplate(editingTemplate.id, {
          name: formData.name,
          layoutType: formData.layoutType,
          widthMm: parseFloat(formData.widthMm),
          heightMm: parseFloat(formData.heightMm),
          tagFields: tagFieldsForApi,
          requiredFields: requiredFieldsForApi ?? formData.requiredFields,
          categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
          fontFamily: formData.fontFamily,
          fontSize: parseFloat(formData.fontSize),
          borderWidth: parseFloat(formData.borderWidth),
          qrCodeSize: parseFloat(formData.qrCodeSize),
          qrCodePosition: formData.qrCodePosition,
          qrCodeEnabled: formData.qrCodeEnabled,
          qrCodeDataFields: formData.qrCodeDataFields,
          qrCodeSellerAccess: formData.qrCodeSellerAccess,
          isDefault: formData.isDefault,
        });
      } else {
        await createGearTagTemplate(organization.id, {
          name: formData.name,
          layoutType: formData.layoutType,
          widthMm: parseFloat(formData.widthMm),
          heightMm: parseFloat(formData.heightMm),
          tagFields: tagFieldsForApi,
          requiredFields: requiredFieldsForApi ?? formData.requiredFields,
          categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
          fontFamily: formData.fontFamily,
          fontSize: parseFloat(formData.fontSize),
          borderWidth: parseFloat(formData.borderWidth),
          qrCodeSize: parseFloat(formData.qrCodeSize),
          qrCodePosition: formData.qrCodePosition,
          qrCodeDataFields: formData.qrCodeDataFields,
          qrCodeSellerAccess: formData.qrCodeSellerAccess,
          isDefault: formData.isDefault,
        });
      }

      console.log('[GearTags] Save successful');
      resetForm();
      await loadData();

      Alert.alert('Success', 'Tag template saved successfully');
    } catch (error) {
      console.error('[GearTags] Save failed:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setSavingTag(false);
    }
  };

  const normalizeTagFields = (fields: TagField[]): TagField[] =>
    fields.map((f) => {
      const { position, dataType: rawDt, dropdownOptions: rawDropdown, ...rest } = f;
      const dt = coerceTagFieldDataType(rawDt);
      let dropdownOptions: string[] | undefined;
      if (dt === 'dropdown') {
        const trimmed = parseDropdownOptionsFromUnknown(rawDropdown).filter(Boolean);
        dropdownOptions = trimmed.length > 0 ? trimmed : [''];
      }
      return {
        ...rest,
        maxLength: f.maxLength ?? 30,
        ...(dt ? { dataType: dt } : {}),
        ...(dropdownOptions !== undefined ? { dropdownOptions } : {}),
      };
    });

  const handleEdit = (template: GearTagTemplate) => {
    setTagFieldEditKey(null);
    setEditingTemplate(template);
    // Try to find matching preset
    const matchingPreset = TAG_SIZE_PRESETS.find(
      (p) => p.widthMm === template.widthMm && p.heightMm === template.heightMm
    );

    // Set the selected brand if we found a matching preset
    if (matchingPreset) {
      setSelectedBrand(matchingPreset.brand);
    }

    setFormData({
      name: template.name,
      layoutType: template.layoutType,
      selectedPresetId: matchingPreset?.id,
      widthMm: String(template.widthMm),
      heightMm: String(template.heightMm),
      tagFields: normalizeTagFields(template.tagFields),
      requiredFields: template.requiredFields,
      categoryIds: template.categoryIds || [],
      fontFamily: template.fontFamily,
      fontSize: String(template.fontSize),
      borderWidth: String(template.borderWidth),
          qrCodeSize: String(template.qrCodeSize),
          qrCodePosition: template.qrCodePosition,
          qrCodeEnabled: template.qrCodeEnabled,
          qrCodeDataFields: template.qrCodeDataFields || ['item_number'],
          qrCodeSellerAccess: template.qrCodeSellerAccess || [],
          isDefault: template.isDefault,
    });
    setShowAddForm(true);
  };

  const performDelete = async (template: GearTagTemplate) => {
    try {
      await deleteGearTagTemplate(template.id);
      await loadData();
      if (Platform.OS === 'web') {
        window.alert('Tag template deleted.');
      } else {
        Alert.alert('Success', 'Tag template deleted.');
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'Failed to delete template';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleDelete = (template: GearTagTemplate) => {
    if (!template?.id) return;

    if (Platform.OS === 'web') {
      // Alert.alert on web doesn't invoke custom button onPress callbacks
      const confirmed = window.confirm(`Are you sure you want to delete "${template.name}"?`);
      if (confirmed) performDelete(template);
    } else {
      Alert.alert(
        'Delete Template',
        `Are you sure you want to delete "${template.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => performDelete(template) },
        ]
      );
    }
  };

  const addFieldFromName = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) return;

    const known = AVAILABLE_FIELDS.find(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase() || f.label.toLowerCase() === trimmed.toLowerCase()
    );
    const fieldKey = known ? known.name : trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '');
    const label = known ? (known.defaultLabel || known.label) : trimmed;

    if (formData.tagFields.some((tf) => tf.field === fieldKey)) {
      setNewFieldName('');
      return;
    }

    if (isForbiddenShadowPriceTagFieldName(fieldKey)) {
      const msg =
        'That name is reserved. Use "Original Price" on the tag for the list price stored on each item in the system — do not add a separate custom field that looks like a second price.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Field name not allowed', msg);
      }
      setNewFieldName('');
      return;
    }

    const newField: TagField = {
      field: fieldKey,
      label,
      maxLength: 30,
      fontSize: 10,
      fontWeight: 'normal',
      required: false,
      dataType: 'text',
    };
    setFormData({
      ...formData,
      tagFields: [...formData.tagFields, newField],
    });
    setTagFieldEditKey(fieldKey);
    setNewFieldName('');
    setShowAddFieldRow(false);
  };

  const updateTagField = (index: number, updates: Partial<TagField>) => {
    const newFields = [...formData.tagFields];
    newFields[index] = { ...newFields[index], ...updates };
    setFormData({ ...formData, tagFields: newFields });
  };

  const moveTagField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...formData.tagFields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newFields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFormData({ ...formData, tagFields: newFields });
  };

  const removeTagField = (index: number) => {
    if (formData.tagFields[index]?.field === GEAR_TAG_ITEM_LIST_PRICE_FIELD) {
      const msg =
        'Original Price stays on every tag because it must match the price stored on the item in the system.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Original Price', msg);
      }
      return;
    }
    const removedKey = formData.tagFields[index]?.field;
    setFormData({
      ...formData,
      tagFields: formData.tagFields.filter((_, i) => i !== index),
      requiredFields: formData.requiredFields.filter(
        (f) => f !== formData.tagFields[index].field
      ),
    });
    if (removedKey && tagFieldEditKey === removedKey) setTagFieldEditKey(null);
  };

  const setFieldRequired = (fieldName: string, required: boolean) => {
    let newRequired = [...formData.requiredFields];
    let newTagFields = [...formData.tagFields];

    if (required) {
      if (!newRequired.includes(fieldName)) newRequired.push(fieldName);
      const idx = newTagFields.findIndex((tf) => tf.field === fieldName);
      if (idx < 0) {
        const known = AVAILABLE_FIELDS.find((f) => f.name === fieldName);
        const label = known ? (known.defaultLabel || known.label) : fieldName;
        newTagFields.push({
          field: fieldName,
          label,
          maxLength: 30,
          fontSize: 10,
          fontWeight: 'normal',
          required: true,
          dataType: 'text',
        });
      } else {
        newTagFields[idx] = { ...newTagFields[idx], required: true };
      }
    } else {
      newRequired = newRequired.filter((f) => f !== fieldName);
      const idx = newTagFields.findIndex((tf) => tf.field === fieldName);
      if (idx >= 0) {
        newTagFields[idx] = { ...newTagFields[idx], required: false };
      }
    }

    setFormData({
      ...formData,
      requiredFields: newRequired,
      tagFields: newTagFields,
    });
  };

  const toggleDefaultFieldOnTag = (fieldName: string) => {
    const idx = formData.tagFields.findIndex((tf) => tf.field === fieldName);
    if (idx >= 0) {
      if (fieldName === GEAR_TAG_ITEM_LIST_PRICE_FIELD) {
        const msg =
          'Original Price stays on every tag because it must match the price stored on the item in the system.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Original Price', msg);
        }
        return;
      }
      removeTagField(idx);
      return;
    }
    const known = AVAILABLE_FIELDS.find((f) => f.name === fieldName);
    const label = known ? (known.defaultLabel || known.label) : fieldName;
    setFormData({
      ...formData,
      tagFields: [
        ...formData.tagFields,
        {
          field: fieldName,
          label,
          maxLength: 30,
          fontSize: 10,
          fontWeight: 'normal',
          required: false,
          dataType: 'text',
        },
      ],
    });
  };

  const moveFieldByFieldName = (fieldName: string, direction: 'up' | 'down') => {
    const idx = formData.tagFields.findIndex((tf) => tf.field === fieldName);
    if (idx < 0) return;
    moveTagField(idx, direction);
  };

  const renderTagFieldEditor = (index: number) => {
    const tf = formData.tagFields[index];
    if (!tf) return null;
    const dt = resolvedTagFieldDataType(tf);
    const dropdownOptionRows =
      dt === 'dropdown' ? (tf.dropdownOptions?.length ? tf.dropdownOptions : ['']) : [];

    const patchDropdownOption = (optIndex: number, text: string) => {
      const base = tf.dropdownOptions?.length ? [...tf.dropdownOptions] : [''];
      base[optIndex] = text;
      updateTagField(index, { dropdownOptions: base });
    };

    const removeDropdownOptionRow = (optIndex: number) => {
      const base = tf.dropdownOptions?.length ? [...tf.dropdownOptions] : [''];
      base.splice(optIndex, 1);
      updateTagField(index, { dropdownOptions: base.length > 0 ? base : [''] });
    };

    const addDropdownOptionRow = () => {
      const base = tf.dropdownOptions?.length ? [...tf.dropdownOptions] : [''];
      updateTagField(index, { dropdownOptions: [...base, ''] });
    };

    const finalizeTagFieldEditor = () => setTagFieldEditKey(null);

    return (
      <View style={styles.tagFieldEditorPanel}>
        <View style={styles.formField}>
          <Text style={styles.smallLabel}>Field name</Text>
          <TextInput
            style={styles.smallInput}
            value={tf.label || ''}
            onChangeText={(text) => updateTagField(index, { label: text })}
            placeholder="e.g. Price, Size"
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={finalizeTagFieldEditor}
          />
        </View>
        <View style={styles.tagFieldHideLabelRow}>
          <View style={styles.tagFieldHideLabelTextWrap}>
            <Text style={styles.smallLabel}>Hide field name on tag</Text>
            <Text style={styles.helpText}>Printed tag shows only the value. Sellers still see this name when entering item details.</Text>
          </View>
          <Switch
            value={Boolean(tf.hideLabelOnTag)}
            onValueChange={(val) => updateTagField(index, { hideLabelOnTag: val })}
          />
        </View>
        <View style={styles.formRow}>
          <View style={[styles.formField, styles.halfWidth]}>
            <Text style={styles.smallLabel}>Max characters</Text>
            <TextInput
              style={styles.smallInput}
              value={String(tf.maxLength ?? 30)}
              onChangeText={(text) =>
                updateTagField(index, { maxLength: Math.max(1, parseInt(text, 10) || 30) })
              }
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={finalizeTagFieldEditor}
            />
          </View>
          <View style={[styles.formField, styles.halfWidth]}>
            <Text style={styles.smallLabel}>Font size</Text>
            <TextInput
              style={styles.smallInput}
              value={String(tf.fontSize ?? 10)}
              onChangeText={(text) => updateTagField(index, { fontSize: parseFloat(text) || 10 })}
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={finalizeTagFieldEditor}
            />
          </View>
        </View>
        <View style={styles.formField}>
          <Text style={styles.smallLabel}>Data type</Text>
          <Text style={styles.helpText}>What sellers enter: Any is free text without an input cap; other types validate as labeled.</Text>
          <View style={styles.dataTypeChipsWrap}>
            {TAG_FIELD_DATA_TYPES.map((opt) => {
              const selected = dt === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.dataTypeChip, selected && styles.dataTypeChipSelected]}
                  onPress={() => {
                    if (opt.value === 'dropdown') {
                      const existing = parseDropdownOptionsFromUnknown(tf.dropdownOptions).filter(Boolean);
                      updateTagField(index, {
                        dataType: 'dropdown',
                        dropdownOptions: existing.length > 0 ? existing : [''],
                      });
                    } else {
                      const { dropdownOptions: _omit, ...rest } = tf;
                      updateTagField(index, { ...rest, dataType: opt.value });
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.dataTypeChipText, selected && styles.dataTypeChipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {dt === 'dropdown' ? (
          <View style={styles.formField}>
            <Text style={styles.smallLabel}>Menu options</Text>
            <Text style={styles.helpText}>
              Choices shown to sellers for this field. Empty rows are ignored when you save.
            </Text>
            {dropdownOptionRows.map((optVal, optIdx) => (
              <View key={`dropdown-opt-${optIdx}`} style={styles.dropdownOptionRow}>
                <TextInput
                  style={[styles.smallInput, styles.dropdownOptionInput]}
                  value={optVal}
                  onChangeText={(text) => patchDropdownOption(optIdx, text)}
                  placeholder={`Option ${optIdx + 1}`}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={finalizeTagFieldEditor}
                />
                <TouchableOpacity
                  style={styles.dropdownOptionRemove}
                  onPress={() => removeDropdownOptionRow(optIdx)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove option ${optIdx + 1}`}
                  {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                >
                  <Text style={styles.dropdownOptionRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addDropdownOptionButton}
              onPress={addDropdownOptionRow}
              activeOpacity={0.85}
              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
            >
              <Text style={styles.addDropdownOptionButtonText}>+ Add option</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.tagFieldEditorSubmitRow}>
          <Pressable
            onPress={finalizeTagFieldEditor}
            style={({ pressed }) => [
              styles.tagFieldEditorSubmitButton,
              pressed && styles.tagFieldEditorSubmitButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Submit field changes"
            {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
          >
            <Text style={styles.tagFieldEditorSubmitButtonText}>Submit</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const toggleCategory = (categoryId: string) => {
    setFormData({
      ...formData,
      categoryIds: formData.categoryIds.includes(categoryId)
        ? formData.categoryIds.filter((id) => id !== categoryId)
        : [...formData.categoryIds, categoryId],
    });
  };

  const flattenCategories = (cats: any[]): any[] => {
    const result: any[] = [];
    cats.forEach((cat) => {
      result.push(cat);
      if (cat.children) {
        result.push(...flattenCategories(cat.children));
      }
    });
    return result;
  };

  if (adminUserLoading || !isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{adminUserLoading ? 'Loading...' : 'Redirecting...'}</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const gearTagsBreadcrumbItems = ((): OrganizerBreadcrumbItem[] => {
    const dash: OrganizerBreadcrumbItem = { label: 'Org Dashboard', href: '/(dashboard)' };
    if (showAddForm) {
      return [
        dash,
        { label: 'Item Tags', onPress: () => resetForm() },
        { label: editingTemplate ? editingTemplate.name : 'New tag template' },
      ];
    }
    if (showCreateOptions) {
      return [
        dash,
        { label: 'Item Tags', onPress: () => resetForm() },
        { label: 'New tag setup' },
      ];
    }
    return [dash, { label: 'Item Tags' }];
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (showAddForm || showCreateOptions) {
              resetForm();
            } else {
              router.navigate('/(dashboard)');
            }
          }}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View style={styles.headerBreadcrumbs}>
          <OrganizerBreadcrumbs items={gearTagsBreadcrumbItems} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {showAddForm ? (
          /* Edit/Configure Tag Form */
          <View style={[styles.formCard, isDesktop && styles.formCardDesktop]}>
            <Text style={styles.formTitle}>
              {editingTemplate ? 'Configure Tag' : 'New Tag Template'}
            </Text>

            <View style={isDesktop ? styles.formLayoutDesktop : styles.formLayoutMobile}>
              {/* Left column: scrollable on desktop (for sticky preview), passes through on mobile */}
              <ScrollView
                style={isDesktop ? styles.formConfigScroll : undefined}
                contentContainerStyle={isDesktop ? styles.formConfigContent : undefined}
                scrollEnabled={isDesktop}
                showsVerticalScrollIndicator={isDesktop}
                nestedScrollEnabled={Platform.OS === 'android'}
              >
                <View style={styles.formField}>
                  <Text style={styles.label}>Tag Nickname *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="e.g., Bike Tag, Skis Tag"
                  />
                </View>

                <CollapsibleSection
                  title="Tag Fields"
                  expanded={expandedSections.tagFields}
                  onToggle={() => toggleSection('tagFields')}
                >
                  <View style={styles.formField}>
                    <Text style={styles.helpText}>
                      Tap a field to add or remove it from the tag. Tap * for required (red) or optional (grey). Use
                      Edit to set max length, font size, and data type. Use ↑↓ to reorder when the field is on the tag.
                      Original Price (the stored list price for each item) is always included on the tag and cannot be
                      removed. Do not add custom fields named like "price" or "asking_price" — they are blocked so the
                      tag cannot show a second number that disagrees with the stored price on the item.
                    </Text>
                    {AVAILABLE_FIELDS.map((field) => {
                      const orderIndex = formData.tagFields.findIndex((tf) => tf.field === field.name);
                      const onTag = orderIndex >= 0;
                      const isRequired = formData.requiredFields.includes(field.name);
                      const isFixedListPrice = field.name === GEAR_TAG_ITEM_LIST_PRICE_FIELD;
                      return (
                        <View key={field.name}>
                          <View style={[styles.tagFieldPillRow, onTag && styles.tagFieldPillRowOnTag]}>
                            <Pressable
                              style={styles.tagFieldPillLabelPress}
                              onPress={() => {
                                if (isFixedListPrice && onTag) {
                                  const msg =
                                    'Original Price stays on every tag because it must match the price stored on the item in the system.';
                                  if (Platform.OS === 'web') {
                                    window.alert(msg);
                                  } else {
                                    Alert.alert('Original Price', msg);
                                  }
                                  return;
                                }
                                toggleDefaultFieldOnTag(field.name);
                              }}
                              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                            >
                              <Text style={styles.tagFieldPillLabelText}>{field.label}</Text>
                              {onTag ? (
                                <Text style={styles.tagFieldPillOrderHint}>On tag · order {orderIndex + 1}</Text>
                              ) : (
                                <Text style={styles.tagFieldPillOrderHintMuted}>Tap to add to tag</Text>
                              )}
                            </Pressable>
                            {onTag ? (
                              <View style={styles.tagFieldPillReorder}>
                                <TouchableOpacity
                                  onPress={() => moveFieldByFieldName(field.name, 'up')}
                                  disabled={orderIndex === 0}
                                  style={[styles.reorderButton, orderIndex === 0 && styles.reorderButtonDisabled]}
                                >
                                  <Text style={styles.reorderButtonText}>↑</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => moveFieldByFieldName(field.name, 'down')}
                                  disabled={orderIndex === formData.tagFields.length - 1}
                                  style={[
                                    styles.reorderButton,
                                    orderIndex === formData.tagFields.length - 1 && styles.reorderButtonDisabled,
                                  ]}
                                >
                                  <Text style={styles.reorderButtonText}>↓</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                            {onTag ? (
                              <TouchableOpacity
                                style={styles.tagFieldEditButton}
                                onPress={() =>
                                  setTagFieldEditKey((k) => (k === field.name ? null : field.name))
                                }
                                activeOpacity={0.85}
                                {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                              >
                                <Text style={styles.tagFieldEditButtonText}>Edit</Text>
                              </TouchableOpacity>
                            ) : null}
                            <Pressable
                              style={({ pressed }) => [
                                styles.fieldRequiredStarWrap,
                                pressed && { opacity: 0.65 },
                              ]}
                              onPress={() => setFieldRequired(field.name, !isRequired)}
                              accessibilityRole="button"
                              accessibilityLabel={
                                isRequired ? 'Required. Tap to make optional.' : 'Optional. Tap to require.'
                              }
                              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                            >
                              <Text
                                style={[
                                  styles.fieldRequiredStarText,
                                  isRequired ? styles.fieldRequiredStarRed : styles.fieldRequiredStarGrey,
                                ]}
                              >
                                *
                              </Text>
                            </Pressable>
                          </View>
                          {onTag && tagFieldEditKey === field.name && orderIndex >= 0
                            ? renderTagFieldEditor(orderIndex)
                            : null}
                        </View>
                      );
                    })}

                    <Pressable
                      onPress={() => setShowAddFieldRow((open) => !open)}
                      style={({ pressed }) => [styles.addNewFieldButton, pressed && { opacity: 0.88 }]}
                      {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                    >
                      <Text style={styles.addNewFieldButtonText}>+ Add new field</Text>
                    </Pressable>

                    {showAddFieldRow ? (
                      <TextInput
                        style={styles.newFieldInput}
                        value={newFieldName}
                        onChangeText={setNewFieldName}
                        onSubmitEditing={addFieldFromName}
                        placeholder="Type a field name, then press Done"
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                    ) : null}

                    {!isDesktop && formData.tagFields.length > 0 && (
                      <TagPreviewMockup
                        widthMm={parseFloat(formData.widthMm) || 50}
                        heightMm={parseFloat(formData.heightMm) || 30}
                        tagFields={formData.tagFields}
                        qrCodePosition={formData.qrCodePosition}
                        qrCodeSize={parseFloat(formData.qrCodeSize) || 15}
                        availableFields={AVAILABLE_FIELDS}
                      />
                    )}

                    {formData.tagFields
                      .map((field, index) => ({ field, index }))
                      .filter(({ field }) => !AVAILABLE_FIELDS.some((f) => f.name === field.field))
                      .map(({ field, index }) => {
                        const isRequired = formData.requiredFields.includes(field.field);
                        const editorOpen = tagFieldEditKey === field.field;
                        return (
                          <View
                            key={`${field.field}-${index}`}
                            style={[styles.tagFieldCard, editorOpen && styles.tagFieldCardSelected]}
                          >
                            <View style={styles.tagFieldHeader}>
                              <Text style={styles.tagFieldName}>{field.label || field.field}</Text>
                              <View style={styles.tagFieldActions}>
                                <TouchableOpacity
                                  style={styles.tagFieldEditButton}
                                  onPress={() =>
                                    setTagFieldEditKey((k) => (k === field.field ? null : field.field))
                                  }
                                  activeOpacity={0.85}
                                  {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                                >
                                  <Text style={styles.tagFieldEditButtonText}>Edit</Text>
                                </TouchableOpacity>
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.fieldRequiredStarWrap,
                                    pressed && { opacity: 0.65 },
                                  ]}
                                  onPress={() => setFieldRequired(field.field, !isRequired)}
                                  {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                                >
                                  <Text
                                    style={[
                                      styles.fieldRequiredStarText,
                                      isRequired ? styles.fieldRequiredStarRed : styles.fieldRequiredStarGrey,
                                    ]}
                                  >
                                    *
                                  </Text>
                                </Pressable>
                                <TouchableOpacity
                                  onPress={() => moveTagField(index, 'up')}
                                  disabled={index === 0}
                                  style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                                >
                                  <Text style={styles.reorderButtonText}>↑</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => moveTagField(index, 'down')}
                                  disabled={index === formData.tagFields.length - 1}
                                  style={[
                                    styles.reorderButton,
                                    index === formData.tagFields.length - 1 && styles.reorderButtonDisabled,
                                  ]}
                                >
                                  <Text style={styles.reorderButtonText}>↓</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeTagField(index)} style={styles.removeButton}>
                                  <Text style={styles.removeButtonText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                            {editorOpen ? renderTagFieldEditor(index) : null}
                          </View>
                        );
                      })}
                  </View>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Printer & size"
                  expanded={expandedSections.printerSize}
                  onToggle={() => toggleSection('printerSize')}
                >
            <View style={styles.formField}>
              <Text style={styles.label}>Printer Brand</Text>
              <Text style={styles.helpText}>
                Select the brand of printer you use for this tag
              </Text>
              <View style={styles.brandChipsWrap}>
                <TouchableOpacity
                  style={[
                    styles.brandChip,
                    !selectedBrand && styles.brandChipSelected,
                  ]}
                  onPress={() => {
                    setSelectedBrand(undefined);
                    setFormData({ ...formData, selectedPresetId: undefined });
                  }}
                >
                  <Text
                    style={[
                      styles.brandChipText,
                      !selectedBrand && styles.brandChipTextSelected,
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
                {getBrands().map((brandInfo) => {
                  const isSelected = selectedBrand === brandInfo.brand;
                  return (
                    <TouchableOpacity
                      key={brandInfo.brand}
                      style={[
                        styles.brandChip,
                        isSelected && styles.brandChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedBrand(brandInfo.brand);
                        setFormData({ ...formData, selectedPresetId: undefined });
                      }}
                    >
                      <Text
                        style={[
                          styles.brandChipText,
                          isSelected && styles.brandChipTextSelected,
                        ]}
                      >
                        {brandInfo.brand}
                      </Text>
                      {brandInfo.model && (
                        <Text style={[styles.brandModelText, isSelected && styles.brandModelTextSelected]}>
                          {brandInfo.model}
                        </Text>
                      )}
                      <Text style={[styles.brandTechText, isSelected && styles.brandTechTextSelected]}>
                        {brandInfo.technology.charAt(0).toUpperCase() + brandInfo.technology.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {selectedBrand && (
              <View style={styles.formField}>
                <Text style={styles.label}>Label Size</Text>
                <Text style={styles.helpText}>
                  Select the size of label/sticker for {selectedBrand}
                </Text>
                <View style={styles.sizePresetChipsWrap}>
                  {getSizesByBrand(selectedBrand).map((preset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.sizePresetChip,
                        formData.selectedPresetId === preset.id && styles.sizePresetChipSelected,
                      ]}
                      onPress={() => {
                        setFormData({
                          ...formData,
                          selectedPresetId: preset.id,
                          widthMm: String(preset.widthMm),
                          heightMm: String(preset.heightMm),
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.sizePresetChipText,
                          formData.selectedPresetId === preset.id && styles.sizePresetChipTextSelected,
                        ]}
                      >
                        {preset.name}
                      </Text>
                      {preset.description && (
                        <Text
                          style={[
                            styles.sizePresetDescription,
                            formData.selectedPresetId === preset.id && styles.sizePresetDescriptionSelected,
                          ]}
                        >
                          {preset.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                {formData.selectedPresetId && (
                  <View style={styles.presetInfo}>
                    <Text style={styles.presetInfoText}>
                      {getTagSizePreset(formData.selectedPresetId)?.description || ''}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.formRow}>
              <View style={[styles.formField, styles.halfWidth]}>
                <Text style={styles.label}>Width (mm)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.widthMm}
                  onChangeText={(text) => {
                    setFormData({ ...formData, widthMm: text, selectedPresetId: undefined });
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.formField, styles.halfWidth]}>
                <Text style={styles.label}>Height (mm)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.heightMm}
                  onChangeText={(text) => {
                    setFormData({ ...formData, heightMm: text, selectedPresetId: undefined });
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Categories (optional)"
                  expanded={expandedSections.categories}
                  onToggle={() => toggleSection('categories')}
                >
            <View style={styles.formField}>
              <Text style={styles.label}>Categories (optional)</Text>
              <Text style={styles.helpText}>
                Link this template to specific categories. Leave empty to use for all categories.
              </Text>
              <View style={styles.fieldsList}>
                {flattenCategories(categories).map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.fieldChip,
                      formData.categoryIds.includes(category.id) && styles.fieldChipSelected,
                    ]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Text
                      style={[
                        styles.fieldChipText,
                        formData.categoryIds.includes(category.id) && styles.fieldChipTextSelected,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
                </CollapsibleSection>

                <CollapsibleSection
                  title="QR code"
                  expanded={expandedSections.qrCode}
                  onToggle={() => toggleSection('qrCode')}
                >
            <View style={styles.formField}>
              <Text style={styles.label}>QR Code</Text>
              <Text style={styles.helpText}>
                Configure size and position. QR codes are always included on sticker tags.
              </Text>
              <View style={styles.formRow}>
                <View style={[styles.formField, styles.halfWidth]}>
                  <Text style={styles.smallLabel}>Size (mm)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.qrCodeSize}
                    onChangeText={(text) => setFormData({ ...formData, qrCodeSize: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formField, styles.halfWidth]}>
                  <Text style={styles.smallLabel}>Position</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {QR_POSITIONS.map((pos) => (
                      <TouchableOpacity
                        key={pos.value}
                        style={[
                          styles.chip,
                          formData.qrCodePosition === pos.value && styles.chipSelected,
                        ]}
                        onPress={() => setFormData({ ...formData, qrCodePosition: pos.value })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.qrCodePosition === pos.value && styles.chipTextSelected,
                          ]}
                        >
                          {pos.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Default template"
                  expanded={expandedSections.defaultTemplate}
                  onToggle={() => toggleSection('defaultTemplate')}
                >
            <View style={styles.formField}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Set as Default Template</Text>
                <Switch
                  value={formData.isDefault}
                  onValueChange={(val) => setFormData({ ...formData, isDefault: val })}
                />
              </View>
            </View>
                </CollapsibleSection>

                <View style={styles.formActions}>
              <Pressable
                onPress={resetForm}
                disabled={savingTag}
                style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }, savingTag && { opacity: 0.6 }]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  console.log('[GearTags] Save button onPress fired');
                  handleSave();
                }}
                disabled={savingTag}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && { opacity: 0.85 },
                  savingTag && styles.saveButtonDisabled,
                ]}
              >
                {savingTag ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Tag</Text>
                )}
              </Pressable>
            </View>
              </ScrollView>

              {/* Right column: sticky tag preview (desktop only) */}
              {isDesktop && (
                <View
                  style={[
                    styles.stickyPreviewColumn,
                    useStickyPreview ? styles.stickyPreviewPinned : styles.stickyPreviewInline,
                  ]}
                >
                  {formData.tagFields.length > 0 ? (
                    <TagPreviewMockup
                      widthMm={parseFloat(formData.widthMm) || 50}
                      heightMm={parseFloat(formData.heightMm) || 30}
                      tagFields={formData.tagFields}
                      qrCodePosition={formData.qrCodePosition}
                      qrCodeSize={parseFloat(formData.qrCodeSize) || 15}
                      availableFields={AVAILABLE_FIELDS}
                    />
                  ) : (
                    <View style={styles.previewPlaceholder}>
                      <Text style={styles.previewPlaceholderText}>Add tag fields to see preview</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        ) : showCreateOptions ? (
          /* Create Options Selection */
          <View style={styles.optionsContainer}>
            <Pressable
              onPress={() => {
                setShowCreateOptions(false);
                setEditingTemplate(null);
              }}
              style={({ pressed }) => [styles.backToMainButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.backToMainButtonText}>← Back</Text>
            </Pressable>
            <Text style={styles.optionsTitle}>What would you like to set up?</Text>
            <Text style={styles.optionsSubtitle}>
              Choose how you'd like to configure your new tag
            </Text>
            
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                // TODO: Navigate to item registration information setup
                setShowCreateOptions(false);
                setShowAddForm(true);
              }}
            >
              <Text style={styles.optionTitle}>Set item registration information</Text>
              <Text style={styles.optionDescription}>
                Create form fields that collect information from sellers during item registration. You can also include fixed information for this tag type (e.g., "items with this tag type go on sale at 4:00 PM"). This is the information collected during registration, not necessarily what appears on the tag.
              </Text>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                // TODO: Navigate to tag fields setup
                setShowCreateOptions(false);
                setShowAddForm(true);
              }}
            >
              <Text style={styles.optionTitle}>Set tag fields</Text>
              <Text style={styles.optionDescription}>
                Configure everything that is actually printed on the physical tag. Fields created in "Set item registration information" will appear as options here. You won't be able to create similar-sounding fields to avoid duplicates.
              </Text>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Create New Tag Button */}
            <View style={styles.createButtonContainer}>
            <Pressable
              onPress={createNewTag}
              disabled={creatingTag}
              style={({ pressed }) => [
                styles.createButton,
                creatingTag && styles.createButtonDisabled,
                pressed && !creatingTag && styles.createButtonPressed,
              ]}
            >
              {creatingTag ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Create new tag template</Text>
              )}
            </Pressable>
            </View>

            {/* Existing Tags List */}
            {templates.length > 0 && (
              <View style={styles.templatesList}>
                <Text style={styles.sectionTitle}>Existing Tags</Text>
                {templates.map((template) => (
                  <View key={template.id} style={styles.templateLink}>
                    <TouchableOpacity
                      style={styles.templateLinkTouchable}
                      onPress={() => handleEdit(template)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.templateLinkContent}>
                        <View style={styles.templateLinkLeft}>
                          <Text style={styles.templateLinkName}>{template.name}</Text>
                          {template.isDefault && (
                            <Text style={styles.defaultBadge}>Default</Text>
                          )}
                          {!template.isActive && (
                            <Text style={styles.inactiveBadge}>Inactive</Text>
                          )}
                        </View>
                        <Text style={styles.templateLinkArrow}>→</Text>
                      </View>
                      {template.description && (
                        <Text style={styles.templateLinkDescription}>{template.description}</Text>
                      )}
                    </TouchableOpacity>
                    <Pressable
                      style={({ pressed }) => [
                        styles.templateDeleteButton,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={(e) => {
                        console.log('[GearTags] Delete button onPress fired for template', { templateId: template.id, templateName: template.name });
                        if (typeof (e as unknown as { stopPropagation?: () => void }).stopPropagation === 'function') {
                          (e as unknown as { stopPropagation: () => void }).stopPropagation();
                        }
                        handleDelete(template);
                      }}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {templates.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No tag templates yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  {`Tap "Create new tag template" to get started`}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    gap: 4,
  },
  headerBreadcrumbs: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  backButton: {
    padding: 8,
    minWidth: 56,
    minHeight: 44,
    justifyContent: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerSpacer: {
    width: 56,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    ...cardShadow,
  },
  formCardDesktop: {
    margin: 20,
    maxWidth: 1400,
    alignSelf: 'center',
  },
  formLayoutDesktop: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  formLayoutMobile: {},
  formConfigScroll: {
    flex: 1,
    minWidth: 0,
    maxWidth: 600,
  },
  formConfigContent: {
    paddingBottom: 24,
  },
  stickyPreviewColumn: {
    width: 320,
    flexShrink: 0,
  },
  stickyPreviewPinned: {
    ...(Platform.OS === 'web' && ({ position: 'sticky', top: 24 } as any)),
  },
  stickyPreviewInline: {
    position: 'relative',
  },
  previewPlaceholder: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 24,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  previewPlaceholderText: {
    fontSize: 14,
    color: '#999',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  formField: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  smallLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: {
    minHeight: 80,
  },
  smallInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  tagFieldCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tagFieldCardSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  tagFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagFieldActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderButton: {
    padding: 4,
    minWidth: 32,
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 6,
  },
  reorderButtonDisabled: {
    opacity: 0.4,
  },
  reorderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tagFieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 20,
    color: '#DC3545',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagFieldHideLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingTop: 4,
  },
  tagFieldHideLabelTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  newFieldInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  tagFieldPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
    marginBottom: 8,
  },
  tagFieldPillRowOnTag: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F7FF',
  },
  tagFieldPillLabelPress: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
  },
  tagFieldPillLabelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  tagFieldPillOrderHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  tagFieldPillOrderHintMuted: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  tagFieldPillReorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  fieldRequiredStarWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  fieldRequiredStarText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
  fieldRequiredStarRed: {
    color: '#DC3545',
  },
  fieldRequiredStarGrey: {
    color: '#B0B0B0',
  },
  addNewFieldButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  addNewFieldButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  tagFieldEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 4,
    borderRadius: 8,
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: '#B3D9FF',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  tagFieldEditButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  tagFieldEditorPanel: {
    marginBottom: 12,
    marginTop: 4,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  tagFieldEditorSubmitRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  tagFieldEditorSubmitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagFieldEditorSubmitButtonPressed: {
    opacity: 0.88,
  },
  tagFieldEditorSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dataTypeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dataTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dataTypeChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dataTypeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dataTypeChipTextSelected: {
    color: '#FFFFFF',
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dropdownOptionInput: {
    flex: 1,
    minWidth: 0,
  },
  dropdownOptionRemove: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFE5E5',
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  dropdownOptionRemoveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC3545',
  },
  addDropdownOptionButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  addDropdownOptionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  fieldsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  fieldChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  fieldChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  fieldChipText: {
    fontSize: 14,
    color: '#666',
  },
  fieldChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  createButtonContainer: {
    padding: 20,
    paddingTop: 24,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...cardShadow,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
    } as any),
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonPressed: {
    opacity: 0.85,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templatesList: {
    padding: 20,
    paddingTop: 0,
  },
  templateLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  templateLinkTouchable: {
    flex: 1,
    padding: 16,
  },
  templateDeleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E5E5',
    backgroundColor: '#FFE5E5',
    zIndex: 1,
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  templateLinkContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateLinkLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  templateLinkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  templateLinkArrow: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
  },
  templateLinkDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  templateHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  templateName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  defaultBadge: {
    fontSize: 12,
    color: '#4CAF50',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inactiveBadge: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
  },
  editButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFE5E5',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#DC3545',
    fontWeight: '600',
  },
  templateDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  templateInfo: {
    marginTop: 8,
  },
  templateInfoText: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  brandChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 12,
  },
  sizePresetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 12,
  },
  brandChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    minWidth: 100,
  },
  brandChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  brandChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  brandChipTextSelected: {
    color: '#FFFFFF',
  },
  brandModelText: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  brandModelTextSelected: {
    color: '#E3F2FD',
  },
  brandTechText: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  brandTechTextSelected: {
    color: '#E3F2FD',
  },
  sizePresetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  sizePresetChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sizePresetChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  sizePresetChipTextSelected: {
    color: '#FFFFFF',
  },
  sizePresetDescription: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
  },
  sizePresetDescriptionSelected: {
    color: '#E3F2FD',
  },
  presetInfo: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  presetInfoText: {
    fontSize: 12,
    color: '#1976D2',
    fontStyle: 'italic',
  },
  qrCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#E8F5E9',
  },
  infoBadgeText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 8,
  },
  optionsContainer: {
    padding: 20,
  },
  backToMainButton: {
    marginBottom: 20,
    padding: 8,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  backToMainButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  optionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  optionsSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    ...cardShadow,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  optionArrow: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
});

