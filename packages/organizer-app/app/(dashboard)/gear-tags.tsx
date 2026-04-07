import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, getOrganizationGearTagTemplates, createGearTagTemplate, updateGearTagTemplate, deleteGearTagTemplate, getOrganizationCategories, TAG_SIZE_PRESETS, getBrands, getSizesByBrand, getTagSizePreset, AVAILABLE_QR_CODE_FIELDS, getQRCodeFieldsByCategory, type GearTagTemplate, type TagField, type TagLayoutType, type QRCodePosition } from 'shared';
import { useState, useEffect } from 'react';
import TagPreviewMockup from '../../components/TagPreviewMockup';
import { cardShadow } from '../../lib/theme';

const DESKTOP_BREAKPOINT = 768;

const QR_POSITIONS: { value: QRCodePosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'center', label: 'Center' },
];

// Common item fields that can appear on tags
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
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [templates, setTemplates] = useState<GearTagTemplate[]>([]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basicInfo: true,
    printerSize: true,
    tagFields: true,
    requiredFields: true,
    categories: true,
    qrCode: true,
    defaultTemplate: true,
  });
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
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | undefined>(undefined);
  const [newFieldName, setNewFieldName] = useState('');

  const [selectedBrand, setSelectedBrand] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
  useEffect(() => {
    if (organization) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [organization]);

  const loadData = async () => {
    if (!organization) return;

    setLoading(true);
    try {
      const [templatesData, categoriesData] = await Promise.all([
        getOrganizationGearTagTemplates(organization.id),
        getOrganizationCategories(organization.id),
      ]);

      setTemplates(templatesData);
      setCategories(categoriesData);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

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
      const newTemplate = await createGearTagTemplate(organization.id, {
        name,
        tagFields: [],
        requiredFields: [],
      });
      setEditingTemplate(newTemplate);
      setFormData({
        name: newTemplate.name,
        description: newTemplate.description || '',
        layoutType: newTemplate.layoutType,
        selectedPresetId: undefined,
        widthMm: String(newTemplate.widthMm),
        heightMm: String(newTemplate.heightMm),
        tagFields: newTemplate.tagFields,
        requiredFields: newTemplate.requiredFields,
        categoryIds: newTemplate.categoryIds || [],
        fontFamily: newTemplate.fontFamily,
        fontSize: String(newTemplate.fontSize),
        borderWidth: String(newTemplate.borderWidth),
        qrCodeSize: String(newTemplate.qrCodeSize),
        qrCodePosition: newTemplate.qrCodePosition,
        qrCodeEnabled: newTemplate.qrCodeEnabled,
        qrCodeDataFields: newTemplate.qrCodeDataFields || ['item_number'],
        qrCodeSellerAccess: newTemplate.qrCodeSellerAccess || [],
        isDefault: newTemplate.isDefault,
      });
      await loadData();
      setShowCreateOptions(true);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  };

  const resetForm = () => {
    setSelectedBrand(undefined);
    setFormData({
      name: '',
      description: '',
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

    console.log('[GearTags] Validation passed, calling API...', { editingTemplateId: editingTemplate?.id, formDataName: formData.name });
    setSavingTag(true);
    try {
      if (editingTemplate) {
        await updateGearTagTemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description || undefined,
          layoutType: formData.layoutType,
          widthMm: parseFloat(formData.widthMm),
          heightMm: parseFloat(formData.heightMm),
          tagFields: formData.tagFields,
          requiredFields: formData.requiredFields,
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
          description: formData.description || undefined,
          layoutType: formData.layoutType,
          widthMm: parseFloat(formData.widthMm),
          heightMm: parseFloat(formData.heightMm),
          tagFields: formData.tagFields,
          requiredFields: formData.requiredFields,
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

      // Redirect to gear-tags main view (ensures clean URL on web)
      router.replace('/(dashboard)/gear-tags');

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
      const { position, ...rest } = f;
      return {
        ...rest,
        maxLength: f.maxLength ?? 30,
      };
    });

  const handleEdit = (template: GearTagTemplate) => {
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
      description: template.description || '',
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

    const newField: TagField = {
      field: fieldKey,
      label,
      maxLength: 30,
      fontSize: 10,
      fontWeight: 'normal',
      required: false,
    };
    const newIndex = formData.tagFields.length;
    setFormData({
      ...formData,
      tagFields: [...formData.tagFields, newField],
    });
    setSelectedFieldIndex(newIndex);
    setNewFieldName('');
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
    setSelectedFieldIndex(newIndex);
  };

  const removeTagField = (index: number) => {
    setFormData({
      ...formData,
      tagFields: formData.tagFields.filter((_, i) => i !== index),
      requiredFields: formData.requiredFields.filter(
        (f) => f !== formData.tagFields[index].field
      ),
    });
  };

  const toggleRequiredField = (fieldName: string) => {
    const isAdding = !formData.requiredFields.includes(fieldName);
    console.log('[GearTags] toggleRequiredField', { fieldName, isAdding, currentRequired: formData.requiredFields, currentTagFieldsCount: formData.tagFields.length });

    const newRequiredFields = isAdding
      ? [...formData.requiredFields, fieldName]
      : formData.requiredFields.filter((f) => f !== fieldName);

    let newTagFields = formData.tagFields;

    if (isAdding) {
      const alreadyOnTag = formData.tagFields.some((tf) => tf.field === fieldName);
      if (!alreadyOnTag) {
        const known = AVAILABLE_FIELDS.find((f) => f.name === fieldName);
        const label = known ? (known.defaultLabel || known.label) : fieldName;
        const newField: TagField = {
          field: fieldName,
          label,
          maxLength: 30,
          fontSize: 10,
          fontWeight: 'normal',
          required: true,
        };
        newTagFields = [...formData.tagFields, newField];
        console.log('[GearTags] Added tag field for required field', { fieldName, tagFieldsCount: newTagFields.length });
      }
    }

    setFormData({
      ...formData,
      requiredFields: newRequiredFields,
      tagFields: newTagFields,
    });
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
        <Text style={styles.title}>Gear Tags</Text>
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
                <CollapsibleSection
                  title="Basic info"
                  expanded={expandedSections.basicInfo}
                  onToggle={() => toggleSection('basicInfo')}
                >
                  <View style={styles.formField}>
                    <Text style={styles.label}>Template Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
                      placeholder="e.g., Bike Tag, Skis Tag"
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={formData.description}
                      onChangeText={(text) => setFormData({ ...formData, description: text })}
                      placeholder="Optional description"
                      multiline
                    />
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.sizePresetsScroll}
              >
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
              </ScrollView>
            </View>

            {selectedBrand && (
              <View style={styles.formField}>
                <Text style={styles.label}>Label Size</Text>
                <Text style={styles.helpText}>
                  Select the size of label/sticker for {selectedBrand}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.sizePresetsScroll}
                >
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
                </ScrollView>
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
                  title="Tag fields"
                  expanded={expandedSections.tagFields}
                  onToggle={() => toggleSection('tagFields')}
                >
            <View style={styles.formField}>
              <Text style={styles.label}>Tag Fields</Text>
              <Text style={styles.helpText}>
                Type a field name and press Enter to add. Drag order with ↑↓. Fields display on the tag in list order with word wrap.
              </Text>
              <TextInput
                style={styles.newFieldInput}
                value={newFieldName}
                onChangeText={setNewFieldName}
                onSubmitEditing={addFieldFromName}
                placeholder="e.g. Item Number, description, Size"
                returnKeyType="done"
                blurOnSubmit={false}
              />
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
              {formData.tagFields.map((field, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.8}
                  onPress={() => setSelectedFieldIndex(index)}
                  style={[
                    styles.tagFieldCard,
                    selectedFieldIndex === index && styles.tagFieldCardSelected,
                  ]}
                >
                  <View style={styles.tagFieldHeader}>
                    <Text style={styles.tagFieldName}>
                      {AVAILABLE_FIELDS.find((f) => f.name === field.field)?.label || field.label || field.field}
                    </Text>
                    <View style={styles.tagFieldActions}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          moveTagField(index, 'up');
                        }}
                        disabled={index === 0}
                        style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                      >
                        <Text style={styles.reorderButtonText}>↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          moveTagField(index, 'down');
                        }}
                        disabled={index === formData.tagFields.length - 1}
                        style={[
                          styles.reorderButton,
                          index === formData.tagFields.length - 1 && styles.reorderButtonDisabled,
                        ]}
                      >
                        <Text style={styles.reorderButtonText}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          removeTagField(index);
                        }}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <View style={[styles.formField, styles.halfWidth]}>
                      <Text style={styles.smallLabel}>Label</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={field.label || ''}
                        onChangeText={(text) => updateTagField(index, { label: text })}
                        placeholder="Display label"
                      />
                    </View>
                    <View style={[styles.formField, styles.halfWidth]}>
                      <Text style={styles.smallLabel}>Font Size</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={String(field.fontSize || 10)}
                        onChangeText={(text) => updateTagField(index, { fontSize: parseFloat(text) || 10 })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.smallLabel}>Max Characters</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={String(field.maxLength ?? 30)}
                      onChangeText={(text) =>
                        updateTagField(index, { maxLength: Math.max(1, parseInt(text, 10) || 30) })
                      }
                      placeholder="30"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.smallLabel}>Required on tag</Text>
                    <Switch
                      value={field.required || false}
                      onValueChange={(val) => {
                        updateTagField(index, { required: val });
                        if (val) toggleRequiredField(field.field);
                      }}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Required fields"
                  expanded={expandedSections.requiredFields}
                  onToggle={() => toggleSection('requiredFields')}
                >
            <View style={styles.formField}>
              <Text style={styles.label}>Required Fields</Text>
              <Text style={styles.helpText}>
                Information you are requiring sellers to provide for this tag type.
              </Text>
              <View style={styles.fieldsList}>
                {AVAILABLE_FIELDS.map((field) => (
                  <TouchableOpacity
                    key={field.name}
                    style={[
                      styles.fieldChip,
                      formData.requiredFields.includes(field.name) && styles.fieldChipSelected,
                    ]}
                    onPress={() => toggleRequiredField(field.name)}
                  >
                    <Text
                      style={[
                        styles.fieldChipText,
                        formData.requiredFields.includes(field.name) && styles.fieldChipTextSelected,
                      ]}
                    >
                      {field.label}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
              </ScrollView>

              {/* Right column: sticky tag preview (desktop only) */}
              {isDesktop && (
                <View style={styles.stickyPreviewColumn}>
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
                <Text style={styles.createButtonText}>Create New Tag</Text>
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
                  Tap "Create New Tag" to get started
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
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer', userSelect: 'none' } as any),
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
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
    ...(Platform.OS === 'web' && ({ position: 'sticky', top: 24 } as any)),
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
  sizePresetsScroll: {
    marginHorizontal: -4,
    marginBottom: 12,
  },
  brandChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
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
    marginRight: 8,
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

