-- Seed data for development and testing
-- This file creates fictional data for testing the application

-- ============================================
-- ORGANIZATION
-- ============================================
-- Create "Bellingham Ski Swap" organization
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- AUTH USERS (These would normally be created via Supabase Auth UI or API)
-- ============================================
-- Note: In a real scenario, you'd create these via Supabase Auth first
-- For seeding, we'll use placeholder UUIDs that match what would be created

-- Admin user for Bellingham Ski Swap
-- Email: admin@bellinghamskiswap.com
-- Password: (would be set via Supabase Auth)
-- UUID: 22222222-2222-2222-2222-222222222222

-- Seller accounts (5 fictional sellers)
-- Seller 1: Sarah Johnson - 33333333-3333-3333-3333-333333333333
-- Seller 2: Mike Chen - 44444444-4444-4444-4444-444444444444
-- Seller 3: Emily Rodriguez - 55555555-5555-5555-5555-555555555555
-- Seller 4: David Kim - 66666666-6666-6666-6666-666666666666
-- Seller 5: Lisa Anderson - 77777777-7777-7777-7777-777777777777

-- ============================================
-- ADMIN USER
-- ============================================
INSERT INTO admin_users (id, organization_id, first_name, last_name, email, permissions)
VALUES 
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Alex',
    'Thompson',
    'admin@bellinghamskiswap.com',
    '{"check_in": true, "pos": true, "pickup": true, "reports": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SELLERS
