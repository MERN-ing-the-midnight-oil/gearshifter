-- Quick script to add events that will show up immediately
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new

-- Make sure organization exists first
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

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

