-- ============================================
-- STEP 1: Fix RLS Recursion Issues
-- ============================================

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Sellers can view events they have items in" ON events;

-- Create a SECURITY DEFINER function to check if seller has items in an event
-- This bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION seller_has_items_in_event(event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_id UUID;
  result BOOLEAN;
BEGIN
  user_id := auth.uid();
  
  -- SECURITY DEFINER means this runs as postgres, bypassing RLS
  -- Query items directly without RLS checks
  SELECT EXISTS (
    SELECT 1 
    FROM items 
    WHERE seller_id = user_id
    AND event_id = seller_has_items_in_event.event_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION seller_has_items_in_event(UUID) TO authenticated;

-- Drop the problematic admin policies that query events
DROP POLICY IF EXISTS "Admins can view items for their organization's events" ON items;
DROP POLICY IF EXISTS "Admins can update items for their organization's events" ON items;

-- Create a SECURITY DEFINER function to check if user is admin for an event's organization
CREATE OR REPLACE FUNCTION admin_can_access_event(event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_id UUID;
  org_id UUID;
  result BOOLEAN;
BEGIN
  user_id := auth.uid();
  
  -- Get the organization_id for this event (bypassing RLS)
  SELECT organization_id INTO org_id
  FROM events
  WHERE id = admin_can_access_event.event_id;
  
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is admin for this organization (bypassing RLS)
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND organization_id = org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_can_access_event(UUID) TO authenticated;

-- Recreate the admin items policies using the function
CREATE POLICY "Admins can view items for their organization's events"
  ON items FOR SELECT
  USING (admin_can_access_event(event_id));

CREATE POLICY "Admins can update items for their organization's events"
  ON items FOR UPDATE
  USING (admin_can_access_event(event_id));

-- ============================================
-- STEP 2: Load Seed Data
-- ============================================

-- ORGANIZATION
INSERT INTO organizations (id, name, slug, commission_rate, vendor_commission_rate)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Bellingham Ski Swap', 'bellingham-ski-swap', 0.25, 0.20)
ON CONFLICT (slug) DO NOTHING;

-- ADMIN USER
-- Note: This requires the auth user to exist first!
-- Create the auth user in Supabase Dashboard → Authentication → Users first, then uncomment this:
-- Or use: INSERT INTO admin_users ... only if the auth user exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '22222222-2222-2222-2222-222222222222') THEN
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
  ELSE
    RAISE NOTICE 'Skipping admin_users insert: Auth user 22222222-2222-2222-2222-222222222222 does not exist. Create it in Supabase Dashboard → Authentication → Users first.';
  END IF;
END $$;

-- SELLERS
-- Note: These require auth users to exist first!
-- Sellers will be created automatically when they sign up via phone auth in the app.
-- If you want to pre-create them, create auth users first, then uncomment/modify this:
DO $$
BEGIN
  -- Only insert sellers if their auth users exist
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '33333333-3333-3333-3333-333333333333') THEN
    INSERT INTO sellers (id, first_name, last_name, phone, email, qr_code)
    VALUES 
      (
        '33333333-3333-3333-3333-333333333333',
        'Sarah',
        'Johnson',
        '+13605551234',
        'sarah.johnson@example.com',
        'SELLER-SG2025-001'
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '44444444-4444-4444-4444-444444444444') THEN
    INSERT INTO sellers (id, first_name, last_name, phone, email, qr_code)
    VALUES 
      (
        '44444444-4444-4444-4444-444444444444',
        'Mike',
        'Chen',
        '+13605551235',
        'mike.chen@example.com',
        'SELLER-SG2025-002'
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '55555555-5555-5555-5555-555555555555') THEN
    INSERT INTO sellers (id, first_name, last_name, phone, email, qr_code)
    VALUES 
      (
        '55555555-5555-5555-5555-555555555555',
        'Emily',
        'Rodriguez',
        '+13605551236',
        'emily.rodriguez@example.com',
        'SELLER-SG2025-003'
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '66666666-6666-6666-6666-666666666666') THEN
    INSERT INTO sellers (id, first_name, last_name, phone, email, qr_code)
    VALUES 
      (
        '66666666-6666-6666-6666-666666666666',
        'David',
        'Kim',
        '+13605551237',
        'david.kim@example.com',
        'SELLER-SG2025-004'
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '77777777-7777-7777-7777-777777777777') THEN
    INSERT INTO sellers (id, first_name, last_name, phone, email, qr_code)
    VALUES 
      (
        '77777777-7777-7777-7777-777777777777',
        'Lisa',
        'Anderson',
        '+13605551238',
        'lisa.anderson@example.com',
        'SELLER-SG2025-005'
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Seller inserts skipped if auth users do not exist. Sellers will be created automatically when they sign up via phone auth.';
END $$;

-- EVENT
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

-- ITEMS
-- Note: Items require sellers to exist. Items will only be inserted if their corresponding seller exists.
DO $$
BEGIN
  -- Sarah Johnson's items
  IF EXISTS (SELECT 1 FROM sellers WHERE id = '33333333-3333-3333-3333-333333333333') THEN
    INSERT INTO items (id, event_id, seller_id, item_number, category, description, size, original_price, reduced_price, enable_price_reduction, donate_if_unsold, status, qr_code)
    VALUES 
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'SG2025-000001', 'skis', 'Rossignol Experience 88 Skis - 170cm, excellent condition, used 2 seasons', '170cm', 350.00, 280.00, true, false, 'pending', 'ITEM-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'SG2025-000002', 'boots', 'Salomon S/Max 120 Ski Boots - Size 27.5, heat molded, great fit', '27.5', 250.00, NULL, false, true, 'pending', 'ITEM-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Mike Chen's items
  IF EXISTS (SELECT 1 FROM sellers WHERE id = '44444444-4444-4444-4444-444444444444') THEN
    INSERT INTO items (id, event_id, seller_id, item_number, category, description, size, original_price, reduced_price, enable_price_reduction, donate_if_unsold, status, qr_code)
    VALUES 
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', '88888888-8888-8888-8888-888888888888', '44444444-4444-4444-4444-444444444444', 'SG2025-000003', 'skis', 'Atomic Vantage 90 Skis - 175cm, like new, only used 3 times', '175cm', 450.00, 360.00, true, false, 'pending', 'ITEM-cccccccc-cccc-cccc-cccc-cccccccccccc'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', '88888888-8888-8888-8888-888888888888', '44444444-4444-4444-4444-444444444444', 'SG2025-000004', 'poles', 'Leki Carbon Poles - 120cm, adjustable, lightweight', '120cm', 80.00, NULL, false, false, 'pending', 'ITEM-dddddddd-dddd-dddd-dddd-dddddddddddd')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Emily Rodriguez's items
  IF EXISTS (SELECT 1 FROM sellers WHERE id = '55555555-5555-5555-5555-555555555555') THEN
    INSERT INTO items (id, event_id, seller_id, item_number, category, description, size, original_price, reduced_price, enable_price_reduction, donate_if_unsold, status, qr_code)
    VALUES 
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', 'SG2025-000005', 'clothing', 'Patagonia Powder Bowl Jacket - Medium, waterproof, excellent condition', 'Medium', 180.00, 140.00, true, false, 'pending', 'ITEM-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
      ('ffffffff-ffff-ffff-ffff-ffffffffffff', '88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', 'SG2025-000006', 'accessories', 'Smith I/O Goggles with 2 lenses - clear and tinted, excellent condition', 'One Size', 120.00, NULL, false, false, 'pending', 'ITEM-ffffffff-ffff-ffff-ffff-ffffffffffff')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- David Kim's items
  IF EXISTS (SELECT 1 FROM sellers WHERE id = '66666666-6666-6666-6666-666666666666') THEN
    INSERT INTO items (id, event_id, seller_id, item_number, category, description, size, original_price, reduced_price, enable_price_reduction, donate_if_unsold, status, qr_code)
    VALUES 
      ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', 'SG2025-000007', 'bindings', 'Marker Griffon 13 Bindings - DIN 4-13, excellent condition', 'One Size', 200.00, 160.00, true, false, 'pending', 'ITEM-11111111-1111-1111-1111-111111111111')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Lisa Anderson's items
  IF EXISTS (SELECT 1 FROM sellers WHERE id = '77777777-7777-7777-7777-777777777777') THEN
    INSERT INTO items (id, event_id, seller_id, item_number, category, description, size, original_price, reduced_price, enable_price_reduction, donate_if_unsold, status, qr_code)
    VALUES 
      ('22222222-2222-2222-2222-222222222222', '88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'SG2025-000008', 'skis', 'K2 Mindbender 99 Skis - 165cm, women''s, excellent condition', '165cm', 400.00, 320.00, true, false, 'pending', 'ITEM-22222222-2222-2222-2222-222222222222'),
      ('33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'SG2025-000009', 'boots', 'Nordica Speedmachine 110 Boots - Size 25.5, heat molded, great condition', '25.5', 280.00, NULL, false, true, 'pending', 'ITEM-33333333-3333-3333-3333-333333333333')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Items inserted only for sellers that exist. If no items were inserted, create sellers first (they will be created automatically when users sign up via phone auth).';
END $$;

