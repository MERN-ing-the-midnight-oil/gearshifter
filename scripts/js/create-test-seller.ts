/**
 * Create a test seller account for development (auth user + sellers row).
 * Used for auto-login when running the seller app with yarn seller:start.
 *
 * Usage (from repo root):
 *   npx tsx scripts/js/create-test-seller.ts
 *
 * Env: load from packages/seller-app/.env or set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

try {
  const { config } = require('dotenv');
  const sellerEnv = resolve(process.cwd(), 'packages/seller-app/.env');
  const organizerEnv = resolve(process.cwd(), 'packages/organizer-app/.env');
  config({ path: sellerEnv });
  if (process.env.EXPO_PUBLIC_SUPABASE_URL === undefined) config({ path: organizerEnv });
} catch {
  // dotenv not available, use process.env
}

const TEST_SELLER_EMAIL = 'seller@test.com';
const TEST_SELLER_PASSWORD = 'testpass123';
const SELLER_QR_PREFIX = 'C';

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env: set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Creating test seller auth user:', TEST_SELLER_EMAIL);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_SELLER_EMAIL,
    password: TEST_SELLER_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Seller' },
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists for', TEST_SELLER_EMAIL, '- ensuring sellers row exists.');
      const { data: list } = await supabase.auth.admin.listUsers();
      const user = list?.users?.find((u) => u.email === TEST_SELLER_EMAIL);
      if (!user) {
        console.error('Could not find existing user by email.');
        process.exit(1);
      }
      await upsertSeller(supabase, user.id);
      console.log('Done. Test seller:', TEST_SELLER_EMAIL);
      return;
    }
    console.error('Auth error:', authError.message);
    process.exit(1);
  }

  if (!authData.user) {
    console.error('No user returned from createUser');
    process.exit(1);
  }

  await upsertSeller(supabase, authData.user.id);
  console.log('Done. Test seller created:', TEST_SELLER_EMAIL);
}

async function upsertSeller(supabase: ReturnType<typeof createClient>, authUserId: string) {
  // Check if seller row already exists for this auth user
  const { data: existing } = await supabase
    .from('sellers')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existing) {
    console.log('Sellers row already exists for this user.');
    return;
  }

  const sellerId = randomUUID();
  const qrCode = `${SELLER_QR_PREFIX}-${sellerId}`;

  const { error } = await supabase.from('sellers').insert({
    id: sellerId,
    auth_user_id: authUserId,
    first_name: 'Test',
    last_name: 'Seller',
    phone: '+13605550000',
    email: TEST_SELLER_EMAIL,
    qr_code: qrCode,
    is_guest: false,
  });

  if (error) {
    console.error('sellers insert error:', error.message);
    process.exit(1);
  }
}

main();
