// TEMPORARY: placeholder for SMS OTP — issues the same kind of Supabase session + JWT as real verify,
// without Twilio. Allowed only when:
//   - SUPABASE_URL looks local (127.0.0.1 / localhost), e.g. `supabase start`, OR
//   - Edge secret ALLOW_DEV_PHONE_BYPASS=true (set in Dashboard for hosted dev/staging only).
// Turn off ALLOW_DEV_PHONE_BYPASS and/or remove this function in production.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** No client secret: server-only switch or local Supabase URL. */
function isPlaceholderPhoneBypassAllowed(supabaseUrl: string): boolean {
  const flag = (Deno.env.get('ALLOW_DEV_PHONE_BYPASS') ?? '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  const u = supabaseUrl.trim().toLowerCase();
  return u.includes('127.0.0.1') || u.includes('localhost');
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function syntheticEmailForUserId(userId: string): string {
  return `phone-bypass-${userId}@invalid.local`;
}

function isPlausibleE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

async function findUserIdByPhone(
  admin: ReturnType<typeof createClient>,
  targetDigits: string
): Promise<string | null> {
  const perPage = 200;
  let page = 1;
  for (; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('dev-phone-session-bypass: listUsers', error);
      return null;
    }
    const users = data.users ?? [];
    for (const u of users) {
      const p = (u as { phone?: string | null }).phone;
      if (p && digitsOnly(p) === targetDigits) {
        return u.id;
      }
    }
    if (users.length < perPage) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase env (URL / anon / service role)' });
  }

  if (!isPlaceholderPhoneBypassAllowed(supabaseUrl)) {
    return json(403, {
      error:
        'Placeholder phone bypass is disabled. Use local Supabase (URL contains 127.0.0.1 or localhost), or set Edge secret ALLOW_DEV_PHONE_BYPASS=true for a hosted dev project. Remove for production.',
    });
  }

  let bodyIn: { phone?: string };
  try {
    bodyIn = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const phone = typeof bodyIn.phone === 'string' ? bodyIn.phone.trim() : '';
  if (!isPlausibleE164(phone)) {
    return json(400, { error: 'Invalid phone (expected E.164, e.g. +15551234567)' });
  }

  const targetDigits = digitsOnly(phone);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = randomPassword();
  let signInEmail: string;

  const existingId = await findUserIdByPhone(admin, targetDigits);
  if (existingId) {
    signInEmail = syntheticEmailForUserId(existingId);
    const { error: upErr } = await admin.auth.admin.updateUserById(existingId, {
      email: signInEmail,
      password,
      email_confirm: true,
      phone_confirm: true,
      phone,
    });
    if (upErr) {
      console.error('dev-phone-session-bypass: updateUserById', upErr);
      return json(500, { error: upErr.message });
    }
  } else {
    signInEmail = `phone-bypass-new-${targetDigits}@invalid.local`;
    const { data: created, error: crErr } = await admin.auth.admin.createUser({
      email: signInEmail,
      password,
      phone,
      phone_confirm: true,
      email_confirm: true,
    });
    if (crErr) {
      console.error('dev-phone-session-bypass: createUser', crErr);
      return json(400, { error: crErr.message });
    }
    if (!created.user?.id) {
      return json(500, { error: 'createUser returned no user' });
    }
  }

  const { data: signData, error: signErr } = await anon.auth.signInWithPassword({
    email: signInEmail,
    password,
  });

  if (signErr || !signData.session) {
    console.error('dev-phone-session-bypass: signInWithPassword', signErr);
    return json(500, { error: signErr?.message || 'Could not establish session' });
  }

  const session = signData.session;
  return json(200, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
  });
});
