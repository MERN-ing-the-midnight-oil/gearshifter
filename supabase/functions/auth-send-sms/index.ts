// Optional Supabase Auth "Send SMS" hook: sends OTP via Twilio and appends the seller dashboard link
// when `sellers.access_token` is known for this user or phone.
//
// Enable in Supabase Dashboard → Authentication → Hooks → Send SMS, pointing at this function.
// Requires: AUTH_SEND_SMS_HOOK_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
// TWILIO_FROM_NUMBER (E.164 sender) or TWILIO_MESSAGING_SERVICE_SID (MG… Messaging Service).

// Prefer npm: over esm.sh — avoids intermittent boot / module resolution failures on Edge (503 + SUPABASE_EDGE_RUNTIME_ERROR).
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { Webhook } from 'npm:standardwebhooks@1.0.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function dashboardUrlForToken(token: string): string {
  const origin = (Deno.env.get('SELLER_PUBLIC_DASHBOARD_ORIGIN') ?? 'https://gearswap.app').replace(/\/$/, '');
  return `${origin}/seller?token=${encodeURIComponent(token)}`;
}

/** Supabase stores `v1,whsec_<base64>`; Standard Webhooks verifier expects the key without that prefix. */
function standardWebhookSecret(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('v1,whsec_')) return t.slice('v1,whsec_'.length);
  return t;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    return await handleSendSms(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('auth-send-sms: unhandled', e);
    return new Response(JSON.stringify({ error: 'unhandled', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleSendSms(req: Request): Promise<Response> {
  const secretRaw = Deno.env.get('AUTH_SEND_SMS_HOOK_SECRET') ?? Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!secretRaw) {
    return new Response(JSON.stringify({ error: 'AUTH_SEND_SMS_HOOK_SECRET not set' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!accountSid || !authToken) {
    return new Response(
      JSON.stringify({ error: 'Twilio env vars missing (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (!messagingServiceSid?.trim() && !fromNumber?.trim()) {
    return new Response(
      JSON.stringify({
        error:
          'Set TWILIO_FROM_NUMBER (E.164) or TWILIO_MESSAGING_SERVICE_SID (MG…). Message Service SID cannot be used as From.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  type HookUser = { id?: string; phone?: string | null };
  type HookSms = { otp?: string; phone?: string };
  let user: HookUser | null | undefined;
  let sms: HookSms | null | undefined;
  try {
    const wh = new Webhook(standardWebhookSecret(secretRaw));
    const verified = wh.verify(payload, headers) as { user?: HookUser | null; sms?: HookSms | null };
    user = verified.user;
    sms = verified.sms;
  } catch (e) {
    console.error('auth-send-sms: webhook verify failed', e);
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const otp = sms?.otp?.trim();
  if (!otp) {
    return new Response(JSON.stringify({ error: 'Hook payload missing sms.otp' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawPhone = (user?.phone ?? sms?.phone ?? '').trim();
  const to = rawPhone.startsWith('+')
    ? rawPhone
    : rawPhone
      ? `+${rawPhone.replace(/\D/g, '')}`
      : '';
  if (!to) {
    return new Response(
      JSON.stringify({ error: 'No destination phone (user.phone and sms.phone both empty)' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let sellerToken: string | null = null;
  const userId = user?.id;
  if (userId) {
    const { data: byAuth } = await admin
      .from('sellers')
      .select('access_token')
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (byAuth?.access_token) sellerToken = String(byAuth.access_token);
  }
  if (!sellerToken && to) {
    const { data: rows } = await admin
      .from('sellers')
      .select('access_token')
      .eq('phone', to)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (row?.access_token) sellerToken = String(row.access_token);
  }

  const linkPart = sellerToken ? ` Your dashboard: ${dashboardUrlForToken(sellerToken)}` : '';
  const bodyText = `GearSwap: ${otp} is your sign-in code.${linkPart}`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);
  const form = new URLSearchParams({ To: to, Body: bodyText });
  const mg = messagingServiceSid?.trim();
  if (mg) {
    form.set('MessagingServiceSid', mg);
  } else {
    form.set('From', fromNumber!.trim());
  }

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
    console.error('auth-send-sms: Twilio error', tw.status, twJson);
    return new Response(JSON.stringify({ error: 'Twilio send failed', detail: twJson }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const twilioStatus = typeof twJson.status === 'string' ? twJson.status : '';
  if (twJson.error_code != null || twilioStatus === 'failed') {
    console.error('auth-send-sms: Twilio create returned failure', twJson);
    return new Response(JSON.stringify({ error: 'Twilio message rejected', detail: twJson }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('auth-send-sms: Twilio accepted', {
    sid: twJson.sid,
    status: twJson.status,
    to,
    num_segments: twJson.num_segments,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