-- ============================================
INSERT INTO sellers (id, first_name, last_name, phone, email, qr_code)
VALUES 
  (
    '33333333-3333-3333-3333-333333333333',
    'Sarah',
    'Johnson',
    '+13605551234',
    'sarah.johnson@example.com',
    'SELLER-SG2025-001'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Mike',
    'Chen',
    '+13605551235',
    'mike.chen@example.com',
    'SELLER-SG2025-002'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Emily',
    'Rodriguez',
    '+13605551236',
    'emily.rodriguez@example.com',
    'SELLER-SG2025-003'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'David',
    'Kim',
    '+13605551237',
    'david.kim@example.com',
    'SELLER-SG2025-004'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'Lisa',
    'Anderson',
    '+13605551238',
    'lisa.anderson@example.com',
    'SELLER-SG2025-005'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EVENTS (Past, Current, Future)
-- ============================================
-- NOTE: Dates are fixed for seed data; the app logic treats any
-- event_date in the future as "upcoming" when choosing defaults.

-- Past Event 1: Fall 2024 Ski Swap (completed)
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
    '88888888-8888-8888-8888-888888888880',
    '11111111-1111-1111-1111-111111111111',
    'Fall 2024 Ski Swap',
    '2024-11-10',
    '2024-10-01',
    '2024-11-05',
    '2024-11-10 09:00:00-08:00',
    '2024-11-10 17:00:00-08:00',
    '2024-11-10 14:00:00-08:00',
    'closed',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Past Event 2: Winter 2025 Ski Swap (shopping/pickup phase)
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
    '88888888-8888-8888-8888-888888888881',
    '11111111-1111-1111-1111-111111111111',
    'Winter 2025 Ski Swap',
    '2025-01-20',
    '2024-12-15',
    '2025-01-15',
    '2025-01-20 09:00:00-08:00',
    '2025-01-20 17:00:00-08:00',
    '2025-01-20 13:00:00-08:00',
    'pickup',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Current / Near-Term Event: Spring 2025 Ski Swap (registration)
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
ON CONFLICT (id) DO NOTHING;

-- Future Event 1: Summer 2025 Bike & Gear Swap (active)
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
    '88888888-8888-8888-8888-888888888889',
    '11111111-1111-1111-1111-111111111111',
    'Summer 2025 Bike & Gear Swap',
    '2025-07-10',
    '2025-06-01',
    '2025-07-05',
    '2025-07-10 09:00:00-07:00',
    '2025-07-10 17:00:00-07:00',
    '2025-07-10 13:00:00-07:00',
    'registration',
    '{"categories": ["bikes", "helmets", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Future Event 2: Fall 2025 Ski Swap (planned)
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
    '88888888-8888-8888-8888-888888888882',
    '11111111-1111-1111-1111-111111111111',
    'Fall 2025 Ski Swap',
    '2025-11-08',
    '2025-10-01',
    '2025-11-03',
    '2025-11-08 09:00:00-08:00',
    '2025-11-08 17:00:00-08:00',
    '2025-11-08 14:00:00-08:00',
    'registration',
    '{"categories": ["skis", "boots", "poles", "bindings", "clothing", "accessories"], "donation_enabled": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ITEMS
-- ============================================
-- Items for Sarah Johnson
INSERT INTO items (
  id,
  event_id,
  seller_id,
  item_number,
  category,
  description,
  size,
  original_price,
  reduced_price,
  enable_price_reduction,
  donate_if_unsold,
  status,
  qr_code
)
VALUES 
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '88888888-8888-8888-8888-888888888880', -- Fall 2024 (past)
    '33333333-3333-3333-3333-333333333333',
    'SG2025-000001',
    'skis',
    'Rossignol Experience 88 Skis - 170cm, excellent condition, used 2 seasons',
    '170cm',
    350.00,
    280.00,
    true,
    false,
    'pending',
    'ITEM-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '88888888-8888-8888-8888-888888888888', -- Spring 2025 (current/near-term)
    '33333333-3333-3333-3333-333333333333',
    'SG2025-000002',
    'boots',
    'Salomon S/Max 120 Ski Boots - Size 27.5, heat molded, great fit',
    '27.5',
    250.00,
    NULL,
    false,
    true,
    'pending',
    'ITEM-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  );

-- Items for Mike Chen
INSERT INTO items (
  id,
  event_id,
  seller_id,
  item_number,
  category,
  description,
  size,
  original_price,
  reduced_price,
  enable_price_reduction,
  donate_if_unsold,
  status,
  qr_code
)
VALUES 
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '88888888-8888-8888-8888-888888888889', -- Summer 2025 (future)
    '44444444-4444-4444-4444-444444444444',
    'SG2025-000003',
    'skis',
    'Atomic Vantage 90 Skis - 175cm, like new, only used 3 times',
    '175cm',
    450.00,
    360.00,
    true,
    false,
    'pending',
    'ITEM-cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '88888888-8888-8888-8888-888888888881', -- Winter 2025 (past/pickup)
    '44444444-4444-4444-4444-444444444444',
    'SG2025-000004',
    'poles',
    'Leki Carbon Poles - 120cm, adjustable, lightweight',
    '120cm',
    80.00,
    NULL,
    false,
    false,
    'pending',
    'ITEM-dddddddd-dddd-dddd-dddd-dddddddddddd'
  );

-- Items for Emily Rodriguez
INSERT INTO items (
  id,
  event_id,
  seller_id,
  item_number,
  category,
  description,
  size,
  original_price,
  reduced_price,
  enable_price_reduction,
  donate_if_unsold,
  status,
  qr_code
)
VALUES 
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '88888888-8888-8888-8888-888888888888',
    '55555555-5555-5555-5555-555555555555',
    'SG2025-000005',
    'clothing',
    'Patagonia Powder Bowl Jacket - Medium, waterproof, excellent condition',
    'Medium',
    180.00,
    140.00,
    true,
    false,
    'pending',
    'ITEM-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '88888888-8888-8888-8888-888888888888',
    '55555555-5555-5555-5555-555555555555',
    'SG2025-000006',
    'accessories',
    'Smith I/O Goggles with 2 lenses - clear and tinted, excellent condition',
    'One Size',
    120.00,
    NULL,
    false,
    false,
    'pending',
    'ITEM-ffffffff-ffff-ffff-ffff-ffffffffffff'
  );

-- Items for David Kim
INSERT INTO items (
  id,
  event_id,
  seller_id,
  item_number,
  category,
  description,
  size,
  original_price,
  reduced_price,
  enable_price_reduction,
  donate_if_unsold,
  status,
  qr_code
)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    '88888888-8888-8888-8888-888888888888',
    '66666666-6666-6666-6666-666666666666',
    'SG2025-000007',
    'bindings',
    'Marker Griffon 13 Bindings - DIN 4-13, excellent condition',
    'One Size',
    200.00,
    160.00,
    true,
    false,
    'pending',
    'ITEM-11111111-1111-1111-1111-111111111111'
  );

