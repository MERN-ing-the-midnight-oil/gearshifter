// Edge Function: send-seller-check-in-sms
// Staff at check-in sends the seller app SMS OTP (sign-in / sign-up), or in dev (local URL or
// ALLOW_DEV_PHONE_BYPASS=true) delegates to `dev-phone-session-bypass` — the same Edge Function the seller
// app uses for SKIP VERIFICATION — with `check_in_event_id` so metadata matches organizer-initiated check-in.
// By default refuses if a sellers row already exists for that phone; set resend_for_existing_seller
// to allow texting an existing seller so they can open the app and show their QR again.
// Verifies caller JWT is an org user for the event's organization with check-in station access.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS + browser preflight: gateway must have verify_jwt=false (see supabase/config.toml) or OPTIONS
// fails with non-2xx before this handler runs. Deploy: `supabase functions deploy send-seller-check-in-sms`
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tryNormalizePhoneE164US(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (t.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  return null;
}

/** Same rules as dev-phone-session-bypass: local Supabase URL or ALLOW_DEV_PHONE_BYPASS secret. */
function isPlaceholderPhoneBypassAllowed(supabaseUrl: string): boolean {
  const flag = (Deno.env.get('ALLOW_DEV_PHONE_BYPASS') ?? '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  const u = supabaseUrl.trim().toLowerCase();
  return u.includes('127.0.0.1') || u.includes('localhost');
}

/**
 * Dev: run the same logic as the seller app’s SKIP VERIFICATION (`dev-phone-session-bypass`),
 * including optional `check_in_event_id` on the auth user for organizer-initiated check-in.
 */
async function invokeDevPhoneSessionBypassFromEdge(
  supabaseUrl: string,
  anonKey: string,
  phoneE164: string,
  eventId: string
): Promise<void> {
  const base = supabaseUrl.replace(/\/$/, '');
  const url = `${base}/functions/v1/dev-phone-session-bypass`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone: phoneE164, check_in_event_id: eventId }),
  });
  let errMsg: string | null = null;
  try {
    const j = (await res.json()) as { error?: string };
    if (typeof j.error === 'string' && j.error) errMsg = j.error;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(errMsg || `dev-phone-session-bypass HTTP ${res.status}`);
  }
}

function staffCanUseCheckIn(admin: {
  is_org_admin?: boolean | null;
  role?: string | null;
  permissions?: unknown;
}): boolean {
  if (admin.is_org_admin) return true;
  if (admin.role === 'admin') return true;
  const p = admin.permissions;
  if (!p || typeof p !== 'object') return false;
  const rec = p as Record<string, unknown>;
  const stations = rec.stations;
  if (stations && typeof stations === 'object') {
    const s = stations as Record<string, unknown>;
    if (s.check_in === true) return true;
  }
  if (rec.check_in === true) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase environment configuration' });
  }

  const authHeader = req.headers.get('Authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]?.trim()) {
    return json(401, { error: 'Unauthorized' });
  }
  const userJwt = bearerMatch[1].trim();

  let bodyIn: { phone?: string; event_id?: string; resend_for_existing_seller?: boolean };
  try {
    bodyIn = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const resendForExistingSeller = bodyIn.resend_for_existing_seller === true;

  const phoneRaw = typeof bodyIn.phone === 'string' ? bodyIn.phone.trim() : '';
  const eventId =
    typeof bodyIn.event_id === 'string' && /^[0-9a-f-]{36}$/i.test(bodyIn.event_id.trim())
      ? bodyIn.event_id.trim()
      : '';

  if (!phoneRaw || !eventId) {
    return json(400, { error: 'Missing or invalid phone or event_id' });
  }

  const phoneE164 = tryNormalizePhoneE164US(phoneRaw);
  if (!phoneE164) {
    return json(400, {
      error: 'Invalid phone number. Enter a 10-digit US number or a full international number with +.',
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: caller },
    error: callerAuthError,
  } = await userClient.auth.getUser(userJwt);
  if (callerAuthError || !caller) {
    return json(401, { error: 'Invalid or expired session' });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: eventRow, error: eventErr } = await service
    .from('events')
    .select('id, organization_id')
    .eq('id', eventId)
    .maybeSingle();

  if (eventErr || !eventRow?.organization_id) {
    return json(400, { error: 'Event not found' });
  }

  const { data: staffRow, error: staffErr } = await service
    .from('admin_users')
    .select('id, organization_id, is_org_admin, role, permissions')
    .eq('id', caller.id)
    .eq('organization_id', eventRow.organization_id)
    .maybeSingle();

  if (staffErr || !staffRow) {
    return json(403, { error: 'You do not have access to this event' });
  }

  if (!staffCanUseCheckIn(staffRow)) {
    return json(403, { error: 'Check-in station permission required' });
  }

  const digitsForMatch = phoneE164.replace(/\D/g, '');
  const { data: dupRows, error: dupErr } = await service.rpc('seller_ids_matching_phone_digits', {
    p_digits: digitsForMatch,
  });

  if (dupErr) {
    console.error('send-seller-check-in-sms: duplicate check', dupErr);
    const msg = dupErr.message || String(dupErr);
    const code = (dupErr as { code?: string }).code;
    if (
      code === 'PGRST202' ||
      code === '42883' ||
      msg.toLowerCase().includes('seller_ids_matching_phone_digits') ||
      msg.toLowerCase().includes('could not find') ||
      msg.toLowerCase().includes('does not exist')
    ) {
      return json(503, {
        error:
          'Database function seller_ids_matching_phone_digits is missing. Apply migration 20260507100000_seller_phone_digits_match_fn (e.g. supabase db push), then retry.',
      });
    }
    return json(500, { error: msg });
  }

  const dupList = (dupRows ?? []) as { id?: string }[];
  if (!resendForExistingSeller && dupList.length > 0) {
    return json(409, {
      error:
        'A seller profile already exists for this phone number. Look them up in search instead of sending a new invite.',
    });
  }

  if (isPlaceholderPhoneBypassAllowed(supabaseUrl)) {
    try {
      await invokeDevPhoneSessionBypassFromEdge(supabaseUrl, anonKey, phoneE164, eventId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('send-seller-check-in-sms: invokeDevPhoneSessionBypassFromEdge', e);
      return json(500, { error: msg });
    }
    return json(200, { ok: true, phone: phoneE164, simulated_sms: true });
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: otpErr } = await anon.auth.signInWithOtp({
    phone: phoneE164,
    options: {
      channel: 'sms',
      /** New auth users get this on `user_metadata` so the seller app can attach swap registration after profile. */
      data: { check_in_event_id: eventId },
    },
  });

  if (otpErr) {
    return json(400, { error: otpErr.message });
  }

  return json(200, { ok: true, phone: phoneE164, simulated_sms: false });
});
