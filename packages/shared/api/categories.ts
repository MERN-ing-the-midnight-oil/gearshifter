import { supabase } from './supabase';
import type { ItemCategory } from '../types/models';

function readAllowedItemCategoryIdsFromEventSettings(settings: unknown): Set<string> | null {
  if (!settings || typeof settings !== 'object') return null;
  const raw = (settings as { allowedItemCategoryIds?: unknown }).allowedItemCategoryIds;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const ids = raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

/**
 * Flatten org category tree for pickers (parent › child labels).
 */
export function flattenItemCategoriesForPicker(categories: ItemCategory[]): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  const walk = (cats: ItemCategory[], prefix: string) => {
    for (const c of cats) {
      const label = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ id: c.id, label });
      if (c.children?.length) walk(c.children, label);
    }
  };
  walk(categories, '');
  return out;
}

/**
 * Limit a category tree to UUIDs allowed for an event (from `events.settings.allowedItemCategoryIds`).
 */
export function filterItemCategoriesByAllowedIds(
  categories: ItemCategory[],
  allowedIds: Set<string>
): ItemCategory[] {
  return categories
    .map((c) => {
      const children = c.children?.length
        ? filterItemCategoriesByAllowedIds(c.children, allowedIds)
        : [];
      const selfAllowed = allowedIds.has(c.id);
      if (selfAllowed) {
        return { ...c, children: c.children };
      }
      if (children.length > 0) {
        return { ...c, children };
      }
      return null;
    })
    .filter((c): c is ItemCategory => c !== null);
}

/**
 * Limit a category tree to IDs the seller chose at swap registration (`_gf_planned_item_category_ids`).
 * If a parent id was selected, that branch is kept in full; if only leaves were selected, only those branches remain.
 */
export function filterItemCategoriesBySellerPlan(
  categories: ItemCategory[],
  plannedIds: Set<string>
): ItemCategory[] {
  return categories
    .map((c) => {
      const children = c.children?.length
        ? filterItemCategoriesBySellerPlan(c.children, plannedIds)
        : [];
      const self = plannedIds.has(c.id);
      if (self) {
        return { ...c, children: c.children };
      }
      if (children.length > 0) {
        return { ...c, children };
      }
      return null;
    })
    .filter((c): c is ItemCategory => c !== null);
}

/**
 * Org item categories for an event: full org tree unless the event restricts `settings.allowedItemCategoryIds`.
 */
export const getEventItemCategoryTree = async (eventId: string): Promise<ItemCategory[]> => {
  const { data: row, error } = await supabase
    .from('events')
    .select('organization_id, settings')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return [];

  const tree = await getOrganizationCategories(row.organization_id);
  const allowed = readAllowedItemCategoryIdsFromEventSettings(row.settings);
  if (!allowed) return tree;
  return filterItemCategoriesByAllowedIds(tree, allowed);
};

/**
 * Get field definitions for a specific category
 */
export const getCategoryFieldDefinitions = async (
  categoryId: string
): Promise<any[]> => {
  const { data, error } = await supabase
    .from('item_field_definitions')
    .select('*')
    .eq('category_id', categoryId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Get all categories for an organization (with nesting)
 */
export const getOrganizationCategories = async (
  organizationId: string
): Promise<ItemCategory[]> => {
  const { data, error } = await supabase
    .from('item_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  // Build nested structure
  const categories = data.map(mapCategoryFromDb);
  return buildCategoryTree(categories);
};

/**
 * Get a single category by ID
 */
export const getCategory = async (categoryId: string): Promise<ItemCategory | null> => {
  const { data, error } = await supabase
    .from('item_categories')
    .select('*')
    .eq('id', categoryId)
    .single();

  if (error) throw error;
  return data ? mapCategoryFromDb(data) : null;
};

/**
 * Create a new category
 */
export const createCategory = async (
  organizationId: string,
  categoryData: {
    name: string;
    parentId?: string;
    displayOrder?: number;
    gearTagTemplateId?: string;
    fieldDefinitions?: Array<{
      name: string;
      label: string;
      fieldType: string;
      isRequired?: boolean;
      displayOrder?: number;
      defaultValue?: string;
      placeholder?: string;
      helpText?: string;
      options?: string[];
    }>;
  }
): Promise<ItemCategory> => {
  // First create the category
  const { data: category, error: categoryError } = await supabase
    .from('item_categories')
    .insert({
      organization_id: organizationId,
      name: categoryData.name,
      parent_id: categoryData.parentId || null,
      display_order: categoryData.displayOrder || 0,
      gear_tag_template_id: categoryData.gearTagTemplateId || null,
    })
    .select()
    .single();

  if (categoryError) throw categoryError;

  // Then create field definitions for this category if provided
  if (categoryData.fieldDefinitions && categoryData.fieldDefinitions.length > 0) {
    const fieldInserts = categoryData.fieldDefinitions.map((field, index) => ({
      organization_id: organizationId,
      category_id: category.id,
      name: field.name,
      label: field.label,
      field_type: field.fieldType,
      is_required: field.isRequired || false,
      display_order: field.displayOrder ?? index,
      default_value: field.defaultValue || null,
      placeholder: field.placeholder || null,
      help_text: field.helpText || null,
      options: field.options || null,
    }));

    const { error: fieldsError } = await supabase
      .from('item_field_definitions')
      .insert(fieldInserts);

    if (fieldsError) {
      // Rollback category creation if field creation fails
      await supabase.from('item_categories').delete().eq('id', category.id);
      throw fieldsError;
    }
  }

  return mapCategoryFromDb(category);
};

/**
 * Update a category
 */
export const updateCategory = async (
  categoryId: string,
  updates: {
    name?: string;
    parentId?: string;
    displayOrder?: number;
    isActive?: boolean;
    gearTagTemplateId?: string;
  }
): Promise<ItemCategory> => {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.parentId !== undefined) updateData.parent_id = updates.parentId || null;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.gearTagTemplateId !== undefined) updateData.gear_tag_template_id = updates.gearTagTemplateId || null;

  const { data, error } = await supabase
    .from('item_categories')
    .update(updateData)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;
  return mapCategoryFromDb(data);
};

/**
 * Delete a category (soft delete by setting is_active to false)
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  const { error } = await supabase
    .from('item_categories')
    .update({ is_active: false })
    .eq('id', categoryId);

  if (error) throw error;
};

/**
 * Reorder categories
 */
export const reorderCategories = async (
  categoryOrders: { id: string; displayOrder: number }[]
): Promise<void> => {
  // Update all categories in a transaction-like manner
  const updates = categoryOrders.map(({ id, displayOrder }) =>
    supabase
      .from('item_categories')
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
 * Helper to map database category to ItemCategory model
 */
function mapCategoryFromDb(dbCategory: any): ItemCategory {
  return {
    id: dbCategory.id,
    organizationId: dbCategory.organization_id,
    parentId: dbCategory.parent_id,
    name: dbCategory.name,
    displayOrder: dbCategory.display_order,
    isActive: dbCategory.is_active,
    gearTagTemplateId: dbCategory.gear_tag_template_id,
    createdAt: new Date(dbCategory.created_at),
  };
}

/**
 * Build a tree structure from flat category list
 */
function buildCategoryTree(categories: ItemCategory[]): ItemCategory[] {
  const categoryMap = new Map<string, ItemCategory>();
  const rootCategories: ItemCategory[] = [];

  // First pass: create map and initialize children arrays
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: build tree
  categories.forEach((cat) => {
    const category = categoryMap.get(cat.id)!;
    if (cat.parentId) {
      const parent = categoryMap.get(cat.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  return rootCategories;
}










