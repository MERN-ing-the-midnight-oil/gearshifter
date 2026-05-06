// Removes seller_dashboard_event_id from JWT app_metadata (e.g. before sign-out).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json(401, { error: 'Missing Authorization bearer token' });
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await anon.auth.getUser(jwt);
  if (userErr || !userData?.user?.id) {
    return json(401, { error: userErr?.message || 'Invalid session' });
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: fullUser, error: guErr } = await admin.auth.admin.getUserById(userId);
  if (guErr || !fullUser?.user) {
    return json(500, { error: guErr?.message || 'Could not load user' });
  }

  const prev = { ...((fullUser.user.app_metadata ?? {}) as Record<string, unknown>) };
  delete prev.seller_dashboard_event_id;

  const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: prev,
  });
  if (upErr) {
    return json(500, { error: upErr.message });
  }

  return json(200, { ok: true });
});
