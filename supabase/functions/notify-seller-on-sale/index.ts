// Supabase Edge: after a sale — optional Expo push + optional Twilio SMS to seller (org `sale_behavior_settings`).
// Verifies JWT can read the transaction, then uses service role for seller/org data.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SaleBehaviorSettings = {
  notifySellerSmsOnSale?: boolean;
  notifySellerPushOnSale?: boolean;
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
  return { ok: true, detail: twJson };
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
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { transaction_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const transactionId = typeof body.transaction_id === 'string' ? body.transaction_id.trim() : '';
  if (!transactionId) {
    return new Response(JSON.stringify({ error: 'transaction_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
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

  const { data: txn, error: txnErr } = await userClient
    .from('transactions')
    .select(
      `
      id,
      event_id,
      seller_id,
      sold_price,
      item_id,
      items (
        item_number,
        seller_item_label
      )
    `
    )
    .eq('id', transactionId)
    .maybeSingle();

  if (txnErr || !txn) {
    return new Response(JSON.stringify({ error: 'Transaction not found or access denied' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let saleBehavior: SaleBehaviorSettings = {
    notifySellerSmsOnSale: false,
    notifySellerPushOnSale: true,
  };

  const { data: evRow } = await service
    .from('events')
    .select('organization_id')
    .eq('id', txn.event_id as string)
    .maybeSingle();

  const orgId = evRow?.organization_id as string | undefined;
  if (orgId) {
    const { data: orgRow } = await service
      .from('organizations')
      .select('sale_behavior_settings')
      .eq('id', orgId)
      .maybeSingle();
    const rawSb = orgRow?.sale_behavior_settings;
    if (rawSb && typeof rawSb === 'object') {
      saleBehavior = {
        notifySellerSmsOnSale: Boolean((rawSb as SaleBehaviorSettings).notifySellerSmsOnSale),
        notifySellerPushOnSale:
          (rawSb as SaleBehaviorSettings).notifySellerPushOnSale !== false,
      };
    }
  }

  const { data: seller, error: sellerErr } = await service
    .from('sellers')
    .select('expo_push_token, phone, first_name, last_name')
    .eq('id', txn.seller_id)
    .maybeSingle();

  if (sellerErr) {
    return new Response(JSON.stringify({ error: sellerErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawItem = txn.items as
    | { item_number?: string; seller_item_label?: string | null }
    | { item_number?: string; seller_item_label?: string | null }[]
    | null;
  const item = Array.isArray(rawItem) ? rawItem[0] : rawItem;
  const itemNumber = item?.item_number ?? 'Your item';
  const label = item?.seller_item_label?.trim();
  const soldPrice = typeof txn.sold_price === 'number' ? txn.sold_price : Number(txn.sold_price);
  const priceStr = Number.isFinite(soldPrice) ? soldPrice.toFixed(2) : String(txn.sold_price);
  const summary = label ? `${label} (${itemNumber}) sold for $${priceStr}` : `${itemNumber} sold for $${priceStr}`;

  let pushResult: unknown = null;
  let smsResult: unknown = null;

  if (saleBehavior.notifySellerPushOnSale !== false) {
    const token = seller?.expo_push_token;
    if (!token) {
      pushResult = { skipped: true, reason: 'no_push_token' };
    } else if (!expoAccessToken) {
      console.warn('notify-seller-on-sale: EXPO_ACCESS_TOKEN not set; skipping Expo send');
      pushResult = { skipped: true, reason: 'no_expo_access_token' };
    } else {
      const title = 'Item sold';
      const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Authorization: `Bearer ${expoAccessToken}`,
        },
        body: JSON.stringify({
          to: token,
          title,
          body: summary,
          data: { transactionId: txn.id, itemId: txn.item_id },
          sound: 'default',
        }),
      });

      const pushJson = await pushRes.json().catch(() => ({}));
      if (!pushRes.ok) {
        console.error('Expo push failed', pushRes.status, pushJson);
        return new Response(JSON.stringify({ error: 'Expo push failed', detail: pushJson }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      pushResult = pushJson;
    }
  } else {
    pushResult = { skipped: true, reason: 'notifySellerPushOff' };
  }

  if (saleBehavior.notifySellerSmsOnSale === true) {
    const phoneRaw = seller?.phone != null ? String(seller.phone) : '';
    const to = tryNormalizePhoneE164US(phoneRaw);
    if (!to) {
      smsResult = { skipped: true, reason: 'invalid_or_missing_phone' };
    } else {
      const bodyText =
        `GearSwap: sold — ${summary}. Funds will follow your organization's payout schedule. Reply STOP to opt out.`;
      const tw = await sendTwilioSms(to, bodyText);
      smsResult = tw.ok ? { ok: true, detail: tw.detail } : { ok: false, detail: tw.detail };
      if (!tw.ok) {
        console.error('notify-seller-on-sale: Twilio SMS failed', tw.detail);
      }
    }
  } else {
    smsResult = { skipped: true, reason: 'notifySellerSmsOff' };
  }

  return new Response(JSON.stringify({ ok: true, push: pushResult, sms: smsResult }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
