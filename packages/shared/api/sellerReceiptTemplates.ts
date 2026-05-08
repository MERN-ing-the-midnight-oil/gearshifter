import { supabase } from './supabase';
import { DEFAULT_SELLER_RECEIPT_TAG_FIELDS } from '../constants/sellerReceiptDefaults';
import type {
  SellerReceiptTemplate,
  TagField,
  TagLayoutType,
  QRCodePosition,
  TagPrintOrientation,
} from '../types/models';
import { getOrganizationGearTagTemplates } from './gearTagTemplates';

/** Line in `description` — used to avoid duplicating auto-generated seller receipts for the same item tag template. */
export const SELLER_RECEIPT_FROM_GEAR_TAG_MARKER = '__source_gear_tag__:';

export function sellerReceiptSourceGearTagId(description: string | null | undefined): string | null {
  if (!description) return null;
  for (const line of description.split('\n')) {
    const t = line.trim();
    if (t.startsWith(SELLER_RECEIPT_FROM_GEAR_TAG_MARKER)) {
      const id = t.slice(SELLER_RECEIPT_FROM_GEAR_TAG_MARKER.length).trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return id;
      }
    }
  }
  return null;
}

/**
 * For each organization item tag (gear) template, create a seller receipt template with the same mm size,
 * orientation, and typography defaults; receipt lines start as buyer name / phone / sold-at.
 * Skips gear tag templates that already have a seeded seller receipt (same source id in description).
 */
export async function seedSellerReceiptTemplatesFromGearTagTemplates(
  organizationId: string
): Promise<{ created: number; skipped: number }> {
  const [gearTags, existingSeller] = await Promise.all([
    getOrganizationGearTagTemplates(organizationId),
    getOrganizationSellerReceiptTemplates(organizationId),
  ]);

  const already = new Set(
    existingSeller
      .map((t) => sellerReceiptSourceGearTagId(t.description))
      .filter((id): id is string => Boolean(id))
  );

  const hasAnyDefault = existingSeller.some((t) => t.isDefault);
  let assignDefault = !hasAnyDefault;

  let created = 0;
  let skipped = 0;

  const sorted = [...gearTags].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.name.localeCompare(b.name);
  });

  for (const gt of sorted) {
    if (already.has(gt.id)) {
      skipped += 1;
      continue;
    }

    const human = `Same label size as item tag "${gt.name}" (${gt.widthMm}×${gt.heightMm} mm).`;
    const description = `${human}\n${SELLER_RECEIPT_FROM_GEAR_TAG_MARKER}${gt.id}`;

    const tagFields: TagField[] = DEFAULT_SELLER_RECEIPT_TAG_FIELDS.map((f) => ({ ...f }));

    await createSellerReceiptTemplate(organizationId, {
      name: `Seller receipt — ${gt.name}`,
      description,
      layoutType: gt.layoutType,
      widthMm: gt.widthMm,
      heightMm: gt.heightMm,
      tagFields,
      fontFamily: gt.fontFamily,
      fontSize: gt.fontSize,
      borderWidth: gt.borderWidth,
      qrCodeSize: gt.qrCodeSize,
      qrCodePosition: gt.qrCodePosition,
      qrCodeOffsetXMm: gt.qrCodeOffsetXMm,
      qrCodeOffsetYMm: gt.qrCodeOffsetYMm,
      qrCodeEnabled: false,
      tagOrientation: gt.tagOrientation,
      displayOrder: gt.displayOrder,
      isDefault: assignDefault,
    });

    if (assignDefault) assignDefault = false;
    already.add(gt.id);
    created += 1;
  }

  return { created, skipped };
}

