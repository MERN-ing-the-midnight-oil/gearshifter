// POS: create sale + mark item sold only after Twilio accepts the buyer receipt SMS. Rolls back on SMS failure.
// Requires BUYER_RECEIPT_HMAC_SECRET + Twilio (same env as auth-send-sms). JWT = org user with POS permission.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function signTransactionId(transactionId: string, secret: string): Promise<string> {
  const sig = await hmacSha256Hex(transactionId, secret);
  return `${transactionId}.${sig}`;
}

async function sendTwilioSms(to: string, body: string): Promise<{ ok: boolean; detail?: unknown }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!accountSid || !authToken) {
    return { ok: false, detail: 'Twilio credentials missing' };
  }
  const mg = messagingServiceSid?.trim();
  if (!mg && !fromNumber?.trim()) {
    return { ok: false, detail: 'Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID' };
  }
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);
  const form = new URLSearchParams({ To: to, Body: body });
  if (mg) form.set('MessagingServiceSid', mg);
  else form.set('From', fromNumber!.trim());

  const tw = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const twJson = (await tw.json().catch(() => ({}))) as Record<string, unknown>;
  if (!tw.ok) {
    return { ok: false, detail: twJson };
  }
  const twilioStatus = typeof twJson.status === 'string' ? twJson.status.trim().toLowerCase() : '';
  if (twJson.error_code != null || twilioStatus === 'failed' || twilioStatus === 'undelivered' || twilioStatus === 'canceled') {
    return { ok: false, detail: twJson };
  }
  const accepted = new Set(['queued', 'accepted', 'sending', 'sent', 'scheduled', 'received', '']);
  if (twilioStatus && !accepted.has(twilioStatus)) {
    return { ok: false, detail: twJson };
  }
  return { ok: true, detail: twJson };
}

async function revertSale(
  service: ReturnType<typeof createClient>,
  itemId: string,
  transactionId: string
): Promise<void> {
  await service.from('transactions').delete().eq('id', transactionId);
  await service
    .from('items')
    .update({ status: 'for_sale', sold_at: null, sold_price: null })
    .eq('id', itemId);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
  const receiptSecret = Deno.env.get('BUYER_RECEIPT_HMAC_SECRET')?.trim();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!receiptSecret) {
    return json({
      ok: false,
      error:
        'Receipt SMS is not configured (set BUYER_RECEIPT_HMAC_SECRET on Edge secrets). Sales cannot complete until the buyer receipt can be sent.',
    });
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!accountSid || !authToken || (!messagingServiceSid?.trim() && !fromNumber?.trim())) {
    return json({
      ok: false,
      error:
        'Twilio is not configured for receipt SMS. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.',
    });
  }

  let body: {
    item_id?: string;
    sold_price?: number;
    buyer_name?: string;
    buyer_email?: string | null;
    buyer_phone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' });
  }

  const itemId = typeof body.item_id === 'string' ? body.item_id.trim() : '';
  const buyerName = typeof body.buyer_name === 'string' ? body.buyer_name.trim() : '';
  const buyerPhoneRaw = typeof body.buyer_phone === 'string' ? body.buyer_phone : '';
  const soldPrice =
    typeof body.sold_price === 'number' && Number.isFinite(body.sold_price)
      ? body.sold_price
      : Number(body.sold_price);
  const buyerEmail =
    typeof body.buyer_email === 'string' && body.buyer_email.trim()
      ? body.buyer_email.trim()
      : null;

  if (!itemId || !buyerName) {
    return json({ ok: false, error: 'item_id and buyer_name are required' });
  }

  const buyerPhoneE164 = tryNormalizePhoneE164US(buyerPhoneRaw);
  if (!buyerPhoneE164) {
    return json({
      ok: false,
      error: 'A valid buyer phone number is required so we can text the digital receipt.',
    });
  }

  if (!soldPrice || soldPrice <= 0 || !Number.isFinite(soldPrice)) {
    return json({ ok: false, error: 'sold_price must be a positive number' });
  }

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

  const soldAt = new Date().toISOString();

  const { data: transactionData, error: transactionError } = await userClient
    .from('transactions')
    .insert({
      event_id: item.event_id,
      item_id: itemId,
      seller_id: item.seller_id,
      sold_price: soldPrice,
      commission_amount: commissionAmount,
      seller_amount: sellerAmount,
      payment_method: null,
      processed_by: processedBy,
      sold_at: soldAt,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhoneE164,
      buyer_contact_info: {},
    })
    .select()
    .single();

  if (transactionError || !transactionData) {
    return json({
      ok: false,
      error: transactionError?.message || 'Failed to create sale record',
    });
  }

  const transactionId = transactionData.id as string;

  const { error: itemUpdateErr } = await userClient
    .from('items')
    .update({
      status: 'sold',
      sold_at: soldAt,
      sold_price: soldPrice,
    })
    .eq('id', itemId);

  if (itemUpdateErr) {
    await service.from('transactions').delete().eq('id', transactionId);
    return json({ ok: false, error: itemUpdateErr.message || 'Failed to mark item sold' });
  }

  const token = await signTransactionId(transactionId, receiptSecret);
  const base = supabaseUrl.replace(/\/$/, '');
  const receiptUrl = `${base}/functions/v1/buyer-sale-receipt?t=${encodeURIComponent(token)}`;
  const itemNumber = (item.item_number as string) ?? 'your item';
  const smsBody = `GearSwap: digital receipt for item #${itemNumber}. Tap for exit verification (photos + QR): ${receiptUrl}`;

  const tw = await sendTwilioSms(buyerPhoneE164, smsBody);
  if (!tw.ok) {
    console.error('pos-complete-sale: Twilio failed after DB write; reverting', tw.detail);
    await revertSale(service, itemId, transactionId);
    return json({
      ok: false,
      error:
        'The receipt text was not accepted by the carrier (Twilio). The sale was not completed. Ask the buyer to check their number, then try again.',
    });
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
      console.warn('pos-complete-sale: notify-seller-on-sale', notifyRes.status, txt);
    }
  } catch (e) {
    console.warn('pos-complete-sale: notify-seller-on-sale failed', e);
  }

  return json({ ok: true, transaction: transactionData, buyer_receipt_url: receiptUrl });
});
