import { supabase } from './supabase';
import type { OrganizationInventoryItem } from '../types/models';
import { getEvent } from './events';

const PROMOTABLE_STATUSES = new Set([
  'donated',
  'donated_abandoned',
  'unclaimed',
]);

function mapRow(row: any): OrganizationInventoryItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceEventId: row.source_event_id ?? undefined,
    sourceItemId: row.source_item_id ?? undefined,
    itemNumberSnapshot: row.item_number_snapshot ?? undefined,
    description: row.description,
    category: row.category,
    size: row.size ?? undefined,
    originNote: row.origin_note ?? undefined,
    status: row.status,
    listedPrice: row.listed_price != null ? Number(row.listed_price) : undefined,
    salePrice: row.sale_price != null ? Number(row.sale_price) : undefined,
    soldAt: row.sold_at ? new Date(row.sold_at) : undefined,
    sellerOfRecordId: row.seller_of_record_id ?? undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listOrganizationInventory(
  organizationId: string
): Promise<OrganizationInventoryItem[]> {
  const { data, error } = await supabase
    .from('organization_inventory_items')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function addOrganizationInventoryItem(input: {
  organizationId: string;
  description: string;
  category?: string;
  size?: string;
  originNote?: string;
  listedPrice?: number;
  sellerOfRecordId?: string | null;
}): Promise<OrganizationInventoryItem> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user?.id) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('organization_inventory_items')
    .insert({
      organization_id: input.organizationId,
      description: input.description.trim(),
      category: (input.category ?? '').trim(),
      size: input.size?.trim() || null,
      origin_note: input.originNote?.trim() || null,
      listed_price: input.listedPrice ?? null,
      seller_of_record_id: input.sellerOfRecordId ?? null,
      created_by: user.id,
      status: 'in_stock',
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

/**
 * Copy an event item into org-level post-event inventory (e.g. donated / unclaimed).
 */
export async function promoteEventItemToOrganizationInventory(
  itemId: string,
  options?: { originNote?: string }
): Promise<OrganizationInventoryItem> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user?.id) throw new Error('Not authenticated');

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .select(
      'id, event_id, seller_id, item_number, category, description, size, status, original_price'
    )
    .eq('id', itemId)
    .single();

  if (itemErr) throw itemErr;
  if (!item) throw new Error('Item not found');

  if (!PROMOTABLE_STATUSES.has(item.status)) {
    throw new Error(
      'Only donated or unclaimed items can be added to organization inventory'
    );
  }

  const event = await getEvent(item.event_id);
  if (!event) throw new Error('Event not found');

  const orgId = event.organizationId;

  const { data, error } = await supabase
    .from('organization_inventory_items')
    .insert({
      organization_id: orgId,
      source_event_id: item.event_id,
      source_item_id: item.id,
      item_number_snapshot: item.item_number,
      description: item.description,
      category: item.category,
      size: item.size,
      origin_note: options?.originNote?.trim() || null,
      seller_of_record_id: item.seller_id,
      listed_price: item.original_price,
      created_by: user.id,
      status: 'in_stock',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This item is already in organization inventory');
    }
    throw error;
  }

  return mapRow(data);
}

export async function updateOrganizationInventoryItem(
  id: string,
  patch: Partial<{
    status: OrganizationInventoryItem['status'];
    listedPrice: number | null;
    salePrice: number | null;
    soldAt: Date | null;
    originNote: string | null;
    description: string;
    category: string;
  }>
): Promise<void> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status !== undefined) update.status = patch.status;
  if (patch.listedPrice !== undefined) update.listed_price = patch.listedPrice;
  if (patch.salePrice !== undefined) update.sale_price = patch.salePrice;
  if (patch.soldAt !== undefined)
    update.sold_at = patch.soldAt ? patch.soldAt.toISOString() : null;
  if (patch.originNote !== undefined) update.origin_note = patch.originNote;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.category !== undefined) update.category = patch.category;

  const { error } = await supabase
    .from('organization_inventory_items')
    .update(update)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteOrganizationInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('organization_inventory_items').delete().eq('id', id);
  if (error) throw error;
}