export const getOrganizationSellerReceiptTemplates = async (
  organizationId: string
): Promise<SellerReceiptTemplate[]> => {
  const { data, error } = await supabase
    .from('seller_receipt_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data.map(mapSellerReceiptTemplateFromDb);
};

export const getSellerReceiptTemplate = async (
  templateId: string
): Promise<SellerReceiptTemplate | null> => {
  const { data, error } = await supabase
    .from('seller_receipt_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) throw error;
  return data ? mapSellerReceiptTemplateFromDb(data) : null;
};

export const getDefaultSellerReceiptTemplate = async (
  organizationId: string
): Promise<SellerReceiptTemplate | null> => {
  const { data, error } = await supabase
    .from('seller_receipt_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapSellerReceiptTemplateFromDb(data) : null;
};

export const createSellerReceiptTemplate = async (
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
    qrCodeOffsetXMm?: number;
    qrCodeOffsetYMm?: number;
    qrCodeEnabled?: boolean;
    qrCodeDataFields?: string[];
    qrCodeSellerAccess?: string[];
    tagOrientation?: TagPrintOrientation;
    isDefault?: boolean;
    displayOrder?: number;
  }
): Promise<SellerReceiptTemplate> => {
  if (templateData.isDefault) {
    await supabase
      .from('seller_receipt_templates')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true);
  }

  const insertRow = (name: string) => ({
    organization_id: organizationId,
    name,
    description: templateData.description || null,
    layout_type: templateData.layoutType || 'standard',
    width_mm: templateData.widthMm ?? 58.0,
    height_mm: templateData.heightMm ?? 80.0,
    tag_fields: templateData.tagFields as unknown as TagField[],
    required_fields: templateData.requiredFields ?? [],
    category_ids: templateData.categoryIds || null,
    font_family: templateData.fontFamily || 'Arial',
    font_size: templateData.fontSize || 10.0,
    border_width: templateData.borderWidth || 0.5,
    qr_code_size: templateData.qrCodeSize ?? 14.0,
    qr_code_position: templateData.qrCodePosition || 'bottom-right',
    qr_code_offset_x_mm: templateData.qrCodeOffsetXMm ?? 0,
    qr_code_offset_y_mm: templateData.qrCodeOffsetYMm ?? 0,
    qr_code_enabled: templateData.qrCodeEnabled === true,
    qr_code_data_fields: templateData.qrCodeDataFields || [],
    qr_code_seller_access: templateData.qrCodeSellerAccess || [],
    tag_orientation:
      templateData.tagOrientation ??
      ((templateData.widthMm ?? 58) > (templateData.heightMm ?? 80) ? 'landscape' : 'portrait'),
    is_default: templateData.isDefault || false,
    display_order: templateData.displayOrder || 0,
  });

  let name = templateData.name;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const { data, error } = await supabase
      .from('seller_receipt_templates')
      .insert(insertRow(name))
      .select()
      .single();

    if (!error) return mapSellerReceiptTemplateFromDb(data);
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

export const updateSellerReceiptTemplate = async (
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
    qrCodeOffsetXMm?: number;
    qrCodeOffsetYMm?: number;
    qrCodeEnabled?: boolean;
    qrCodeDataFields?: string[];
    qrCodeSellerAccess?: string[];
    tagOrientation?: TagPrintOrientation;
    isDefault?: boolean;
    isActive?: boolean;
    displayOrder?: number;
  }
): Promise<SellerReceiptTemplate> => {
  if (updates.isDefault) {
    const { data: template } = await supabase
      .from('seller_receipt_templates')
      .select('organization_id')
      .eq('id', templateId)
      .single();

    if (template) {
      await supabase
        .from('seller_receipt_templates')
        .update({ is_default: false })
        .eq('organization_id', template.organization_id)
        .eq('is_default', true)
        .neq('id', templateId);
    }
  }

  const updateData: Record<string, unknown> = {};
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
  if (updates.qrCodeOffsetXMm !== undefined) updateData.qr_code_offset_x_mm = updates.qrCodeOffsetXMm;
  if (updates.qrCodeOffsetYMm !== undefined) updateData.qr_code_offset_y_mm = updates.qrCodeOffsetYMm;
  if (updates.qrCodeEnabled !== undefined) updateData.qr_code_enabled = updates.qrCodeEnabled;
  if (updates.tagOrientation !== undefined) updateData.tag_orientation = updates.tagOrientation;
  if (updates.qrCodeDataFields !== undefined) updateData.qr_code_data_fields = updates.qrCodeDataFields;
  if (updates.qrCodeSellerAccess !== undefined) updateData.qr_code_seller_access = updates.qrCodeSellerAccess;
  if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

  const { data, error } = await supabase
    .from('seller_receipt_templates')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return mapSellerReceiptTemplateFromDb(data);
};

export const deleteSellerReceiptTemplate = async (templateId: string): Promise<void> => {
  const { error } = await supabase.from('seller_receipt_templates').delete().eq('id', templateId);
  if (error) throw new Error(error.message ?? `Failed to delete seller receipt template: ${error.code ?? 'unknown'}`);
};

function normalizeTagOrientation(
  raw: unknown,
  widthMm: number,
  heightMm: number
): TagPrintOrientation {
  if (raw === 'landscape' || raw === 'portrait') return raw;
  return widthMm > heightMm ? 'landscape' : 'portrait';
}

function mapSellerReceiptTemplateFromDb(dbTemplate: any): SellerReceiptTemplate {
  const tagFields = (dbTemplate.tag_fields as TagField[]) || [];
  const widthMm = parseFloat(dbTemplate.width_mm);
  const heightMm = parseFloat(dbTemplate.height_mm);
  return {
    id: dbTemplate.id,
    organizationId: dbTemplate.organization_id,
    name: dbTemplate.name,
    description: dbTemplate.description,
    layoutType: dbTemplate.layout_type as TagLayoutType,
    widthMm,
    heightMm,
    tagFields,
    requiredFields: (dbTemplate.required_fields as string[]) || [],
    categoryIds: dbTemplate.category_ids || undefined,
    fontFamily: dbTemplate.font_family,
    fontSize: parseFloat(dbTemplate.font_size),
    borderWidth: parseFloat(dbTemplate.border_width),
    qrCodeSize: parseFloat(dbTemplate.qr_code_size),
    qrCodePosition: dbTemplate.qr_code_position as QRCodePosition,
    qrCodeOffsetXMm:
      dbTemplate.qr_code_offset_x_mm != null ? parseFloat(dbTemplate.qr_code_offset_x_mm) : 0,
    qrCodeOffsetYMm:
      dbTemplate.qr_code_offset_y_mm != null ? parseFloat(dbTemplate.qr_code_offset_y_mm) : 0,
    qrCodeEnabled: Boolean(dbTemplate.qr_code_enabled),
    qrCodeDataFields: dbTemplate.qr_code_data_fields || [],
    qrCodeSellerAccess: dbTemplate.qr_code_seller_access || [],
    tagOrientation: normalizeTagOrientation(dbTemplate.tag_orientation, widthMm, heightMm),
    isDefault: dbTemplate.is_default,
    isActive: dbTemplate.is_active,
    displayOrder: dbTemplate.display_order,
    createdAt: new Date(dbTemplate.created_at),
    updatedAt: new Date(dbTemplate.updated_at),
  };
}
