import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAdminOrganization, useAdminUser, getOrganizationFieldDefinitions, createFieldDefinition, updateFieldDefinition, deleteFieldDefinition, type ItemFieldDefinition, type FieldType } from 'shared';
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

export default function FieldDefinitionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organization } = useAdminOrganization(user?.id || null);
  const { adminUser, loading: adminUserLoading } = useAdminUser(user?.id ?? null);
  const isAdmin = adminUser?.role === 'admin';
  const [fields, setFields] = useState<ItemFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingField, setEditingField] = useState<ItemFieldDefinition | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    label: '',
    fieldType: 'text' as FieldType,
    isRequired: false,
    placeholder: '',
    helpText: '',
    defaultValue: '',
    isPriceField: false,
    isPriceReductionField: false,
    priceReductionPercentage: false,
    priceReductionTimeControl: 'org' as 'org' | 'seller',
    options: [] as string[],
  });

  useEffect(() => {
    if (adminUser && adminUser.role !== 'admin') router.replace('/(dashboard)');
  }, [adminUser, router]);
  useEffect(() => {
    loadFields();
  }, [organization]);

  const loadFields = async () => {
    if (!organization) return;
    
    setLoading(true);
    try {
      const data = await getOrganizationFieldDefinitions(organization.id);
      setFields(data);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load fields');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      fieldType: 'text',
      isRequired: false,
      placeholder: '',
      helpText: '',
      defaultValue: '',
      isPriceField: false,
      isPriceReductionField: false,
      priceReductionPercentage: false,
      priceReductionTimeControl: 'org',
      options: [],
    });
    setShowAddForm(false);
    setEditingField(null);
  };

  const handleSave = async () => {
    if (!organization) return;
    
    if (!formData.name.trim() || !formData.label.trim()) {
      Alert.alert('Error', 'Name and label are required');
      return;
    }

    // Validate name format (should be snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(formData.name)) {
      Alert.alert('Error', 'Field name must be lowercase with underscores (e.g., item_price)');
      return;
    }

    try {
      if (editingField) {
        await updateFieldDefinition(editingField.id, {
          label: formData.label,
          fieldType: formData.fieldType,
          isRequired: formData.isRequired,
          placeholder: formData.placeholder || undefined,
          helpText: formData.helpText || undefined,
          defaultValue: formData.defaultValue || undefined,
          isPriceField: formData.isPriceField,
          isPriceReductionField: formData.isPriceReductionField,
          priceReductionPercentage: formData.priceReductionPercentage,
          priceReductionTimeControl: formData.priceReductionTimeControl,
          options: formData.fieldType === 'dropdown' ? formData.options : undefined,
        });
      } else {
        await createFieldDefinition(organization.id, {
          name: formData.name,
          label: formData.label,
          fieldType: formData.fieldType,
          isRequired: formData.isRequired,
          placeholder: formData.placeholder || undefined,
          helpText: formData.helpText || undefined,
          defaultValue: formData.defaultValue || undefined,
          isPriceField: formData.isPriceField,
          isPriceReductionField: formData.isPriceReductionField,
          priceReductionPercentage: formData.priceReductionPercentage,
          priceReductionTimeControl: formData.priceReductionTimeControl,
          options: formData.fieldType === 'dropdown' ? formData.options : undefined,
        });
      }
      
      resetForm();
      await loadFields();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save field');
    }
  };

  const handleEdit = (field: ItemFieldDefinition) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      label: field.label,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      defaultValue: field.defaultValue || '',
      isPriceField: field.isPriceField,
      isPriceReductionField: field.isPriceReductionField,
      priceReductionPercentage: field.priceReductionPercentage,
      priceReductionTimeControl: field.priceReductionTimeControl,
      options: field.options || [],
    });
    setShowAddForm(true);
  };

  const handleDelete = (field: ItemFieldDefinition) => {
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
              await deleteFieldDefinition(field.id);
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
        <Text style={styles.loadingText}>Loading fields...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Item Fields</Text>
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
                  placeholder="e.g., item_price, donate_if_unsold"
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
                placeholder="e.g., Item Price, Donate if Unsold"
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

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Default Value</Text>
              <TextInput
                style={styles.formInput}
                value={formData.defaultValue}
                onChangeText={(text) => setFormData({ ...formData, defaultValue: text })}
                placeholder="Default value"
              />
            </View>

            <View style={styles.formField}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Is Price Field</Text>
                <Switch
                  value={formData.isPriceField}
                  onValueChange={(value) => setFormData({ ...formData, isPriceField: value })}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Is Price Reduction Field</Text>
                <Switch
                  value={formData.isPriceReductionField}
                  onValueChange={(value) => setFormData({ ...formData, isPriceReductionField: value })}
                />
              </View>
            </View>

            {formData.isPriceReductionField && (
              <>
                <View style={styles.formField}>
                  <View style={styles.switchRow}>
                    <Text style={styles.formLabel}>Percentage Reduction (vs Fixed Amount)</Text>
                    <Switch
                      value={formData.priceReductionPercentage}
                      onValueChange={(value) => setFormData({ ...formData, priceReductionPercentage: value })}
                    />
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Price Reduction Time Control</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        formData.priceReductionTimeControl === 'org' && styles.radioOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, priceReductionTimeControl: 'org' })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          formData.priceReductionTimeControl === 'org' && styles.radioTextSelected,
                        ]}
                      >
                        Organization Sets Time
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        formData.priceReductionTimeControl === 'seller' && styles.radioOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, priceReductionTimeControl: 'seller' })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          formData.priceReductionTimeControl === 'seller' && styles.radioTextSelected,
                        ]}
                      >
                        Seller Sets Time
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

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
          {fields.map((field) => (
            <View key={field.id} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldHeaderLeft}>
                  <Text style={styles.fieldName}>{field.label}</Text>
                  <Text style={styles.fieldTypeBadge}>{field.fieldType}</Text>
                  {field.isPriceField && (
                    <Text style={styles.fieldBadge}>Price</Text>
                  )}
                  {field.isPriceReductionField && (
                    <Text style={styles.fieldBadge}>Price Reduction</Text>
                  )}
                  {field.isRequired && (
                    <Text style={styles.requiredBadge}>Required</Text>
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

        {fields.length === 0 && !showAddForm && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No fields defined</Text>
            <Text style={styles.emptyStateSubtext}>
              Add fields to customize item registration
            </Text>
          </View>
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
  formCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
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
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  radioOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  radioText: {
    fontSize: 14,
    color: '#666',
  },
  radioTextSelected: {
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
    padding: 16,
  },
  fieldCard: {
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
  fieldBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
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
});










