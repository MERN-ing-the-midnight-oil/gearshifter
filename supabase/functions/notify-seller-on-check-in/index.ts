// After staff registers an item at check-in, text the seller with a link to their dashboard (check-in photos visible there).
// Caller must be an org user for the item's event (JWT). Uses Twilio when configured (same env as pos-complete-sale).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function dashboardUrlForToken(token: string): string {
  const origin = (Deno.env.get('SELLER_PUBLIC_DASHBOARD_ORIGIN') ?? 'https://gearswap.app').replace(/\/$/, '');
  return `${origin}/seller?token=${encodeURIComponent(token)}`;
}

function tryNormalizePhoneE164US(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (t.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
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
  if (
    twJson.error_code != null ||
    twilioStatus === 'failed' ||
    twilioStatus === 'undelivered' ||
    twilioStatus === 'canceled'
  ) {
    return { ok: false, detail: twJson };
  }
  const accepted = new Set(['queued', 'accepted', 'sending', 'sent', 'scheduled', 'received', '']);
  if (twilioStatus && !accepted.has(twilioStatus)) {
    return { ok: false, detail: twJson };
  }
  return { ok: true, detail: twJson };
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
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: { item_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const itemId = typeof body.item_id === 'string' ? body.item_id.trim() : '';
  if (!itemId) {
    return json({ error: 'item_id required' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ error: 'Invalid session' }, 401);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: item, error: itemErr } = await service
    .from('items')
    .select('id, event_id, seller_id, item_number, status, check_in_photo_storage_path')
    .eq('id', itemId)
    .maybeSingle();

  if (itemErr || !item) {
    return json({ error: 'Item not found' }, 404);
  }

  if (item.status !== 'checked_in') {
    return json({ error: 'Item must be in checked-in (registered) status' }, 400);
  }

  const { data: canOrg, error: rpcErr } = await userClient.rpc('org_user_can_access_event', {
    event_id: item.event_id,
  });
  if (rpcErr || !canOrg) {
    return json({ error: 'Forbidden' }, 403);
  }

  const { data: seller, error: sellerErr } = await service
    .from('sellers')
    .select('phone, access_token')
    .eq('id', item.seller_id)
    .maybeSingle();

  if (sellerErr) {
    return json({ error: sellerErr.message }, 500);
  }

  const phoneRaw = typeof seller?.phone === 'string' ? seller.phone : '';
  const to = tryNormalizePhoneE164US(phoneRaw);
  if (!to) {
    return json({ ok: true, skipped: true, reason: 'no_seller_phone' });
  }

  const itemNumber = typeof item.item_number === 'string' ? item.item_number : 'your item';
  const hasPhoto = !!(item.check_in_photo_storage_path as string | null)?.trim();
  const token = typeof seller?.access_token === 'string' ? seller.access_token.trim() : '';
  const linkPart = token ? ` Dashboard (photos): ${dashboardUrlForToken(token)}` : '';
  const photoPart = hasPhoto ? ' Check-in photo is on your dashboard.' : '';
  const smsBody = `GearSwap: Your item #${itemNumber} is checked in.${photoPart}${linkPart}`;

  const tw = await sendTwilioSms(to, smsBody);
  if (!tw.ok) {
    console.error('notify-seller-on-check-in: Twilio failed', tw.detail);
    return json({ ok: false, error: 'sms_failed', detail: tw.detail }, 200);
  }

  return json({ ok: true, sms: 'sent' });
});