-- Items for Lisa Anderson
INSERT INTO items (
  id,
  event_id,
  seller_id,
  item_number,
  category,
  description,
  size,
  original_price,
  reduced_price,
  enable_price_reduction,
  donate_if_unsold,
  status,
  qr_code
)
VALUES 
  (
    '22222222-2222-2222-2222-222222222222',
    '88888888-8888-8888-8888-888888888888',
    '77777777-7777-7777-7777-777777777777',
    'SG2025-000008',
    'skis',
    'K2 Mindbender 99 Skis - 165cm, women''s, excellent condition',
    '165cm',
    400.00,
    320.00,
    true,
    false,
    'pending',
    'ITEM-22222222-2222-2222-2222-222222222222'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '88888888-8888-8888-8888-888888888888',
    '77777777-7777-7777-7777-777777777777',
    'SG2025-000009',
    'boots',
    'Nordica Speedmachine 110 Boots - Size 25.5, heat molded, great condition',
    '25.5',
    280.00,
    NULL,
    false,
    true,
    'pending',
    'ITEM-33333333-3333-3333-3333-333333333333'
  );

-- ============================================
-- DEFAULT GEAR TAG TEMPLATE
-- ============================================
-- Create a default gear tag template with "price" and "QR code" fields
INSERT INTO gear_tag_templates (
  id,
  organization_id,
  name,
  description,
  layout_type,
  width_mm,
  height_mm,
  tag_fields,
  required_fields,
  font_family,
  font_size,
  border_width,
  qr_code_size,
  qr_code_position,
  qr_code_enabled,
  qr_code_data_fields,
  qr_code_seller_access,
  is_default,
  is_active,
  display_order
)
VALUES 
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Default Tag',
    'Default gear tag template with price and QR code',
    'standard',
    50.0,
    30.0,
    '[
      {
        "field": "item_number",
        "label": "Item #",
        "position": {"x": 5, "y": 5},
        "fontSize": 12,
        "fontWeight": "bold",
        "required": true
      },
      {
        "field": "original_price",
        "label": "Price",
        "position": {"x": 5, "y": 20},
        "fontSize": 14,
        "fontWeight": "bold",
        "required": true,
        "format": "$%.2f"
      }
    ]'::jsonb,
    '["item_number", "original_price"]'::text[],
    'Arial',
    10.0,
    0.5,
    15.0,
    'bottom-right',
    true,
    '["item_number", "original_price"]'::text[],
    '[]'::text[],
    true,
    true,
    0
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEFAULT CATEGORY: BIKES
-- ============================================
-- Create a default "bikes" category with attributes
INSERT INTO item_categories (
  id,
  organization_id,
  name,
  display_order,
  is_active,
  gear_tag_template_id
)
VALUES 
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'Bikes',
    0,
    true,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CATEGORY FIELD DEFINITIONS FOR BIKES
-- ============================================
-- Create field definitions for the bikes category
INSERT INTO item_field_definitions (
  id,
  organization_id,
  category_id,
  name,
  label,
  field_type,
  is_required,
  display_order,
  placeholder,
  help_text,
  options
)
VALUES 
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'year',
    'Year',
    'number',
    false,
    0,
    'e.g., 2020',
    'The year the bike was manufactured',
    NULL
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'wheel_size',
    'Wheel Size',
    'text',
    false,
    1,
    'e.g., 26", 27.5", 29"',
    'The wheel size of the bike',
    NULL
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'frame_size',
    'Frame Size',
    'text',
    false,
    2,
    'e.g., Small, Medium, Large',
    'The frame size of the bike',
    NULL
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bike_type',
    'Bike Type',
    'dropdown',
    false,
    3,
    NULL,
    'The type of bike',
    '["Mountain", "Road", "Hybrid", "Electric", "BMX", "Other"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
