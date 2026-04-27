import { supabase } from './supabase';
import type { SwapRegistrationFieldDefinition, SuggestedFieldType, FieldType } from '../types/models';

// Suggested fields that orgs can enable
export const SUGGESTED_FIELDS: Array<{
  suggestedFieldType: SuggestedFieldType;
  name: string;
  label: string;
  fieldType: FieldType;
  helpText: string;
}> = [
  {
    suggestedFieldType: 'profile_photo',
    name: 'profile_photo',
    label: 'Profile Photo',
    fieldType: 'text', // Will be handled as file upload
    helpText: 'Upload a profile photo (optional)',
  },
  {
    suggestedFieldType: 'address',
    name: 'address',
    label: 'Address',
    fieldType: 'textarea',
    helpText: 'Street address for tax forms and communication',
  },
  {
    suggestedFieldType: 'contact_info',
    name: 'contact_info',
    label: 'Additional Contact Info',
    fieldType: 'textarea',
    helpText: 'Any additional contact information (optional)',
  },
  {
    suggestedFieldType: 'marketing_opt_in',
    name: 'marketing_opt_in',
    label: 'Marketing Communications',
    fieldType: 'boolean',
    helpText: 'Receive updates about future events and promotions',
  },
];

/**
 * Get all swap registration field definitions for an organization
 */
export const getOrganizationSwapRegistrationFields = async (
  organizationId: string
): Promise<SwapRegistrationFieldDefinition[]> => {
  const { data, error } = await supabase
    .from('swap_registration_field_definitions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw error;
  return data.map(mapFieldDefinitionFromDb);
};

/**
 * Get swap registration field definitions for an event (via organization)
 */
export const getEventSwapRegistrationFields = async (
  eventId: string
): Promise<SwapRegistrationFieldDefinition[]> => {
  // First get the event to find organization
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('organization_id')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event) return [];

  return getOrganizationSwapRegistrationFields(event.organization_id);
};

const DEFAULT_SWAP_REG_FIELD_SPECS: Array<{
  name: string;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  isOptional: boolean;
  displayOrder: number;
  placeholder?: string;
  helpText?: string;
}> = [
  {
    name: 'how_heard',
    label: 'How did you hear about this swap?',
    fieldType: 'text',
    isRequired: false,
    isOptional: true,
    displayOrder: 0,
    placeholder: 'Friend, poster, social media…',
    helpText: 'Optional; helps organizers improve outreach.',
  },
  {
    name: 'seller_notes',
    label: 'Anything we should know?',
    fieldType: 'textarea',
    isRequired: false,
    isOptional: true,
    displayOrder: 1,
    placeholder: 'Accessibility, large items, etc.',
    helpText: 'Optional notes for check-in staff.',
  },
];

/**
 * Ensures the organization has the same starter swap registration fields as seed.sql.
 * Call after creating an event (or anytime) so the seller registration screen is not empty.
 * Requires an authenticated user who may INSERT into swap_registration_field_definitions (org admins).
 */
export const ensureDefaultSwapRegistrationFieldsForOrganization = async (
  organizationId: string
): Promise<void> => {
  const existing = await getOrganizationSwapRegistrationFields(organizationId);
  const names = new Set(existing.map((f) => f.name));
  for (const spec of DEFAULT_SWAP_REG_FIELD_SPECS) {
    if (names.has(spec.name)) continue;
    await createSwapRegistrationFieldDefinition(organizationId, {
      name: spec.name,
      label: spec.label,
      fieldType: spec.fieldType,
      isRequired: spec.isRequired,
      isOptional: spec.isOptional,
      displayOrder: spec.displayOrder,
      placeholder: spec.placeholder,
      helpText: spec.helpText,
      validationRules: {},
    });
    names.add(spec.name);
  }
};

/**
 * Get a single swap registration field definition by ID
 */
export const getSwapRegistrationFieldDefinition = async (
  fieldDefinitionId: string
): Promise<SwapRegistrationFieldDefinition | null> => {
  const { data, error } = await supabase
    .from('swap_registration_field_definitions')
    .select('*')
    .eq('id', fieldDefinitionId)
    .single();

  if (error) throw error;
  return data ? mapFieldDefinitionFromDb(data) : null;
};

/**
 * Create a new swap registration field definition
 */
