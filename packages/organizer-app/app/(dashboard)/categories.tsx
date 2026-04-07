import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Switch, Platform } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, getOrganizationCategories, createCategory, updateCategory, deleteCategory, getOrganizationGearTagTemplates, getCategoryFieldDefinitions, createFieldDefinition, updateFieldDefinition, deleteFieldDefinition, type ItemCategory, type GearTagTemplate, type FieldType } from 'shared';
import { useState, useEffect } from 'react';

interface CategoryAttribute {
  id?: string;
  name: string;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
}

export default function CategoriesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [gearTags, setGearTags] = useState<GearTagTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [selectedGearTagId, setSelectedGearTagId] = useState<string | undefined>(undefined);
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [newAttribute, setNewAttribute] = useState<CategoryAttribute>({
    name: '',
    label: '',
    fieldType: 'text',
    isRequired: false,
  });
  const [showAttributeForm, setShowAttributeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [originalFieldIds, setOriginalFieldIds] = useState<string[]>([]);

  const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'decimal', label: 'Decimal' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
  ];

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);
  useEffect(() => {
    loadCategories();
    loadGearTags();
  }, [organization]);

  const loadCategories = async () => {
    if (!organization) return;
    
    setLoading(true);
    try {
      const data = await getOrganizationCategories(organization.id);
      setCategories(data);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadGearTags = async () => {
    if (!organization) return;
    
    try {
      const data = await getOrganizationGearTagTemplates(organization.id);
      setGearTags(data);
    } catch (error) {
      console.error('Failed to load gear tags:', error);
    }
  };

  const handleAddCategory = () => {
    // Check if gear tags exist, redirect if not
    if (gearTags.length === 0) {
      Alert.alert(
        'No Gear Tags',
        'You need to create a gear tag before creating a category. Would you like to create one now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Gear Tag',
            onPress: () => {
              router.push('/(dashboard)/gear-tags');
            },
          },
        ]
      );
      return;
    }
    resetForm();
    setShowAddModal(true);
  };

  const showError = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSaveCategory = async () => {
    if (!organization) {
      showError('Error', 'Organization not loaded. Please refresh and try again.');
      return;
    }
    if (!categoryName.trim()) {
      showError('Error', 'Please enter a category name');
      return;
    }
    if (!selectedGearTagId) {
      showError('Error', 'Please select a gear tag for this category');
      return;
    }

    setSaving(true);
    try {
      if (editingCategoryId) {
        await updateCategory(editingCategoryId, {
          name: categoryName.trim(),
          gearTagTemplateId: selectedGearTagId,
        });
        const normalizedAttrs = attributes.map((attr) => ({
          id: attr.id,
          name: attr.name.trim().toLowerCase().replace(/\s+/g, '_'),
          label: attr.label.trim(),
          fieldType: attr.fieldType,
          isRequired: attr.isRequired,
        }));
        const idsToDelete = originalFieldIds.filter(
          (id) => !attributes.some((a) => a.id === id)
        );
        for (const id of idsToDelete) {
          await deleteFieldDefinition(id);
        }
        for (const attr of normalizedAttrs) {
          if (attr.id) {
            await updateFieldDefinition(attr.id, {
              label: attr.label,
              fieldType: attr.fieldType,
              isRequired: attr.isRequired,
            });
          } else {
            await createFieldDefinition(organization.id, {
              name: attr.name,
              label: attr.label,
              fieldType: attr.fieldType,
              isRequired: attr.isRequired,
              categoryId: editingCategoryId,
            });
          }
        }
      } else {
        await createCategory(organization.id, {
          name: categoryName.trim(),
          gearTagTemplateId: selectedGearTagId,
          fieldDefinitions: attributes.map((attr) => ({
            name: attr.name.trim().toLowerCase().replace(/\s+/g, '_'),
            label: attr.label.trim(),
            fieldType: attr.fieldType,
            isRequired: attr.isRequired,
          })),
        });
      }
      await loadCategories();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : (editingCategoryId ? 'Failed to update category' : 'Failed to create category');
      console.error('[Categories] save category error:', error);
      showError('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCategoryName('');
    setSelectedGearTagId(undefined);
    setAttributes([]);
    setNewAttribute({
      name: '',
      label: '',
      fieldType: 'text',
      isRequired: false,
    });
    setShowAttributeForm(false);
    setEditingCategoryId(null);
    setOriginalFieldIds([]);
  };

  const handleEditCategory = async (category: ItemCategory) => {
    if (gearTags.length === 0) {
      Alert.alert(
        'No Gear Tags',
        'You need at least one gear tag. Would you like to create one first?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Gear Tag', onPress: () => router.push('/(dashboard)/gear-tags') },
        ]
      );
      return;
    }
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setSelectedGearTagId(category.gearTagTemplateId ?? undefined);
    try {
      const defs = await getCategoryFieldDefinitions(category.id);
      setAttributes(
        defs.map((d) => ({
          id: d.id,
          name: d.name,
          label: d.label,
          fieldType: d.fieldType as FieldType,
          isRequired: d.isRequired,
        }))
      );
      setOriginalFieldIds(defs.map((d) => d.id));
    } catch (error) {
      console.error('[Categories] Failed to load field definitions:', error);
      setAttributes([]);
      setOriginalFieldIds([]);
    }
    setShowAddModal(true);
  };

  const handleAddAttribute = () => {
    if (!newAttribute.name.trim() || !newAttribute.label.trim()) {
      Alert.alert('Error', 'Please enter both name and label for the attribute');
      return;
    }
    setAttributes([...attributes, { ...newAttribute }]);
    setNewAttribute({
      name: '',
      label: '',
      fieldType: 'text',
      isRequired: false,
    });
    setShowAttributeForm(false);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleToggleCategory = async (category: ItemCategory) => {
    if (!organization) return;
    
    try {
      await updateCategory(category.id, { isActive: !category.isActive });
      await loadCategories();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update category');
    }
  };

  const handleDeleteCategory = (category: ItemCategory) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              await loadCategories();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const renderCategory = (category: ItemCategory, level: number = 0) => {
    const indent = level * 20;
    
    return (
      <View key={category.id} style={[styles.categoryItem, { marginLeft: indent }]}>
        <View style={styles.categoryContent}>
          <View style={styles.categoryLeft}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {!category.isActive && (
              <Text style={styles.inactiveBadge}>Inactive</Text>
            )}
          </View>
          <View style={styles.categoryActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditCategory(category)}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToggleCategory(category)}
            >
              <Text style={styles.actionButtonText}>
                {category.isActive ? 'Disable' : 'Enable'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteCategory(category)}
            >
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
        {category.children && category.children.length > 0 && (
          <View style={styles.childrenContainer}>
            {category.children.map((child) => renderCategory(child, level + 1))}
          </View>
        )}
      </View>
    );
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
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              router.back();
            } else {
              router.replace('/(dashboard)');
            }
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity onPress={handleAddCategory} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No categories yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add your first category to get started
            </Text>
          </View>
        ) : (
          <View style={styles.categoriesList}>
            {categories.map((category) => renderCategory(category))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingCategoryId ? 'Edit Category' : 'New Category'}</Text>
            <TouchableOpacity
              onPress={handleSaveCategory}
              style={[styles.modalSaveButton, saving && styles.modalSaveButtonDisabled]}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#007AFF" style={styles.saveSpinner} />
              ) : null}
              <Text style={[styles.modalSaveButtonText, saving && styles.modalSaveButtonTextDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.label}>Category Name *</Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="e.g., Bikes"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Gear Tag *</Text>
              <Text style={styles.helpText}>
                Select a gear tag template for this category
              </Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setShowAddModal(false);
                  router.push('/(dashboard)/gear-tags');
                }}
              >
                <Text style={styles.linkButtonText}>Make a new gear tag</Text>
              </TouchableOpacity>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {gearTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.chip,
                      selectedGearTagId === tag.id && styles.chipSelected,
                    ]}
                    onPress={() => setSelectedGearTagId(tag.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedGearTagId === tag.id && styles.chipTextSelected,
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {gearTags.length === 0 && (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => {
                    setShowAddModal(false);
                    router.push('/(dashboard)/gear-tags');
                  }}
                >
                  <Text style={styles.linkButtonText}>Create Gear Tag</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Attributes</Text>
                <TouchableOpacity
                  style={styles.addButtonSmall}
                  onPress={() => setShowAttributeForm(true)}
                >
                  <Text style={styles.addButtonSmallText}>+ Add Attribute</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>
                Define what information to collect from sellers for this category
              </Text>

              {attributes.map((attr, index) => (
                <View key={index} style={styles.attributeItem}>
                  <View style={styles.attributeInfo}>
                    <Text style={styles.attributeLabel}>{attr.label}</Text>
                    <Text style={styles.attributeType}>{attr.fieldType}</Text>
                    {attr.isRequired && (
                      <Text style={styles.requiredBadge}>Required</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveAttribute(index)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {showAttributeForm && (
                <View style={styles.attributeForm}>
                  <TextInput
                    style={styles.input}
                    value={newAttribute.name}
                    onChangeText={(text) =>
                      setNewAttribute({ ...newAttribute, name: text })
                    }
                    placeholder="Field name (e.g., year)"
                    placeholderTextColor="#999"
                  />
                  <TextInput
                    style={styles.input}
                    value={newAttribute.label}
                    onChangeText={(text) =>
                      setNewAttribute({ ...newAttribute, label: text })
                    }
                    placeholder="Display label (e.g., Year)"
                    placeholderTextColor="#999"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {FIELD_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.chip,
                          newAttribute.fieldType === type.value && styles.chipSelected,
                        ]}
                        onPress={() =>
                          setNewAttribute({ ...newAttribute, fieldType: type.value })
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            newAttribute.fieldType === type.value && styles.chipTextSelected,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Required</Text>
                    <Switch
                      value={newAttribute.isRequired}
                      onValueChange={(value) =>
                        setNewAttribute({ ...newAttribute, isRequired: value })
                      }
                    />
                  </View>
                  <View style={styles.attributeFormActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowAttributeForm(false);
                        setNewAttribute({
                          name: '',
                          label: '',
                          fieldType: 'text',
                          isRequired: false,
                        });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleAddAttribute}
                    >
                      <Text style={styles.saveButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  addButton: {
    padding: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  categoriesList: {
    padding: 16,
  },
  categoryItem: {
    marginBottom: 8,
  },
  categoryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 8,
  },
  inactiveBadge: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  deleteButtonText: {
    color: '#DC3545',
  },
  childrenContainer: {
    marginTop: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  modalSaveButton: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  saveSpinner: {
    marginRight: 0,
  },
  modalSaveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalSaveButtonTextDisabled: {
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 12,
  },
  chipScroll: {
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  linkButton: {
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  addButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  addButtonSmallText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  attributeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  attributeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attributeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  attributeType: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadge: {
    fontSize: 10,
    color: '#DC3545',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFE5E5',
    borderRadius: 6,
  },
  removeButtonText: {
    fontSize: 12,
    color: '#DC3545',
    fontWeight: '600',
  },
  attributeForm: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  attributeFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});










