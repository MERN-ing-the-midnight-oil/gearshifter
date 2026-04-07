/**
 * Create an admin user (auth user + admin_users record) using the Supabase service role.
 *
 * Usage (from repo root):
 *   npx tsx scripts/js/create-admin-user.ts "Anthony Admin" "asdfasdf"
 *   # Optional: pass email as 4th arg; default is anthony.admin@example.com
 *
 * Env: load from packages/organizer-app/.env or set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

// Load .env from organizer-app or seller-app if present
try {
  const { config } = require('dotenv');
  const organizerEnv = resolve(process.cwd(), 'packages/organizer-app/.env');
  const sellerEnv = resolve(process.cwd(), 'packages/seller-app/.env');
  config({ path: organizerEnv });
  if (process.env.EXPO_PUBLIC_SUPABASE_URL === undefined) config({ path: sellerEnv });
} catch {
  // dotenv not available, use process.env
}

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  const displayName = process.argv[2] ?? 'Anthony Admin';
  const password = process.argv[3] ?? 'asdfasdf';
  const email = process.argv[4] ?? 'anthony.admin@example.com';

  const [firstName, ...lastParts] = displayName.trim().split(/\s+/);
  const lastName = lastParts.length ? lastParts.join(' ') : 'Admin';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env: set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
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
