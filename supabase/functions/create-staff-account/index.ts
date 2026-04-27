// Edge Function: create-staff-account
// Creates an org staff auth user + admin_users row without touching the caller's session.
// Verifies JWT belongs to an org admin (is_org_admin) for the target organization.
// Delivery: "invite" → Supabase invite email (recipient sets password via link).
//           "password" → admin-provided password (share out-of-band).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type StaffLevel = 'full' | 'limited';
type Delivery = 'invite' | 'password';

type StationsPermissions = {
  check_in: boolean;
  pos: boolean;
  pickup: boolean;
  reports: boolean;
};

type AdminCapabilitiesShape = {
  create_users: boolean;
  change_passwords: boolean;
  manage_events: boolean;
  organization_settings: boolean;
  financial_reports: boolean;
};

function normalizeAdminCapabilities(raw: unknown): AdminCapabilitiesShape {
  const d: AdminCapabilitiesShape = {
    create_users: true,
    change_passwords: true,
    manage_events: true,
    organization_settings: true,
    financial_reports: true,
  };
  if (!raw || typeof raw !== 'object') return d;
  const a = raw as Record<string, unknown>;
  return {
    create_users: a.create_users !== false,
    change_passwords: a.change_passwords !== false,
    manage_events: a.manage_events !== false,
    organization_settings: a.organization_settings !== false,
    financial_reports: a.financial_reports !== false,
  };
}

function normalizeLimitedPermissions(raw: unknown): { stations: StationsPermissions } {
  const d: StationsPermissions = {
    check_in: true,
    pos: true,
    pickup: true,
    reports: true,
  };
  if (!raw || typeof raw !== 'object') return { stations: d };
  const p = raw as Record<string, unknown>;
  const stations = p.stations as Record<string, boolean> | undefined;
  if (stations && typeof stations === 'object') {
    return {
      stations: {
        check_in: !!stations.check_in,
        pos: !!stations.pos,
        pickup: !!stations.pickup,
        reports: !!stations.reports,
      },
    };
  }
  return { stations: d };
}

function normalizeFullAdminPermissions(raw: unknown): { stations: StationsPermissions; admin: AdminCapabilitiesShape } {
  const stations: StationsPermissions = { check_in: true, pos: true, pickup: true, reports: true };
  if (!raw || typeof raw !== 'object') {
    return { stations, admin: normalizeAdminCapabilities(null) };
  }
  const r = raw as Record<string, unknown>;
  return {
    stations,
    admin: normalizeAdminCapabilities(r.admin),
  };
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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]?.trim()) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Pass the JWT explicitly: getUser() with no args uses session storage, which is empty in Edge.
  // getUser(jwt) performs GET /user with Authorization: Bearer <jwt>.
  const userJwt = bearerMatch[1].trim();

  let body: {
    organization_id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    staff_level?: StaffLevel;
    delivery?: Delivery;
    password?: string;
    permissions?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const organization_id = typeof body.organization_id === 'string' ? body.organization_id.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const last_name = typeof body.last_name === 'string' ? body.last_name.trim() : '';
  const staff_level: StaffLevel = body.staff_level === 'full' ? 'full' : 'limited';
  const delivery: Delivery = body.delivery === 'password' ? 'password' : 'invite';

  if (!organization_id || !email || !first_name || !last_name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: organization_id, email, first_name, last_name' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (delivery === 'password') {
    const pw = typeof body.password === 'string' ? body.password : '';
    if (pw.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: caller },
    error: callerAuthError,
  } = await userClient.auth.getUser(userJwt);
  if (callerAuthError || !caller) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerRow, error: callerRowError } = await service
    .from('admin_users')
    .select('organization_id, is_org_admin, role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerRowError || !callerRow) {
    return new Response(JSON.stringify({ error: 'Could not verify organizer profile' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (callerRow.organization_id !== organization_id) {
    return new Response(JSON.stringify({ error: 'Wrong organization' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Match RLS helper is_user_admin(): role must be admin (volunteers cannot create staff).
  if (callerRow.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Only admin users can create staff accounts for this organization' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const permissions =
    staff_level === 'full'
      ? normalizeFullAdminPermissions(body.permissions)
      : normalizeLimitedPermissions(body.permissions);

  const adminRow = {
    organization_id,
    first_name,
    last_name,
    email,
    role: staff_level === 'full' ? 'admin' : 'volunteer',
    is_org_admin: staff_level === 'full',
    permissions,
  };

  let newUserId: string | null = null;

  try {
    if (delivery === 'invite') {
      const redirectTo = Deno.env.get('STAFF_INVITE_REDIRECT_URL') ?? undefined;
      const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
        data: { first_name, last_name },
        redirectTo,
      });

      if (inviteError) {
        const err = inviteError as { message: string; code?: string; status?: number };
        console.error('[create-staff-account] inviteUserByEmail failed', {
          email,
          message: err.message,
          code: err.code,
          status: err.status,
        });
        return new Response(
          JSON.stringify({
            error: err.message,
            ...(err.code != null && err.code !== '' ? { code: err.code } : {}),
            ...(typeof err.status === 'number' ? { status: err.status } : {}),
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      newUserId = inviteData.user?.id ?? null;
      if (!newUserId) {
        return new Response(JSON.stringify({ error: 'Invite did not return a user id' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const password = typeof body.password === 'string' ? body.password : '';
      const { data: createData, error: createError } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      newUserId = createData.user?.id ?? null;
      if (!newUserId) {
        return new Response(JSON.stringify({ error: 'User creation did not return an id' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: inserted, error: insertError } = await service
      .from('admin_users')
      .insert({
        id: newUserId,
        ...adminRow,
      })
      .select()
      .single();

    if (insertError) {
      await service.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        admin_user: inserted,
        delivery,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    if (newUserId) {
      try {
        await service.auth.admin.deleteUser(newUserId);
      } catch {
        /* best effort */
      }
    }
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
