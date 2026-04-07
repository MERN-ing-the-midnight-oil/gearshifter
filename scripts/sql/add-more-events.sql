-- Add more events for testing
-- These events are owned by the seeded organization

-- Event 1: Spring 2025 Ski Swap (already exists, but ensuring it's there)
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
    '2025-03-15',
    '2025-02-01',
    '2025-03-10',
    '2025-03-15 09:00:00-08:00',
    '2025-03-15 17:00:00-08:00',
    '2025-03-15 14:00:00-08:00',
    'registration',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  status = 'registration',
  event_date = '2025-03-15',
  registration_open_date = '2025-02-01',
  registration_close_date = '2025-03-10';

-- Event 2: Summer Bike Swap (upcoming, registration open)
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
    '2025-06-20',
    '2025-05-01',
    '2025-06-15',
    '2025-06-20 08:00:00-07:00',
    '2025-06-20 18:00:00-07:00',
    '2025-06-20 14:00:00-07:00',
    'registration',
    '{"categories": ["road_bikes", "mountain_bikes", "hybrid_bikes", "accessories", "parts"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Event 3: Fall Gear Swap (upcoming, registration opens soon)
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
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111',
    'Fall 2025 Gear Swap',
    '2025-09-15',
    '2025-08-01',
    '2025-09-10',
    '2025-09-15 09:00:00-07:00',
    '2025-09-15 17:00:00-07:00',
    '2025-09-15 14:00:00-07:00',
    'registration',
    '{"categories": ["outdoor_gear", "camping", "hiking", "clothing"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Event 4: Winter Ski Swap (currently in check-in phase - happening soon)
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
    (CURRENT_DATE + INTERVAL '7 days')::date,
    (CURRENT_DATE - INTERVAL '30 days')::date,
    (CURRENT_DATE + INTERVAL '5 days')::date,
    ((CURRENT_DATE + INTERVAL '7 days')::date || ' 09:00:00-08:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '7 days')::date || ' 17:00:00-08:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '7 days')::date || ' 14:00:00-08:00')::timestamptz,
    'checkin',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Event 5: Active Shopping Event (currently in shopping phase - happening today)
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

-- Event 6: Registration Open Now (registration status, date in near future)
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
    'dddddddd-eeee-ffff-1111-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'February 2025 Gear Swap',
    (CURRENT_DATE + INTERVAL '14 days')::date,
    (CURRENT_DATE - INTERVAL '7 days')::date,
    (CURRENT_DATE + INTERVAL '10 days')::date,
    ((CURRENT_DATE + INTERVAL '14 days')::date || ' 09:00:00-08:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '14 days')::date || ' 17:00:00-08:00')::timestamptz,
    ((CURRENT_DATE + INTERVAL '14 days')::date || ' 14:00:00-08:00')::timestamptz,
    'registration',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

