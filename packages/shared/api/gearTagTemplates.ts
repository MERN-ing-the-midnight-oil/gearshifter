import { supabase } from './supabase';
import type { GearTagTemplate, TagField, TagLayoutType, QRCodePosition } from '../types/models';

/**
 * Get all gear tag templates for an organization
 */
export const getOrganizationGearTagTemplates = async (
  organizationId: string
): Promise<GearTagTemplate[]> => {
  const { data, error } = await supabase
    .from('gear_tag_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data.map(mapTagTemplateFromDb);
};

/**
 * Get a single gear tag template by ID
 */
export const getGearTagTemplate = async (
  templateId: string
): Promise<GearTagTemplate | null> => {
  const { data, error } = await supabase
    .from('gear_tag_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) throw error;
  return data ? mapTagTemplateFromDb(data) : null;
};

/**
 * Get default gear tag template for an organization
 */
export const getDefaultGearTagTemplate = async (
  organizationId: string
): Promise<GearTagTemplate | null> => {
  const { data, error } = await supabase
    .from('gear_tag_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapTagTemplateFromDb(data) : null;
};

/**
 * Get gear tag template for a category (or default)
 */
export const getGearTagTemplateForCategory = async (
  organizationId: string,
  categoryId?: string
): Promise<GearTagTemplate | null> => {
  if (categoryId) {
    // Try to find template linked to this category
    const { data, error } = await supabase
      .from('gear_tag_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .contains('category_ids', [categoryId])
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return mapTagTemplateFromDb(data);
  }

  // Fall back to default template
  return getDefaultGearTagTemplate(organizationId);
};

/**
 * Create a new gear tag template
 */
export const createGearTagTemplate = async (
  organizationId: string,
  templateData: {
    name: string;
    description?: string;
    layoutType?: TagLayoutType;
    widthMm?: number;
    heightMm?: number;
    tagFields: TagField[];
    requiredFields?: string[];
    categoryIds?: string[];
    fontFamily?: string;
    fontSize?: number;
    borderWidth?: number;
    qrCodeSize?: number;
    qrCodePosition?: QRCodePosition;
    qrCodeEnabled?: boolean;
    qrCodeDataFields?: string[];
    qrCodeSellerAccess?: string[];
    isDefault?: boolean;
    displayOrder?: number;
  }
): Promise<GearTagTemplate> => {
  // If this is set as default, unset other defaults
  if (templateData.isDefault) {
    await supabase
      .from('gear_tag_templates')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true);
  }

  const insertRow = (name: string) => ({
    organization_id: organizationId,
    name,
    description: templateData.description || null,
    layout_type: templateData.layoutType || 'standard',
    width_mm: templateData.widthMm || 50.0,
    height_mm: templateData.heightMm || 30.0,
    tag_fields: templateData.tagFields,
    required_fields: templateData.requiredFields || [],
    category_ids: templateData.categoryIds || null,
    font_family: templateData.fontFamily || 'Arial',
    font_size: templateData.fontSize || 10.0,
    border_width: templateData.borderWidth || 0.5,
    qr_code_size: templateData.qrCodeSize || 15.0,
    qr_code_position: templateData.qrCodePosition || 'bottom-right',
    qr_code_enabled: templateData.qrCodeEnabled !== undefined ? templateData.qrCodeEnabled : true,
    qr_code_data_fields: templateData.qrCodeDataFields || ['item_number'],
    qr_code_seller_access: templateData.qrCodeSellerAccess || [],
    is_default: templateData.isDefault || false,
    display_order: templateData.displayOrder || 0,
  });

  let name = templateData.name;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const { data, error } = await supabase
      .from('gear_tag_templates')
      .insert(insertRow(name))
      .select()
      .single();

    if (!error) return mapTagTemplateFromDb(data);
    // 409 Conflict or Postgres 23505 = unique constraint (organization_id, name)
    const isConflict = error.code === '23505' || (error as { status?: number }).status === 409;
    if (isConflict && attempt < maxAttempts - 1) {
      attempt += 1;
      name = `${templateData.name} (${attempt + 1})`;
      continue;
    }
    throw error;
  }

  throw new Error('Could not create template with a unique name');
};

/**
 * Update a gear tag template
 */
export const updateGearTagTemplate = async (
  templateId: string,
  updates: {
    name?: string;
    description?: string;
    layoutType?: TagLayoutType;
    widthMm?: number;
    heightMm?: number;
    tagFields?: TagField[];
    requiredFields?: string[];
    categoryIds?: string[];
    fontFamily?: string;
    fontSize?: number;
    borderWidth?: number;
    qrCodeSize?: number;
    qrCodePosition?: QRCodePosition;
    qrCodeEnabled?: boolean;
    qrCodeDataFields?: string[];
    qrCodeSellerAccess?: string[];
    isDefault?: boolean;
    isActive?: boolean;
    displayOrder?: number;
  }
): Promise<GearTagTemplate> => {
  // If setting as default, unset other defaults
  if (updates.isDefault) {
    const { data: template } = await supabase
      .from('gear_tag_templates')
      .select('organization_id')
      .eq('id', templateId)
      .single();

    if (template) {
      await supabase
        .from('gear_tag_templates')
        .update({ is_default: false })
        .eq('organization_id', template.organization_id)
        .eq('is_default', true)
        .neq('id', templateId);
    }
  }

  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description || null;
  if (updates.layoutType !== undefined) updateData.layout_type = updates.layoutType;
  if (updates.widthMm !== undefined) updateData.width_mm = updates.widthMm;
  if (updates.heightMm !== undefined) updateData.height_mm = updates.heightMm;
  if (updates.tagFields !== undefined) updateData.tag_fields = updates.tagFields;
  if (updates.requiredFields !== undefined) updateData.required_fields = updates.requiredFields;
  if (updates.categoryIds !== undefined) updateData.category_ids = updates.categoryIds || null;
  if (updates.fontFamily !== undefined) updateData.font_family = updates.fontFamily;
  if (updates.fontSize !== undefined) updateData.font_size = updates.fontSize;
  if (updates.borderWidth !== undefined) updateData.border_width = updates.borderWidth;
  if (updates.qrCodeSize !== undefined) updateData.qr_code_size = updates.qrCodeSize;
  if (updates.qrCodePosition !== undefined) updateData.qr_code_position = updates.qrCodePosition;
  if (updates.qrCodeEnabled !== undefined) updateData.qr_code_enabled = updates.qrCodeEnabled;
  if (updates.qrCodeDataFields !== undefined) updateData.qr_code_data_fields = updates.qrCodeDataFields;
  if (updates.qrCodeSellerAccess !== undefined) updateData.qr_code_seller_access = updates.qrCodeSellerAccess;
  if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

  const { data, error } = await supabase
    .from('gear_tag_templates')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return mapTagTemplateFromDb(data);
};

/**
 * Delete a gear tag template
 */
export const deleteGearTagTemplate = async (templateId: string): Promise<void> => {
  console.log('[gearTagTemplates] deleteGearTagTemplate called', { templateId });
  const { error } = await supabase
    .from('gear_tag_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('[gearTagTemplates] deleteGearTagTemplate Supabase error:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(error.message ?? `Failed to delete gear tag template: ${error.code ?? 'unknown'}`);
  }
  console.log('[gearTagTemplates] deleteGearTagTemplate succeeded');
};

/**
 * Helper to map database tag template to GearTagTemplate model
 */
function mapTagTemplateFromDb(dbTemplate: any): GearTagTemplate {
  return {
    id: dbTemplate.id,
    organizationId: dbTemplate.organization_id,
    name: dbTemplate.name,
    description: dbTemplate.description,
    layoutType: dbTemplate.layout_type as TagLayoutType,
    widthMm: parseFloat(dbTemplate.width_mm),
    heightMm: parseFloat(dbTemplate.height_mm),
    tagFields: (dbTemplate.tag_fields as TagField[]) || [],
    requiredFields: dbTemplate.required_fields || [],
    categoryIds: dbTemplate.category_ids || undefined,
    fontFamily: dbTemplate.font_family,
    fontSize: parseFloat(dbTemplate.font_size),
    borderWidth: parseFloat(dbTemplate.border_width),
    qrCodeSize: parseFloat(dbTemplate.qr_code_size),
    qrCodePosition: dbTemplate.qr_code_position as QRCodePosition,
    qrCodeEnabled: dbTemplate.qr_code_enabled !== undefined ? dbTemplate.qr_code_enabled : true,
    qrCodeDataFields: dbTemplate.qr_code_data_fields || ['item_number'],
    qrCodeSellerAccess: dbTemplate.qr_code_seller_access || [],
    isDefault: dbTemplate.is_default,
    isActive: dbTemplate.is_active,
    displayOrder: dbTemplate.display_order,
    createdAt: new Date(dbTemplate.created_at),
    updatedAt: new Date(dbTemplate.updated_at),
  };
}

