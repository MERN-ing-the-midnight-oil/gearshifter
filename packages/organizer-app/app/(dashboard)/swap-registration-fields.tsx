import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, getOrganizationSwapRegistrationFields, createSwapRegistrationFieldDefinition, updateSwapRegistrationFieldDefinition, deleteSwapRegistrationFieldDefinition, enableSuggestedField, SUGGESTED_FIELDS, getSwapRegistrationPageSettings, saveSwapRegistrationPageSettings, type SwapRegistrationFieldDefinition, type FieldType, type FieldGroup } from 'shared';
import { useState, useEffect } from 'react';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
];

export default function SwapRegistrationFieldsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [fields, setFields] = useState<SwapRegistrationFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingField, setEditingField] = useState<SwapRegistrationFieldDefinition | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    label: '',
    fieldType: 'text' as FieldType,
    isRequired: false,
    isOptional: true,
    placeholder: '',
    helpText: '',
    defaultValue: '',
    options: [] as string[],
  });

  const [pageFormData, setPageFormData] = useState({
    pageTitle: 'Register for Swap',
    pageDescription: '',
    welcomeMessage: '',
    fieldGroups: [] as FieldGroup[],
  });
  const [savingPage, setSavingPage] = useState(false);

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);
  useEffect(() => {
    loadData();
  }, [organization]);

  const loadData = async () => {
    if (!organization) return;

    setLoading(true);
    try {
      const [fieldData, pageSettings] = await Promise.all([
        getOrganizationSwapRegistrationFields(organization.id),
        getSwapRegistrationPageSettings(organization.id),
      ]);
      setFields(fieldData);

      if (pageSettings) {
        setPageFormData({
          pageTitle: pageSettings.pageTitle,
          pageDescription: pageSettings.pageDescription || '',
          welcomeMessage: pageSettings.welcomeMessage || '',
          fieldGroups: pageSettings.fieldGroups || [],
        });
      } else {
        setPageFormData({
          pageTitle: 'Register for Swap',
          pageDescription: '',
          welcomeMessage: '',
          fieldGroups: fieldData.length > 0 ? [{
            id: 'default',
            title: 'Registration Information',
            fields: fieldData.map((f) => f.name),
            order: 0,
          }] : [],
        });
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async () => {
    await loadData();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      fieldType: 'text',
      isRequired: false,
      isOptional: true,
      placeholder: '',
      helpText: '',
      defaultValue: '',
      options: [],
    });
    setShowAddForm(false);
    setEditingField(null);
  };

  const handleEnableSuggestedField = async (suggestedFieldType: string) => {
    if (!organization) return;

    try {
      await enableSuggestedField(organization.id, suggestedFieldType as any, {
        isOptional: true, // Suggested fields are optional by default
      });
      await loadFields();
      Alert.alert('Success', 'Suggested field enabled');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to enable suggested field');
    }
  };

  const handleSave = async () => {
    if (!organization) return;
    
    if (!formData.name.trim() || !formData.label.trim()) {
      Alert.alert('Error', 'Name and label are required');
      return;
    }

    // Validate name format (should be snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(formData.name)) {
      Alert.alert('Error', 'Field name must be lowercase with underscores (e.g., seller_address)');
      return;
    }

    try {
      if (editingField) {
        await updateSwapRegistrationFieldDefinition(editingField.id, {
          label: formData.label,
          fieldType: formData.fieldType,
          isRequired: formData.isRequired,
          isOptional: formData.isOptional,
          placeholder: formData.placeholder || undefined,
          helpText: formData.helpText || undefined,
          defaultValue: formData.defaultValue || undefined,
          options: formData.fieldType === 'dropdown' ? formData.options : undefined,
        });
      } else {
        await createSwapRegistrationFieldDefinition(organization.id, {
          name: formData.name,
          label: formData.label,
          fieldType: formData.fieldType,
          isRequired: formData.isRequired,
          isOptional: formData.isOptional,
          placeholder: formData.placeholder || undefined,
          helpText: formData.helpText || undefined,
          defaultValue: formData.defaultValue || undefined,
          options: formData.fieldType === 'dropdown' ? formData.options : undefined,
        });
      }
      
      resetForm();
      await loadFields();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save field');
    }
  };

  const handleEdit = (field: SwapRegistrationFieldDefinition) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      label: field.label,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      isOptional: field.isOptional,
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      defaultValue: field.defaultValue || '',
      options: field.options || [],
    });
    setShowAddForm(true);
  };

  const handleDelete = (field: SwapRegistrationFieldDefinition) => {
    Alert.alert(
      'Delete Field',
      `Are you sure you want to delete "${field.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSwapRegistrationFieldDefinition(field.id);
              await loadFields();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete field');
            }
          },
        },
      ]
    );
  };

  const addDropdownOption = () => {
    Alert.prompt(
      'Add Option',
      'Enter option value:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (value) => {
            if (value?.trim()) {
              setFormData({
                ...formData,
                options: [...formData.options, value.trim()],
              });
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Page layout
  const addFieldGroup = () => {
    const newGroup: FieldGroup = {
      id: `group_${Date.now()}`,
      title: 'New Section',
      fields: [],
      order: pageFormData.fieldGroups.length,
    };
    setPageFormData({
      ...pageFormData,
      fieldGroups: [...pageFormData.fieldGroups, newGroup],
    });
  };

  const updateFieldGroup = (groupId: string, updates: Partial<FieldGroup>) => {
    setPageFormData({
      ...pageFormData,
      fieldGroups: pageFormData.fieldGroups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      ),
    });
  };

  const deleteFieldGroup = (groupId: string) => {
    setPageFormData({
      ...pageFormData,
      fieldGroups: pageFormData.fieldGroups.filter((g) => g.id !== groupId),
    });
  };

  const toggleFieldInGroup = (groupId: string, fieldName: string) => {
    const group = pageFormData.fieldGroups.find((g) => g.id === groupId);
    if (!group) return;
    const hasField = group.fields.includes(fieldName);
    updateFieldGroup(groupId, {
      fields: hasField
        ? group.fields.filter((f) => f !== fieldName)
        : [...group.fields, fieldName],
    });
  };

  const getUnassignedFields = () => {
    const assignedFields = new Set(
      pageFormData.fieldGroups.flatMap((g) => g.fields)
    );
    return fields.filter((f) => !assignedFields.has(f.name));
  };

  const handleSavePageSettings = async () => {
    if (!organization) return;
    setSavingPage(true);
    try {
      await saveSwapRegistrationPageSettings(organization.id, {
        pageTitle: pageFormData.pageTitle,
        pageDescription: pageFormData.pageDescription || undefined,
        welcomeMessage: pageFormData.welcomeMessage || undefined,
        fieldGroups: pageFormData.fieldGroups,
      });
      Alert.alert('Success', 'Page layout saved');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save page layout');
    } finally {
      setSavingPage(false);
    }
  };

  // Check which suggested fields are already enabled
  const enabledSuggestedFields = new Set(
    fields.filter((f) => f.isSuggestedField).map((f) => f.suggestedFieldType)
  );

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seller Registration Form</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowAddForm(true);
          }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Suggested Fields Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested Fields</Text>
          <Text style={styles.sectionDescription}>
            Enable pre-configured fields that sellers can optionally fill out
          </Text>
          
          {SUGGESTED_FIELDS.map((suggested) => {
            const isEnabled = enabledSuggestedFields.has(suggested.suggestedFieldType);
            return (
              <View key={suggested.suggestedFieldType} style={styles.suggestedFieldCard}>
                <View style={styles.suggestedFieldLeft}>
                  <Text style={styles.suggestedFieldName}>{suggested.label}</Text>
                  <Text style={styles.suggestedFieldHelp}>{suggested.helpText}</Text>
                </View>
                {isEnabled ? (
                  <View style={styles.enabledBadge}>
                    <Text style={styles.enabledBadgeText}>Enabled</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.enableButton}
                    onPress={() => handleEnableSuggestedField(suggested.suggestedFieldType)}
                  >
                    <Text style={styles.enableButtonText}>Enable</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Custom Fields Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Fields</Text>
          
          {showAddForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingField ? 'Edit Field' : 'New Field'}
              </Text>

              {!editingField && (
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Field Name * (snake_case)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="e.g., seller_address, emergency_contact"
                    autoCapitalize="none"
                  />
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Display Label *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.label}
                  onChangeText={(text) => setFormData({ ...formData, label: text })}
                  placeholder="e.g., Address, Emergency Contact"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Field Type *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                  {FIELD_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeChip,
                        formData.fieldType === type.value && styles.typeChipSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, fieldType: type.value })}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          formData.fieldType === type.value && styles.typeChipTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {formData.fieldType === 'dropdown' && (
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Options</Text>
                  {formData.options.map((option, index) => (
                    <View key={index} style={styles.optionItem}>
                      <Text style={styles.optionText}>{option}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setFormData({
                            ...formData,
                            options: formData.options.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <Text style={styles.optionDelete}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addOptionButton} onPress={addDropdownOption}>
                    <Text style={styles.addOptionText}>+ Add Option</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.formField}>
                <View style={styles.switchRow}>
                  <Text style={styles.formLabel}>Required</Text>
                  <Switch
                    value={formData.isRequired}
                    onValueChange={(value) => setFormData({ ...formData, isRequired: value })}
                  />
                </View>
              </View>

              <View style={styles.formField}>
                <View style={styles.switchRow}>
                  <Text style={styles.formLabel}>Optional (can be skipped)</Text>
                  <Switch
                    value={formData.isOptional}
                    onValueChange={(value) => setFormData({ ...formData, isOptional: value })}
                  />
                </View>
                <Text style={styles.helpText}>
                  If enabled, sellers can skip this field even if it's marked as required
                </Text>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Placeholder</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.placeholder}
                  onChangeText={(text) => setFormData({ ...formData, placeholder: text })}
                  placeholder="Placeholder text"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Help Text</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.helpText}
                  onChangeText={(text) => setFormData({ ...formData, helpText: text })}
                  placeholder="Helpful description"
                  multiline
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.fieldsList}>
            {fields
              .filter((f) => !f.isSuggestedField)
              .map((field) => (
                <View key={field.id} style={styles.fieldCard}>
                  <View style={styles.fieldHeader}>
                    <View style={styles.fieldHeaderLeft}>
                      <Text style={styles.fieldName}>{field.label}</Text>
                      <Text style={styles.fieldTypeBadge}>{field.fieldType}</Text>
                      {field.isRequired && (
                        <Text style={styles.requiredBadge}>Required</Text>
                      )}
                      {field.isOptional && (
                        <Text style={styles.optionalBadge}>Optional</Text>
                      )}
                    </View>
                    <View style={styles.fieldActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEdit(field)}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(field)}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {field.helpText && (
                    <Text style={styles.fieldHelpText}>{field.helpText}</Text>
                  )}
                </View>
              ))}
          </View>

          {fields.filter((f) => !f.isSuggestedField).length === 0 && !showAddForm && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No custom fields defined</Text>
              <Text style={styles.emptyStateSubtext}>
                Add custom fields to collect additional information
              </Text>
            </View>
          )}
        </View>

        {/* Page layout */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Page Layout</Text>
            <TouchableOpacity onPress={handleSavePageSettings} style={styles.savePageButton} disabled={savingPage}>
              <Text style={styles.savePageButtonText}>{savingPage ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDescription}>
            Title, welcome message, and how fields are grouped into sections on the registration form
          </Text>

          <View style={styles.formCard}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Page Title</Text>
              <TextInput
                style={styles.formInput}
                value={pageFormData.pageTitle}
                onChangeText={(text) => setPageFormData({ ...pageFormData, pageTitle: text })}
                placeholder="Register for Swap"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Page Description</Text>
              <TextInput
                style={[styles.formInput, styles.formInputArea]}
                value={pageFormData.pageDescription}
                onChangeText={(text) => setPageFormData({ ...pageFormData, pageDescription: text })}
                placeholder="Optional description at the top"
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Welcome Message</Text>
              <TextInput
                style={[styles.formInput, styles.formInputArea]}
                value={pageFormData.welcomeMessage}
                onChangeText={(text) => setPageFormData({ ...pageFormData, welcomeMessage: text })}
                placeholder="Welcome message for sellers"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Field Groups</Text>
            <TouchableOpacity onPress={addFieldGroup} style={styles.addGroupButton}>
              <Text style={styles.addGroupButtonText}>+ Add Section</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDescription}>
            Organize fields into sections. Tap a field to add or remove it from a section.
          </Text>

          {pageFormData.fieldGroups.map((group) => (
            <View key={group.id} style={styles.pageGroupCard}>
              <View style={styles.pageGroupHeader}>
                <TextInput
                  style={styles.pageGroupTitleInput}
                  value={group.title}
                  onChangeText={(text) => updateFieldGroup(group.id, { title: text })}
                  placeholder="Section title"
                />
                <TouchableOpacity
                  onPress={() => deleteFieldGroup(group.id)}
                  style={styles.pageDeleteButton}
                >
                  <Text style={styles.pageDeleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Fields in this section</Text>
                <View style={styles.pageFieldChips}>
                  {fields.map((field) => {
                    const isInGroup = group.fields.includes(field.name);
                    return (
                      <TouchableOpacity
                        key={field.id}
                        style={[styles.pageFieldChip, isInGroup && styles.pageFieldChipSelected]}
                        onPress={() => toggleFieldInGroup(group.id, field.name)}
                      >
                        <Text
                          style={[
                            styles.pageFieldChipText,
                            isInGroup && styles.pageFieldChipTextSelected,
                          ]}
                        >
                          {field.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}

          {getUnassignedFields().length > 0 && (
            <View style={styles.unassignedSection}>
              <Text style={styles.unassignedTitle}>Unassigned fields</Text>
              <Text style={styles.unassignedDescription}>
                These fields are not in any section and will appear at the bottom
              </Text>
              <View style={styles.pageFieldChips}>
                {getUnassignedFields().map((field) => (
                  <View key={field.id} style={styles.pageFieldChip}>
                    <Text style={styles.pageFieldChipText}>{field.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
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
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  suggestedFieldCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestedFieldLeft: {
    flex: 1,
    marginRight: 12,
  },
  suggestedFieldName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  suggestedFieldHelp: {
    fontSize: 14,
    color: '#666',
  },
  enabledBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
  },
  enabledBadgeText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  enableButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  enableButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  formInputArea: {
    minHeight: 80,
  },
  typeScroll: {
    marginHorizontal: -4,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  typeChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeChipText: {
    fontSize: 14,
    color: '#666',
  },
  typeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  optionDelete: {
    fontSize: 20,
    color: '#DC3545',
    fontWeight: 'bold',
  },
  addOptionButton: {
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  addOptionText: {
    fontSize: 14,
    color: '#007AFF',
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
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fieldsList: {
    gap: 12,
  },
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fieldHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  fieldName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  fieldTypeBadge: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  requiredBadge: {
    fontSize: 12,
    color: '#DC3545',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  optionalBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  fieldActions: {
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
  fieldHelpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
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
  savePageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  savePageButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  addGroupButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pageGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pageGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageGroupTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 12,
  },
  pageDeleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFE5E5',
  },
  pageDeleteButtonText: {
    fontSize: 14,
    color: '#DC3545',
    fontWeight: '600',
  },
  pageFieldChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pageFieldChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  pageFieldChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pageFieldChipText: {
    fontSize: 14,
    color: '#666',
  },
  pageFieldChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  unassignedSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  unassignedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  unassignedDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
});








