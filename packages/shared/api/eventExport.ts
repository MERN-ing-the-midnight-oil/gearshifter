import { supabase } from './supabase';

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * One row per item: consignee info, item fields, sale and payout columns.
 */
export async function buildEventConsigneeExportCsv(eventId: string): Promise<string> {
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select(
      `
      id,
      item_number,
      status,
      category,
      description,
      size,
      original_price,
      sold_price,
      paid_at,
      donate_if_unsold,
      seller_id
    `
    )
    .eq('event_id', eventId)
    .order('item_number', { ascending: true });

  if (itemsError) throw itemsError;

  const rows = items || [];
  const itemIds = rows.map((r: { id: string }) => r.id);
  const sellerIds = [...new Set(rows.map((r: { seller_id: string }) => r.seller_id))];

  const sellerById = new Map<
    string,
    { first_name: string; last_name: string; email: string | null; phone: string | null }
  >();

  if (sellerIds.length > 0) {
    const { data: sellersRows, error: sellersError } = await supabase
      .from('sellers')
      .select('id, first_name, last_name, email, phone')
      .in('id', sellerIds);

    if (sellersError) throw sellersError;

    for (const s of sellersRows || []) {
      sellerById.set(s.id, {
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email,
        phone: s.phone,
      });
    }
  }

  const { data: txns, error: txErr } = await supabase
    .from('transactions')
    .select('item_id, sold_price, seller_amount, commission_amount')
    .in('item_id', itemIds);

  if (txErr) throw txErr;

  type TxnRow = {
    item_id: string;
    sold_price: number;
    seller_amount: number;
    commission_amount: number;
  };

  const txnByItem = new Map<string, TxnRow>(
    ((txns || []) as TxnRow[]).map((t) => [t.item_id, t])
  );

  const header = [
    'seller_first_name',
    'seller_last_name',
    'seller_email',
    'seller_phone',
    'item_number',
    'item_status',
    'category',
    'description',
    'size',
    'original_price',
    'donate_if_unsold',
    'sold_price',
    'seller_amount_owed',
    'commission_amount',
    'paid_at',
  ];

  const lines = [header.join(',')];

  for (const row of rows as any[]) {
    const s = sellerById.get(row.seller_id);
    const t = txnByItem.get(row.id);
    lines.push(
      [
        csvEscape(s?.first_name),
        csvEscape(s?.last_name),
        csvEscape(s?.email),
        csvEscape(s?.phone),
        csvEscape(row.item_number),
        csvEscape(row.status),
        csvEscape(row.category),
        csvEscape(row.description),
        csvEscape(row.size),
        csvEscape(row.original_price),
        csvEscape(row.donate_if_unsold),
        csvEscape(t?.sold_price ?? row.sold_price ?? ''),
        csvEscape(t?.seller_amount ?? ''),
        csvEscape(t?.commission_amount ?? ''),
        csvEscape(row.paid_at ? new Date(row.paid_at).toISOString() : ''),
      ].join(',')
    );
  }

  return lines.join('\n');
}
