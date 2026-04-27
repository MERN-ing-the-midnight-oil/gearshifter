/**
 * Create an admin user (auth user + admin_users record) using the Supabase service role.
 *
 * Usage (from repo root, after yarn install):
 *   yarn create:axel-admin
 *   # → Axel Admin / Bellingham Ski Swap / axel.admin@bellingham-skiswap.test / password asdfasdf
 *   npx tsx scripts/js/create-admin-user.ts "Anthony Admin" "asdfasdf"
 *   # Optional: pass email as 4th arg; default is anthony.admin@example.com
 *
 * Env (first match wins for each key unless override):
 *   .env or .env.local (repo root), then packages/organizer-app/.env, packages/seller-app/.env
 * Required: EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * (Supabase Dashboard → Project Settings → API)
 */

import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';

const cwd = process.cwd();
const envPaths = [
  resolve(cwd, '.env'),
  resolve(cwd, '.env.local'),
  resolve(cwd, 'packages/organizer-app/.env'),
  resolve(cwd, 'packages/organizer-app/.env.local'),
  resolve(cwd, 'packages/seller-app/.env'),
];
for (const p of envPaths) {
  loadEnv({ path: p, override: true });
}

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  const displayName = process.argv[2] ?? 'Anthony Admin';
  const password = process.argv[3] ?? 'asdfasdf';
  const email = process.argv[4] ?? 'anthony.admin@example.com';

  const [firstName, ...lastParts] = displayName.trim().split(/\s+/);
  const lastName = lastParts.length ? lastParts.join(' ') : 'Admin';

  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials.\n');
    console.error('Set in .env at the repo root or in packages/organizer-app/.env:\n');
    console.error('  EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<service_role secret from Dashboard → API>\n');
    console.error('Tried loading:', envPaths.join(', '));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure default org exists (idempotent)
  await supabase.from('organizations').upsert(
    {
      id: DEFAULT_ORG_ID,
      name: 'Bellingham Ski Swap',
      slug: 'bellingham-ski-swap',
      commission_rate: 0.25,
      vendor_commission_rate: 0.2,
    },
    { onConflict: 'slug' }
  );

  console.log('Creating auth user:', email);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists for', email, '- creating/updating admin_users record only.');
      const { data: existing } = await supabase.auth.admin.listUsers();
      const user = existing?.users?.find((u) => u.email === email);
      if (!user) {
        console.error('Could not find existing user by email.');
        process.exit(1);
      }
      await upsertAdminUser(supabase, user.id, email, firstName, lastName);
      console.log('Done. Admin user:', email);
      return;
    }
    console.error('Auth error:', authError.message);
    process.exit(1);
  }

  if (!authData.user) {
    console.error('No user returned from createUser');
    process.exit(1);
  }

  await upsertAdminUser(supabase, authData.user.id, email, firstName, lastName);
  console.log('Done. Admin user created:', email);
}

async function upsertAdminUser(
  supabase: ReturnType<typeof createClient>,
  id: string,
  email: string,
  first_name: string,
  last_name: string
) {
  const permissions = {
    stations: { check_in: true, pos: true, pickup: true, reports: true },
  };
  const { error } = await supabase.from('admin_users').upsert(
    {
      id,
      organization_id: DEFAULT_ORG_ID,
      first_name,
      last_name,
      email,
      permissions,
      role: 'admin',
      is_org_admin: true,
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.error('admin_users insert error:', error.message);
    process.exit(1);
  }
}

main();
