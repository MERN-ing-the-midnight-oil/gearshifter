// Exchange `sellers.access_token` (opaque) for a normal Supabase Auth session (JWT pair).
// Called from the seller app / web after opening a permanent dashboard link.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: Record<string, unknown>) {
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
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let bodyIn: { seller_access_token?: string; access_token?: string };
  try {
    bodyIn = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const sellerOpaque =
    (typeof bodyIn.seller_access_token === 'string' && bodyIn.seller_access_token) ||
    (typeof bodyIn.access_token === 'string' && bodyIn.access_token) ||
    '';
  const trimmed = sellerOpaque.trim();
  if (!trimmed) {
    return json(400, { error: 'seller_access_token required' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: seller, error: sellerErr } = await admin
    .from('sellers')
    .select('id, auth_user_id, email')
    .eq('access_token', trimmed)
    .maybeSingle();

  if (sellerErr || !seller?.auth_user_id) {
    return json(401, { error: 'Invalid or unknown token' });
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(seller.auth_user_id);
  if (userErr || !userData?.user) {
    return json(401, { error: 'Account not found' });
  }

  let email = (userData.user.email ?? '').trim();
  if (!email && seller.email) {
    const { error: upErr } = await admin.auth.admin.updateUserById(seller.auth_user_id, {
      email: seller.email,
      email_confirm: true,
    });
    if (upErr) {
      return json(500, { error: upErr.message });
    }
    email = seller.email;
  }
  if (!email) {
    return json(500, { error: 'Cannot issue session: auth user has no email on file' });
  }

  const { data: linkData, error: glErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const hashed = linkData?.properties?.hashed_token;
  if (glErr || !hashed) {
    return json(500, { error: glErr?.message || 'Could not generate sign-in link' });
  }

  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: hashed,
    type: 'email',
  });

  if (otpErr || !otpData.session) {
    return json(500, { error: otpErr?.message || 'Could not complete sign-in' });
  }

  const session = otpData.session;
  return json(200, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: otpData.user,
  });
});
