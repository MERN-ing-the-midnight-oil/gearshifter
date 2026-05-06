// Sets JWT app_metadata.seller_dashboard_event_id for the authenticated seller (one dashboard per session).

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let bodyIn: { event_id?: string };
  try {
    bodyIn = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const raw = typeof bodyIn.event_id === 'string' ? bodyIn.event_id.trim() : '';
  if (!raw || !UUID_RE.test(raw)) {
    return json(400, { error: 'event_id must be a UUID' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: ev, error: evErr } = await admin
    .from('events')
    .select('id')
    .eq('id', raw)
    .is('archived_at', null)
    .maybeSingle();

  if (evErr) {
    return json(500, { error: evErr.message });
  }
  if (!ev?.id) {
    return json(400, { error: 'Event not found or archived' });
  }

  const { data: fullUser, error: guErr } = await admin.auth.admin.getUserById(userId);
  if (guErr || !fullUser?.user) {
    return json(500, { error: guErr?.message || 'Could not load user' });
  }

  const prev = (fullUser.user.app_metadata ?? {}) as Record<string, unknown>;
  const nextMeta = { ...prev, seller_dashboard_event_id: raw };

  const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMeta,
  });
  if (upErr) {
    return json(500, { error: upErr.message });
  }

  return json(200, { ok: true, event_id: raw });
});
