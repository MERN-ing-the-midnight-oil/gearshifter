// Supabase Edge Function: send Expo push when a sale is recorded (called by organizer after recordSale).
// Verifies JWT belongs to an org user who can read the transaction, then uses service role to read seller push token.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const { data: seller, error: sellerErr } = await service
    .from('sellers')
    .select('expo_push_token')
    .eq('id', txn.seller_id)
    .maybeSingle();

  if (sellerErr) {
    return new Response(JSON.stringify({ error: sellerErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = seller?.expo_push_token;
  if (!token) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_push_token' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!expoAccessToken) {
    console.warn('notify-seller-on-sale: EXPO_ACCESS_TOKEN not set; skipping Expo send');
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_expo_access_token' }), {
      status: 200,
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
  const title = 'Item sold';
  const soldPrice = typeof txn.sold_price === 'number' ? txn.sold_price : Number(txn.sold_price);
  const priceStr = Number.isFinite(soldPrice) ? soldPrice.toFixed(2) : String(txn.sold_price);
  const bodyText = label
    ? `${label} (${itemNumber}) sold for $${priceStr}`
    : `${itemNumber} sold for $${priceStr}`;

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
      body: bodyText,
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

  return new Response(JSON.stringify({ ok: true, push: pushJson }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
