import { supabase } from './supabase';
import type { ItemFieldDefinition, FieldType } from '../types/models';

/**
 * Get all field definitions for an organization
 */
export const getOrganizationFieldDefinitions = async (
  organizationId: string
): Promise<ItemFieldDefinition[]> => {
  const { data, error } = await supabase
    .from('item_field_definitions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw error;
  return data.map(mapFieldDefinitionFromDb);
};

/**
 * Get a single field definition by ID
 */
export const getFieldDefinition = async (
  fieldDefinitionId: string
): Promise<ItemFieldDefinition | null> => {
  const { data, error } = await supabase
    .from('item_field_definitions')
    .select('*')
    .eq('id', fieldDefinitionId)
    .single();

  if (error) throw error;
  return data ? mapFieldDefinitionFromDb(data) : null;
};

/**
 * Get field definitions for an event (via organization)
 */
export const getEventFieldDefinitions = async (
  eventId: string
): Promise<ItemFieldDefinition[]> => {
  // First get the event to find organization
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('organization_id')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;
  if (!event) return [];

  return getOrganizationFieldDefinitions(event.organization_id);
};

/**
 * Create a new field definition
 */
export const createFieldDefinition = async (
  organizationId: string,
  fieldData: {
    name: string;
    label: string;
    fieldType: FieldType;
    categoryId?: string;
    isRequired?: boolean;
    displayOrder?: number;
    defaultValue?: string;
    placeholder?: string;
    helpText?: string;
    validationRules?: Record<string, unknown>;
    options?: string[];
    isPriceField?: boolean;
    isPriceReductionField?: boolean;
    priceReductionPercentage?: boolean;
    priceReductionTimeControl?: 'org' | 'seller';
  }
): Promise<ItemFieldDefinition> => {
  const { data, error } = await supabase
    .from('item_field_definitions')
    .insert({
      organization_id: organizationId,
      category_id: fieldData.categoryId || null,
      name: fieldData.name,
      label: fieldData.label,
      field_type: fieldData.fieldType,
      is_required: fieldData.isRequired || false,
      display_order: fieldData.displayOrder || 0,
      default_value: fieldData.defaultValue || null,
      placeholder: fieldData.placeholder || null,
      help_text: fieldData.helpText || null,
      validation_rules: fieldData.validationRules || {},
      options: fieldData.options || null,
      is_price_field: fieldData.isPriceField || false,
      is_price_reduction_field: fieldData.isPriceReductionField || false,
      price_reduction_percentage: fieldData.priceReductionPercentage || false,
      price_reduction_time_control: fieldData.priceReductionTimeControl || 'org',
    })
    .select()
    .single();

  if (error) throw error;
  return mapFieldDefinitionFromDb(data);
};

/**
 * Update a field definition
 */
export const updateFieldDefinition = async (
  fieldDefinitionId: string,
  updates: {
    label?: string;
    fieldType?: FieldType;
    isRequired?: boolean;
    displayOrder?: number;
    defaultValue?: string;
    placeholder?: string;
    helpText?: string;
    validationRules?: Record<string, unknown>;
    options?: string[];
    isPriceField?: boolean;
    isPriceReductionField?: boolean;
    priceReductionPercentage?: boolean;
    priceReductionTimeControl?: 'org' | 'seller';
  }
): Promise<ItemFieldDefinition> => {
  const updateData: any = {};
  if (updates.label !== undefined) updateData.label = updates.label;
  if (updates.fieldType !== undefined) updateData.field_type = updates.fieldType;
  if (updates.isRequired !== undefined) updateData.is_required = updates.isRequired;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
  if (updates.defaultValue !== undefined) updateData.default_value = updates.defaultValue || null;
  if (updates.placeholder !== undefined) updateData.placeholder = updates.placeholder || null;
  if (updates.helpText !== undefined) updateData.help_text = updates.helpText || null;
  if (updates.validationRules !== undefined) updateData.validation_rules = updates.validationRules;
  if (updates.options !== undefined) updateData.options = updates.options || null;
  if (updates.isPriceField !== undefined) updateData.is_price_field = updates.isPriceField;
  if (updates.isPriceReductionField !== undefined)
    updateData.is_price_reduction_field = updates.isPriceReductionField;
  if (updates.priceReductionPercentage !== undefined)
    updateData.price_reduction_percentage = updates.priceReductionPercentage;
  if (updates.priceReductionTimeControl !== undefined)
    updateData.price_reduction_time_control = updates.priceReductionTimeControl;

  const { data, error } = await supabase
    .from('item_field_definitions')
    .update(updateData)
    .eq('id', fieldDefinitionId)
    .select()
    .single();

  if (error) throw error;
  return mapFieldDefinitionFromDb(data);
};

/**
 * Delete a field definition
 */
export const deleteFieldDefinition = async (fieldDefinitionId: string): Promise<void> => {
  const { error } = await supabase
    .from('item_field_definitions')
    .delete()
    .eq('id', fieldDefinitionId);

  if (error) throw error;
};

/**
 * Reorder field definitions
 */
export const reorderFieldDefinitions = async (
  fieldOrders: { id: string; displayOrder: number }[]
): Promise<void> => {
  const updates = fieldOrders.map(({ id, displayOrder }) =>
    supabase
      .from('item_field_definitions')
      .update({ display_order: displayOrder })
      .eq('id', id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error).map((r) => r.error);
  if (errors.length > 0) {
    throw errors[0];
  }
};

/**
 * Helper to map database field definition to ItemFieldDefinition model
 */
function mapFieldDefinitionFromDb(dbField: any): ItemFieldDefinition {
  return {
    id: dbField.id,
    organizationId: dbField.organization_id,
    categoryId: dbField.category_id,
    name: dbField.name,
    label: dbField.label,
    fieldType: dbField.field_type as FieldType,
    isRequired: dbField.is_required,
    displayOrder: dbField.display_order,
    defaultValue: dbField.default_value,
    placeholder: dbField.placeholder,
    helpText: dbField.help_text,
    validationRules: dbField.validation_rules || {},
    options: dbField.options || undefined,
    isPriceField: dbField.is_price_field,
    isPriceReductionField: dbField.is_price_reduction_field,
    priceReductionPercentage: dbField.price_reduction_percentage,
    priceReductionTimeControl: dbField.price_reduction_time_control,
    createdAt: new Date(dbField.created_at),
  };
}










