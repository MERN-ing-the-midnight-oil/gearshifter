// Supabase Edge Function: create-seller
// Creates a full seller account: auth user + sellers row + QR code.
// Called by the organizer app for walk-up registration (volunteer at check-in).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SELLER_QR_PREFIX = 'C';

function generateSellerQRCode(sellerId: string): string {
  return `${SELLER_QR_PREFIX}-${sellerId}`;
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function generateSecureAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, '0');
  return hex;
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    /** When set (organizer walk-up check-in), links seller to event so org RLS can SELECT the seller row */
    event_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const last_name = typeof body.last_name === 'string' ? body.last_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const event_id_raw = typeof body.event_id === 'string' ? body.event_id.trim() : '';
  const event_id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    event_id_raw
  )
    ? event_id_raw
    : '';

  if (!first_name || !last_name || !phone || !email) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: first_name, last_name, phone, email' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = randomPassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      phone,
      first_name,
      last_name,
    },
  });

  if (authError) {
    return new Response(
      JSON.stringify({ error: authError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authUserId = authData.user?.id;
  if (!authUserId) {
    return new Response(
      JSON.stringify({ error: 'Auth user was not created' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const sellerId = crypto.randomUUID();
  const qr_code = generateSellerQRCode(sellerId);
  const access_token = generateSecureAccessToken();

  const { data: sellerRow, error: insertError } = await supabase
    .from('sellers')
    .insert({
      id: sellerId,
      auth_user_id: authUserId,
      first_name,
      last_name,
      phone,
      email,
      qr_code,
      access_token,
      is_guest: false,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (event_id) {
    const { data: eventRow, error: eventErr } = await supabase
      .from('events')
      .select('id')
      .eq('id', event_id)
      .maybeSingle();

    if (eventErr || !eventRow) {
      await supabase.from('sellers').delete().eq('id', sellerId);
      await supabase.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: 'Invalid event_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: regErr } = await supabase.from('seller_swap_registrations').insert({
      event_id,
      seller_id: sellerId,
      registration_data: {},
      is_complete: false,
    });

    if (regErr) {
      await supabase.from('sellers').delete().eq('id', sellerId);
      await supabase.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: regErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(
    JSON.stringify({ seller: sellerRow }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
