-- Fix everything: Create events AND seller record for current user
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new

-- ============================================
-- Step 1: Create organization if it doesn't exist
-- ============================================
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Step 2: Create events
-- ============================================

-- Event 1: Registration open, happening in 2 weeks
INSERT INTO events (
  id,
  organization_id,
  name,
  event_date,
  registration_open_date,
  registration_close_date,
  shop_open_time,
  shop_close_time,
  price_drop_time,
  status,
  settings
)
VALUES 
  (
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    'Spring 2025 Ski Swap',
    (CURRENT_DATE + INTERVAL '14 days')::date,
    (CURRENT_DATE - INTERVAL '7 days')::date,
    (CURRENT_DATE + INTERVAL '10 days')::date,
    ((CURRENT_DATE + INTERVAL '14 days')::date || ' 09:00:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '14 days')::date || ' 17:00:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '14 days')::date || ' 14:00:00')::timestamptz,
    'registration',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  status = 'registration',
  event_date = (CURRENT_DATE + INTERVAL '14 days')::date;

-- Event 2: Registration open, happening in 1 week
INSERT INTO events (
  id,
  organization_id,
  name,
  event_date,
  registration_open_date,
  registration_close_date,
  shop_open_time,
  shop_close_time,
  price_drop_time,
  status,
  settings
)
VALUES 
  (
    '99999999-9999-9999-9999-999999999999',
    '11111111-1111-1111-1111-111111111111',
    'Summer 2025 Bike Swap',
    (CURRENT_DATE + INTERVAL '7 days')::date,
    (CURRENT_DATE - INTERVAL '7 days')::date,
    (CURRENT_DATE + INTERVAL '5 days')::date,
    ((CURRENT_DATE + INTERVAL '7 days')::date || ' 08:00:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '7 days')::date || ' 18:00:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '7 days')::date || ' 14:00:00')::timestamptz,
    'registration',
    '{"categories": ["road_bikes", "mountain_bikes", "hybrid_bikes", "accessories", "parts"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Event 3: Shopping status, happening today (will show up)
INSERT INTO events (
  id,
  organization_id,
  name,
  event_date,
  registration_open_date,
  registration_close_date,
  shop_open_time,
  shop_close_time,
  price_drop_time,
  status,
  settings
)
VALUES 
  (
    'cccccccc-dddd-eeee-ffff-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Active Shopping Event',
    CURRENT_DATE,
    (CURRENT_DATE - INTERVAL '30 days')::date,
    (CURRENT_DATE - INTERVAL '5 days')::date,
    (CURRENT_DATE + INTERVAL '1 hour')::timestamptz,
    (CURRENT_DATE + INTERVAL '9 hours')::timestamptz,
    (CURRENT_DATE + INTERVAL '6 hours')::timestamptz,
    'shopping',
    '{"categories": ["general"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Event 4: Check-in status, happening in 3 days
INSERT INTO events (
  id,
  organization_id,
  name,
  event_date,
  registration_open_date,
  registration_close_date,
  shop_open_time,
  shop_close_time,
  price_drop_time,
  status,
  settings
)
VALUES 
  (
    'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
    '11111111-1111-1111-1111-111111111111',
    'Winter 2025 Ski Swap',
    (CURRENT_DATE + INTERVAL '3 days')::date,
    (CURRENT_DATE - INTERVAL '30 days')::date,
    (CURRENT_DATE + INTERVAL '2 days')::date,
    ((CURRENT_DATE + INTERVAL '3 days')::date || ' 09:00:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '3 days')::date || ' 17:00:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '3 days')::date || ' 14:00:00')::timestamptz,
    'checkin',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 3: Create seller record for current user
-- Replace '27179973-ea50-4ee7-8e49-d8220cc31bd5' with your actual user ID if different
-- ============================================
DO $$
DECLARE
  user_id UUID := '27179973-ea50-4ee7-8e49-d8220cc31bd5';
  user_email TEXT;
  seller_id UUID;
  qr_code TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  IF user_email IS NULL THEN
    RAISE NOTICE 'User % does not exist in auth.users', user_id;
    RETURN;
  END IF;
  
  -- Check if seller record already exists
  IF EXISTS (SELECT 1 FROM sellers WHERE auth_user_id = user_id) THEN
    RAISE NOTICE 'Seller record already exists for user %', user_id;
    RETURN;
  END IF;
  
  -- Generate seller ID and QR code
  seller_id := gen_random_uuid();
  qr_code := 'SELLER-' || seller_id;
  
  -- Create seller record
  INSERT INTO sellers (
    id,
    auth_user_id,
    first_name,
    last_name,
    email,
    phone,
    qr_code,
    is_guest
  )
  VALUES (
    seller_id,
    user_id,
    'Test',  -- Change these to your actual name
    'Seller',
    user_email,
    '+15555555555',  -- Change to your actual phone
    qr_code,
    false
  );
  
  RAISE NOTICE 'Created seller record for user % with seller ID %', user_id, seller_id;
END $$;

