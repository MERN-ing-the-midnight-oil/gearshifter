// QR receipt handoff: POST create|complete|cancel (JWT). GET ?t= signed intent — public preview for buyer photo.
// Uses service role after session checks. Signs tokens with BUYER_RECEIPT_HMAC_SECRET and message prefix "intent:".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import QRCode from 'https://esm.sh/qrcode@1.5.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHECK_IN_BUCKET = 'item-check-in-photos';
const INTENT_PREFIX = 'intent:';

function tryNormalizePhoneE164US(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (t.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function signIntentId(intentId: string, secret: string): Promise<string> {
  const sig = await hmacSha256Hex(`${INTENT_PREFIX}${intentId}`, secret);
  return `${intentId}.${sig}`;
}

function parseIntentToken(token: string): { intentId: string; sig: string } | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === token.length - 1) return null;
  const intentId = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!/^[0-9a-f]{64}$/i.test(sig)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intentId)) {
    return null;
  }
  return { intentId, sig: sig.toLowerCase() };
}

async function verifyIntentToken(token: string, secret: string): Promise<string | null> {
  const parsed = parseIntentToken(token.trim());
  if (!parsed) return null;
  const expected = await hmacSha256Hex(`${INTENT_PREFIX}${parsed.intentId}`, secret);
  if (!timingSafeEqualHex(expected, parsed.sig)) return null;
  return parsed.intentId;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type IntentRow = {
  id: string;
  expires_at: string;
  item_id: string;
  event_id: string;
  seller_id: string;
  sold_price: number | string;
  commission_amount: number | string;
  seller_amount: number | string;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  processed_by: string;
  status: string;
  completed_transaction_id: string | null;
};

async function handleGet(req: Request): Promise<Response> {
  const secret = Deno.env.get('BUYER_RECEIPT_HMAC_SECRET')?.trim();
  if (!secret) {
    return new Response('Not configured.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('t')?.trim() ?? '';
  if (!token) {
    return new Response('Missing link.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const intentId = await verifyIntentToken(token, secret);
  if (!intentId) {
    return new Response('Invalid link.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: intent, error: intErr } = await service
    .from('pos_sale_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();

  if (intErr || !intent) {
    return new Response('Not found.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  const row = intent as IntentRow;
  if (row.status === 'completed') {
    return new Response('This handoff receipt was already used.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  if (row.status === 'cancelled') {
    return new Response('This handoff was cancelled.', { status: 410, headers: { 'Content-Type': 'text/plain' } });
  }

  const exp = new Date(row.expires_at).getTime();
  if (Number.isFinite(exp) && exp < Date.now()) {
    return new Response('This link has expired. Ask the volunteer for a new QR.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { data: item } = await service
    .from('items')
    .select('item_number, check_in_photo_storage_path')
    .eq('id', row.item_id)
    .maybeSingle();

  const { data: ev } = await service.from('events').select('name').eq('id', row.event_id).maybeSingle();

  let photoUrl: string | null = null;
  const path = item?.check_in_photo_storage_path?.trim();
  if (path) {
    const { data: signed } = await service.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 60 * 60 * 6);
    photoUrl = signed?.signedUrl ?? null;
  }

  const soldPrice = typeof row.sold_price === 'number' ? row.sold_price : Number(row.sold_price);
  const priceStr = Number.isFinite(soldPrice) ? soldPrice.toFixed(2) : String(row.sold_price);
  const eventName = ev?.name?.trim() || 'Event';
  const itemNum = item?.item_number ?? '—';
  const buyer = row.buyer_name?.trim() || 'Buyer';

  const receiptPageUrl = `${url.origin}${url.pathname}?t=${encodeURIComponent(token)}`;
  let receiptQr = '';
  try {
    receiptQr = await QRCode.toDataURL(receiptPageUrl, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
  } catch (e) {
    console.error('pos-receipt-intent GET: QR failed', e);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(eventName)} — receipt to save</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 16px; background: #f6f7f9; color: #111; }
    main { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 1.05rem; margin: 0 0 8px; }
    .muted { color: #555; font-size: 0.88rem; margin-bottom: 14px; line-height: 1.4; }
    .row { margin: 6px 0; font-size: 0.92rem; }
    .label { color: #666; display: inline-block; min-width: 6.5rem; }
    img.photo { width: 100%; border-radius: 8px; display: block; background: #eee; margin-top: 12px; }
    img.qr { width: 200px; height: 200px; display: block; margin: 12px auto 0; }
  </style>
</head>
<body>
  <main>
    <h1>Snap or save this receipt</h1>
    <p class="muted">The volunteer will mark this as received on their device after you photograph this screen (or the QR below). Sale is not final until they confirm.</p>
    <div class="row"><span class="label">Event</span>${escHtml(eventName)}</div>
    <div class="row"><span class="label">Item #</span><strong>${escHtml(itemNum)}</strong></div>
    <div class="row"><span class="label">Price</span><strong>$${escHtml(priceStr)}</strong></div>
    <div class="row"><span class="label">Buyer</span>${escHtml(buyer)}</div>
    ${receiptQr ? `<img class="qr" src="${receiptQr}" alt="Receipt QR" width="200" height="200"/>` : ''}
    <h2 style="font-size:0.9rem;margin:16px 0 6px;color:#333">Check-in reference</h2>
    ${
      photoUrl
        ? `<img class="photo" src="${escHtml(photoUrl)}" alt="Check-in photo" width="400" height="400"/>`
        : `<p class="muted">No check-in photo for this item.</p>`
    }
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return handleGet(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const secret = Deno.env.get('BUYER_RECEIPT_HMAC_SECRET')?.trim();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: {
    action?: string;
    item_id?: string;
    sold_price?: number;
    buyer_name?: string;
    buyer_email?: string | null;
    buyer_phone?: string | null;
    intent_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' });
  }

  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const processedBy = user.id;

  if (action === 'cancel' || action === 'complete') {
    if (!secret) {
      return json({ ok: false, error: 'BUYER_RECEIPT_HMAC_SECRET is not configured.' });
    }
    const intentToken = typeof body.intent_token === 'string' ? body.intent_token.trim() : '';
    if (!intentToken) {
      return json({ ok: false, error: 'intent_token is required' });
    }
    const intentId = await verifyIntentToken(intentToken, secret);
    if (!intentId) {
      return json({ ok: false, error: 'Invalid intent_token' });
    }

    const { data: intent, error: ie } = await service
      .from('pos_sale_intents')
      .select('*')
      .eq('id', intentId)
      .maybeSingle();

    if (ie || !intent) {
      return json({ ok: false, error: 'Intent not found' });
    }

    const row = intent as IntentRow;
    if (row.processed_by !== processedBy) {
      return json({ ok: false, error: 'Only the volunteer who created this handoff can update it.' });
    }

    if (action === 'cancel') {
      if (row.status !== 'pending') {
        return json({ ok: false, error: 'This handoff is no longer pending.' });
      }
      const { error: ce } = await service
        .from('pos_sale_intents')
        .update({ status: 'cancelled' })
        .eq('id', intentId)
        .eq('status', 'pending');
      if (ce) {
        return json({ ok: false, error: ce.message || 'Could not cancel' });
      }
      return json({ ok: true });
    }

    // complete
    if (row.status !== 'pending') {
      return json({ ok: false, error: 'This handoff is no longer pending.' });
    }
    const exp = new Date(row.expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) {
      await service.from('pos_sale_intents').update({ status: 'cancelled' }).eq('id', intentId);
      return json({ ok: false, error: 'This handoff has expired. Create a new QR.' });
    }

    const { data: item, error: itemErr } = await service
      .from('items')
      .select('id, status')
      .eq('id', row.item_id)
      .maybeSingle();

    if (itemErr || !item || item.status !== 'for_sale') {
      return json({
        ok: false,
        error: 'Item is no longer available for sale (it may have sold elsewhere).',
      });
    }

    const soldAt = new Date().toISOString();
    const { data: txn, error: txnErr } = await service
      .from('transactions')
      .insert({
        event_id: row.event_id,
        item_id: row.item_id,
        seller_id: row.seller_id,
        sold_price: row.sold_price,
        commission_amount: row.commission_amount,
        seller_amount: row.seller_amount,
        payment_method: null,
        processed_by: processedBy,
        sold_at: soldAt,
        buyer_name: row.buyer_name,
        buyer_email: row.buyer_email,
        buyer_phone: row.buyer_phone,
        buyer_contact_info: {},
      })
      .select()
      .single();

    if (txnErr || !txn) {
      return json({ ok: false, error: txnErr?.message || 'Failed to create transaction' });
    }

    const transactionId = txn.id as string;

    const { error: updErr } = await service
      .from('items')
      .update({
        status: 'sold',
        sold_at: soldAt,
        sold_price: row.sold_price,
      })
      .eq('id', row.item_id)
      .eq('status', 'for_sale');

    if (updErr) {
      await service.from('transactions').delete().eq('id', transactionId);
      return json({ ok: false, error: updErr.message || 'Failed to mark item sold' });
    }

    const { error: intUpdErr } = await service
      .from('pos_sale_intents')
      .update({
        status: 'completed',
        completed_transaction_id: transactionId,
      })
      .eq('id', intentId)
      .eq('status', 'pending');

    if (intUpdErr) {
      console.error('pos-receipt-intent: intent update failed after sale', intUpdErr);
      await service.from('transactions').delete().eq('id', transactionId);
      await service
        .from('items')
        .update({ status: 'for_sale', sold_at: null, sold_price: null })
        .eq('id', row.item_id);
      return json({ ok: false, error: 'Sale could not be finalized. Try again.' });
    }

    try {
      const notifyRes = await fetch(`${supabaseUrl}/functions/v1/notify-seller-on-sale`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      if (!notifyRes.ok) {
        const txt = await notifyRes.text().catch(() => '');
        console.warn('pos-receipt-intent: notify-seller-on-sale', notifyRes.status, txt);
      }
    } catch (e) {
      console.warn('pos-receipt-intent: notify-seller-on-sale failed', e);
    }

    return json({ ok: true, transaction: txn });
  }

  // create
  if (action !== 'create') {
    return json({ ok: false, error: 'Unknown action. Use create, complete, or cancel.' });
  }

  if (!secret) {
    return json({ ok: false, error: 'BUYER_RECEIPT_HMAC_SECRET is not configured for signing the QR link.' });
  }

  const itemId = typeof body.item_id === 'string' ? body.item_id.trim() : '';
  const buyerName = typeof body.buyer_name === 'string' ? body.buyer_name.trim() : '';
  const soldPrice =
    typeof body.sold_price === 'number' && Number.isFinite(body.sold_price)
      ? body.sold_price
      : Number(body.sold_price);
  const buyerEmail =
    typeof body.buyer_email === 'string' && body.buyer_email.trim()
      ? body.buyer_email.trim()
      : null;
  const phoneRaw = typeof body.buyer_phone === 'string' ? body.buyer_phone : '';
  const buyerPhoneE164 = tryNormalizePhoneE164US(phoneRaw);

  if (!itemId || !buyerName) {
    return json({ ok: false, error: 'item_id and buyer_name are required' });
  }
  if (!soldPrice || soldPrice <= 0 || !Number.isFinite(soldPrice)) {
    return json({ ok: false, error: 'sold_price must be a positive number' });
  }

  const { data: item, error: itemErr } = await userClient
    .from('items')
    .select('id, event_id, seller_id, status, item_number')
    .eq('id', itemId)
    .maybeSingle();

  if (itemErr || !item) {
    return json({ ok: false, error: 'Item not found or access denied' });
  }
  if (item.status !== 'for_sale') {
    return json({ ok: false, error: 'Item is not available for sale (must be for_sale).' });
  }

  const { data: eventRow, error: eventErr } = await userClient
    .from('events')
    .select('id, organizations(commission_rate)')
    .eq('id', item.event_id)
    .maybeSingle();

  if (eventErr || !eventRow) {
    return json({ ok: false, error: 'Event not found or access denied' });
  }

  const orgWrap = eventRow.organizations as { commission_rate?: number | string } | { commission_rate?: number | string }[] | null;
  const org = Array.isArray(orgWrap) ? orgWrap[0] : orgWrap;
  const commissionRate = org?.commission_rate != null ? Number(org.commission_rate) : 0;
  const rate = Number.isFinite(commissionRate) ? commissionRate : 0;
  const commissionAmount = soldPrice * rate;
  const sellerAmount = soldPrice - commissionAmount;

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { data: inserted, error: insErr } = await service
    .from('pos_sale_intents')
    .insert({
      item_id: itemId,
      event_id: item.event_id,
      seller_id: item.seller_id,
      sold_price: soldPrice,
      commission_amount: commissionAmount,
      seller_amount: sellerAmount,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhoneE164,
      processed_by: processedBy,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    return json({ ok: false, error: insErr?.message || 'Could not create handoff receipt' });
  }

  const intentId = inserted.id as string;
  const intentToken = await signIntentId(intentId, secret);
  const base = supabaseUrl.replace(/\/$/, '');
  const intentPublicUrl = `${base}/functions/v1/pos-receipt-intent?t=${encodeURIComponent(intentToken)}`;

  return json({
    ok: true,
    intent_token: intentToken,
    intent_public_url: intentPublicUrl,
    expires_at: expiresAt,
  });
});