export const createSwapRegistrationFieldDefinition = async (
  organizationId: string,
  fieldData: {
    name: string;
    label: string;
    fieldType: FieldType;
    isRequired?: boolean;
    isOptional?: boolean;
    displayOrder?: number;
    defaultValue?: string;
    placeholder?: string;
    helpText?: string;
    validationRules?: Record<string, unknown>;
    options?: string[];
    isSuggestedField?: boolean;
    suggestedFieldType?: SuggestedFieldType;
  }
): Promise<SwapRegistrationFieldDefinition> => {
  const { data, error } = await supabase
    .from('swap_registration_field_definitions')
    .insert({
      organization_id: organizationId,
      name: fieldData.name,
      label: fieldData.label,
      field_type: fieldData.fieldType,
      is_required: fieldData.isRequired || false,
      is_optional: fieldData.isOptional !== undefined ? fieldData.isOptional : true,
      display_order: fieldData.displayOrder || 0,
      default_value: fieldData.defaultValue || null,
      placeholder: fieldData.placeholder || null,
      help_text: fieldData.helpText || null,
      validation_rules: fieldData.validationRules || {},
      options: fieldData.options || null,
      is_suggested_field: fieldData.isSuggestedField || false,
      suggested_field_type: fieldData.suggestedFieldType || null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapFieldDefinitionFromDb(data);
};

/**
 * Create a suggested field (enables a pre-defined suggested field)
 */
export const enableSuggestedField = async (
  organizationId: string,
  suggestedFieldType: SuggestedFieldType,
  config?: {
    isRequired?: boolean;
    isOptional?: boolean;
    label?: string;
    helpText?: string;
  }
): Promise<SwapRegistrationFieldDefinition> => {
  const suggestedField = SUGGESTED_FIELDS.find(
    (f) => f.suggestedFieldType === suggestedFieldType
  );

  if (!suggestedField) {
    throw new Error(`Unknown suggested field type: ${suggestedFieldType}`);
  }

  return createSwapRegistrationFieldDefinition(organizationId, {
    name: suggestedField.name,
    label: config?.label || suggestedField.label,
    fieldType: suggestedField.fieldType,
    isRequired: config?.isRequired || false,
    isOptional: config?.isOptional !== undefined ? config.isOptional : true,
    helpText: config?.helpText || suggestedField.helpText,
    isSuggestedField: true,
    suggestedFieldType,
  });
};

/**
 * Update a swap registration field definition
 */
export const updateSwapRegistrationFieldDefinition = async (
  fieldDefinitionId: string,
  updates: {
    label?: string;
    fieldType?: FieldType;
    isRequired?: boolean;
    isOptional?: boolean;
    displayOrder?: number;
    defaultValue?: string;
    placeholder?: string;
    helpText?: string;
    validationRules?: Record<string, unknown>;
    options?: string[];
  }
): Promise<SwapRegistrationFieldDefinition> => {
  const updateData: any = {};
  if (updates.label !== undefined) updateData.label = updates.label;
  if (updates.fieldType !== undefined) updateData.field_type = updates.fieldType;
  if (updates.isRequired !== undefined) updateData.is_required = updates.isRequired;
  if (updates.isOptional !== undefined) updateData.is_optional = updates.isOptional;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
  if (updates.defaultValue !== undefined) updateData.default_value = updates.defaultValue || null;
  if (updates.placeholder !== undefined) updateData.placeholder = updates.placeholder || null;
  if (updates.helpText !== undefined) updateData.help_text = updates.helpText || null;
  if (updates.validationRules !== undefined) updateData.validation_rules = updates.validationRules;
  if (updates.options !== undefined) updateData.options = updates.options || null;

  const { data, error } = await supabase
    .from('swap_registration_field_definitions')
    .update(updateData)
    .eq('id', fieldDefinitionId)
    .select()
    .single();

  if (error) throw error;
  return mapFieldDefinitionFromDb(data);
};

/**
 * Delete a swap registration field definition
 */
export const deleteSwapRegistrationFieldDefinition = async (
  fieldDefinitionId: string
): Promise<void> => {
  const { error } = await supabase
    .from('swap_registration_field_definitions')
    .delete()
    .eq('id', fieldDefinitionId);

  if (error) throw error;
};

/**
 * Reorder swap registration field definitions
 */
export const reorderSwapRegistrationFields = async (
  fieldOrders: { id: string; displayOrder: number }[]
): Promise<void> => {
  const updates = fieldOrders.map(({ id, displayOrder }) =>
    supabase
      .from('swap_registration_field_definitions')
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
 * Helper to map database field definition to SwapRegistrationFieldDefinition model
 */
function mapFieldDefinitionFromDb(dbField: any): SwapRegistrationFieldDefinition {
  return {
    id: dbField.id,
    organizationId: dbField.organization_id,
    name: dbField.name,
    label: dbField.label,
    fieldType: dbField.field_type as FieldType,
    isRequired: dbField.is_required,
    isOptional: dbField.is_optional,
    displayOrder: dbField.display_order,
    defaultValue: dbField.default_value,
    placeholder: dbField.placeholder,
    helpText: dbField.help_text,
    validationRules: dbField.validation_rules || {},
    options: dbField.options || undefined,
    isSuggestedField: dbField.is_suggested_field,
    suggestedFieldType: dbField.suggested_field_type as SuggestedFieldType | undefined,
    createdAt: new Date(dbField.created_at),
  };
}








