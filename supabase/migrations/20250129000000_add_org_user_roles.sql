-- Migration: Add role-based access control for organization users
-- Adds 'admin' and 'volunteer' roles to admin_users table
-- Admins can: manage events, change swap settings, create volunteer accounts, do everything volunteers can do
-- Volunteers can: create seller accounts, create items, mark items as sold, mark items as paid

-- ============================================
-- 1. Create role enum
-- ============================================
CREATE TYPE org_user_role AS ENUM ('admin', 'volunteer');

-- ============================================
-- 2. Add role column to admin_users table
-- ============================================
ALTER TABLE admin_users 
  ADD COLUMN role org_user_role NOT NULL DEFAULT 'volunteer';

-- Set all existing users to 'admin' (since we're starting fresh, this is just for safety)
-- In practice, you'll want to set specific users to admin when creating them
UPDATE admin_users SET role = 'admin' WHERE role = 'volunteer';

-- ============================================
-- 3. Update helper functions to check roles
-- ============================================

-- First, drop policies that depend on the functions we're about to recreate
DROP POLICY IF EXISTS "Admins can create events for their organization" ON events;
DROP POLICY IF EXISTS "Admins can view events for their organization" ON events;
DROP POLICY IF EXISTS "Admins can view items for their organization's events" ON items;
DROP POLICY IF EXISTS "Admins can update items for their organization's events" ON items;
DROP POLICY IF EXISTS "Admins can view transactions for their organization's events" ON transactions;
DROP POLICY IF EXISTS "Admins can insert transactions for their organization's events" ON transactions;
DROP POLICY IF EXISTS "Admins can view payouts for their organization's events" ON payouts;
DROP POLICY IF EXISTS "Admins can insert payouts for their organization's events" ON payouts;
DROP POLICY IF EXISTS "Admins can update payouts for their organization's events" ON payouts;
DROP POLICY IF EXISTS "Admins can view their organization" ON organizations;

-- Now drop the functions (CASCADE will drop dependent policies)
DROP FUNCTION IF EXISTS user_is_admin_for_org(UUID) CASCADE;
CREATE OR REPLACE FUNCTION user_is_admin_for_org(org_id UUID)
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
  
  -- Check if user is an admin (not just any org user) for this organization
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND organization_id = org_id
    AND role = 'admin'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Create function to check if user is volunteer (or admin) for an organization
CREATE OR REPLACE FUNCTION user_is_org_user_for_org(org_id UUID)
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
  
  -- Check if user is any org user (admin or volunteer) for this organization
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND organization_id = org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Create function to get user's organization_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_id UUID;
  org_id UUID;
BEGIN
  user_id := auth.uid();
  
  -- Get organization_id for current user (bypassing RLS)
  SELECT organization_id INTO org_id
  FROM admin_users 
  WHERE id = user_id;
  
  RETURN org_id;
END;
$$;

-- Create function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_user_admin()
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
  
  -- Check if user is admin (bypassing RLS)
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND role = 'admin'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Update admin_can_access_event to check for any org user (admin or volunteer)
-- This is used for items/transactions/payouts where both roles can access
-- Drop policies that depend on this function first
DROP POLICY IF EXISTS "Admins can view items for their organization's events" ON items;
DROP POLICY IF EXISTS "Admins can update items for their organization's events" ON items;
DROP FUNCTION IF EXISTS admin_can_access_event(UUID) CASCADE;
CREATE OR REPLACE FUNCTION org_user_can_access_event(event_id UUID)
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
  WHERE id = org_user_can_access_event.event_id;
  
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is any org user (admin or volunteer) for this organization
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND organization_id = org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Create function to check if user is admin for an event's organization
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
  
  -- Check if user is admin (not just any org user) for this organization
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
    AND organization_id = org_id
    AND role = 'admin'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION user_is_admin_for_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_is_org_user_for_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION org_user_can_access_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_can_access_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- ============================================
-- 4. Update Events RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view events for their organization" ON events;
DROP POLICY IF EXISTS "Admins can create events for their organization" ON events;

-- View: Both admins and volunteers can view events for their organization
CREATE POLICY "Org users can view events for their organization"
  ON events FOR SELECT
  USING (user_is_org_user_for_org(organization_id));

-- Create: Both admins and volunteers can create events
-- (You can change this to admin-only if desired)
CREATE POLICY "Org users can create events for their organization"
  ON events FOR INSERT
  WITH CHECK (user_is_org_user_for_org(organization_id));

-- Update: Only admins can update events
CREATE POLICY "Admins can update events for their organization"
  ON events FOR UPDATE
  USING (user_is_admin_for_org(organization_id));

-- Delete: Only admins can delete events
CREATE POLICY "Admins can delete events for their organization"
  ON events FOR DELETE
  USING (user_is_admin_for_org(organization_id));

-- ============================================
-- 5. Update Admin Users RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own admin_users record" ON admin_users;
DROP POLICY IF EXISTS "Users can view their own admin_users record" ON admin_users;

-- View: Users can see their own record, admins can see all org users in their organization
CREATE POLICY "Users can view their own admin_users record"
  ON admin_users FOR SELECT
  USING (id = auth.uid());

-- Use SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can view org users in their organization"
  ON admin_users FOR SELECT
  USING (
    is_user_admin() 
    AND organization_id = get_user_organization_id()
  );

-- Insert: Only admins can create new org user accounts
-- Exception: Users can create their own record if they're creating the first user for an org
-- (This allows signUpAsAdmin to work - the first user will be admin)
CREATE POLICY "Admins can create org users in their organization"
  ON admin_users FOR INSERT
  WITH CHECK (
    -- Allow if user is creating their own record (for first admin signup)
    id = auth.uid()
    OR
    -- Allow if user is an admin in the same organization (using function to avoid recursion)
    (is_user_admin() AND organization_id = get_user_organization_id())
  );

-- Update: Only admins can update org user records (including role changes)
CREATE POLICY "Admins can update org users in their organization"
  ON admin_users FOR UPDATE
  USING (
    is_user_admin() 
    AND organization_id = get_user_organization_id()
  );

-- Delete: Only admins can delete org user accounts
CREATE POLICY "Admins can delete org users in their organization"
  ON admin_users FOR DELETE
  USING (
    is_user_admin() 
    AND organization_id = get_user_organization_id()
  );

-- ============================================
-- 6. Update Items RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view items for their organization's events" ON items;
DROP POLICY IF EXISTS "Admins can update items for their organization's events" ON items;

-- View: Both admins and volunteers can view items
CREATE POLICY "Org users can view items for their organization's events"
  ON items FOR SELECT
  USING (org_user_can_access_event(event_id));

-- Update: Both admins and volunteers can update items (mark as sold, paid, etc.)
CREATE POLICY "Org users can update items for their organization's events"
  ON items FOR UPDATE
  USING (org_user_can_access_event(event_id));

-- Insert: Both admins and volunteers can create items
CREATE POLICY "Org users can insert items for their organization's events"
  ON items FOR INSERT
  WITH CHECK (org_user_can_access_event(event_id));

-- ============================================
-- 7. Update Transactions RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view transactions for their organization's events" ON transactions;
DROP POLICY IF EXISTS "Admins can insert transactions for their organization's events" ON transactions;

-- View: Both admins and volunteers can view transactions
CREATE POLICY "Org users can view transactions for their organization's events"
  ON transactions FOR SELECT
  USING (org_user_can_access_event(event_id));

-- Insert: Both admins and volunteers can create transactions (mark items as sold)
CREATE POLICY "Org users can insert transactions for their organization's events"
  ON transactions FOR INSERT
  WITH CHECK (
    org_user_can_access_event(event_id)
    AND processed_by = auth.uid()
  );

-- ============================================
-- 8. Update Payouts RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view payouts for their organization's events" ON payouts;
DROP POLICY IF EXISTS "Admins can insert payouts for their organization's events" ON payouts;
DROP POLICY IF EXISTS "Admins can update payouts for their organization's events" ON payouts;

-- View: Both admins and volunteers can view payouts
CREATE POLICY "Org users can view payouts for their organization's events"
  ON payouts FOR SELECT
  USING (org_user_can_access_event(event_id));

-- Insert: Both admins and volunteers can create payouts
CREATE POLICY "Org users can insert payouts for their organization's events"
  ON payouts FOR INSERT
  WITH CHECK (
    org_user_can_access_event(event_id)
    AND issued_by = auth.uid()
  );

-- Update: Both admins and volunteers can update payouts (mark as paid)
CREATE POLICY "Org users can update payouts for their organization's events"
  ON payouts FOR UPDATE
  USING (org_user_can_access_event(event_id));

-- ============================================
-- 9. Update Organizations RLS Policies
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can view their organization" ON organizations;

-- View: Both admins and volunteers can view their organization
CREATE POLICY "Org users can view their organization"
  ON organizations FOR SELECT
  USING (user_is_org_user_for_org(id));

-- Update: Only admins can update organization settings
CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (user_is_admin_for_org(id));

-- ============================================
-- 10. Update Swap Registration Settings RLS Policies
-- ============================================
-- Only update if table exists (created in migration 20250105000000)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'swap_registration_page_settings') THEN
    -- Drop existing policies for swap_registration_page_settings
    DROP POLICY IF EXISTS "Admins can view page settings for their organization" ON swap_registration_page_settings;
    DROP POLICY IF EXISTS "Admins can manage page settings for their organization" ON swap_registration_page_settings;

    -- View: Both admins and volunteers can view settings
    CREATE POLICY "Org users can view page settings for their organization"
      ON swap_registration_page_settings FOR SELECT
      USING (user_is_org_user_for_org(organization_id));

    -- Insert/Update: Only admins can modify settings
    CREATE POLICY "Admins can manage page settings for their organization"
      ON swap_registration_page_settings FOR ALL
      USING (user_is_admin_for_org(organization_id))
      WITH CHECK (user_is_admin_for_org(organization_id));
  END IF;
END $$;

-- ============================================
-- 11. Update Swap Registration Fields RLS Policies
-- ============================================
-- Only update if table exists (created in migration 20250104000000)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'swap_registration_field_definitions') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can view swap registration fields for their organization" ON swap_registration_field_definitions;
    DROP POLICY IF EXISTS "Admins can manage swap registration fields for their organization" ON swap_registration_field_definitions;

    -- View: Both admins and volunteers can view fields
    CREATE POLICY "Org users can view swap registration fields for their organization"
      ON swap_registration_field_definitions FOR SELECT
      USING (user_is_org_user_for_org(organization_id));

    -- Insert/Update/Delete: Only admins can modify fields
    CREATE POLICY "Admins can manage swap registration fields for their organization"
      ON swap_registration_field_definitions FOR ALL
      USING (user_is_admin_for_org(organization_id))
      WITH CHECK (user_is_admin_for_org(organization_id));
  END IF;
END $$;

-- ============================================
-- 12. Update Categories RLS Policies
-- ============================================
-- Only update if table exists (created in migration 20250103000000)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_categories') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can view categories for their organization" ON item_categories;
    DROP POLICY IF EXISTS "Admins can manage categories for their organization" ON item_categories;

    -- View: Both admins and volunteers can view categories
    CREATE POLICY "Org users can view categories for their organization"
      ON item_categories FOR SELECT
      USING (user_is_org_user_for_org(organization_id));

    -- Insert/Update/Delete: Only admins can modify categories
    CREATE POLICY "Admins can manage categories for their organization"
      ON item_categories FOR ALL
      USING (user_is_admin_for_org(organization_id))
      WITH CHECK (user_is_admin_for_org(organization_id));
  END IF;
END $$;

-- ============================================
-- 13. Update Field Definitions RLS Policies
-- ============================================
-- Only update if table exists (created in migration 20250103000000)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_field_definitions') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can view field definitions for their organization" ON item_field_definitions;
    DROP POLICY IF EXISTS "Admins can manage field definitions for their organization" ON item_field_definitions;

    -- View: Both admins and volunteers can view field definitions
    CREATE POLICY "Org users can view field definitions for their organization"
      ON item_field_definitions FOR SELECT
      USING (user_is_org_user_for_org(organization_id));

    -- Insert/Update/Delete: Only admins can modify field definitions
    CREATE POLICY "Admins can manage field definitions for their organization"
      ON item_field_definitions FOR ALL
      USING (user_is_admin_for_org(organization_id))
      WITH CHECK (user_is_admin_for_org(organization_id));
  END IF;
END $$;

-- ============================================
-- 14. Update Gear Tag Templates RLS Policies
-- ============================================
-- Only update if table exists (created in migration 20250105000000)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gear_tag_templates') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can view tag templates for their organization" ON gear_tag_templates;
    DROP POLICY IF EXISTS "Admins can manage tag templates for their organization" ON gear_tag_templates;

    -- View: Both admins and volunteers can view tag templates
    CREATE POLICY "Org users can view tag templates for their organization"
      ON gear_tag_templates FOR SELECT
      USING (user_is_org_user_for_org(organization_id));

    -- Insert/Update/Delete: Only admins can modify tag templates
    CREATE POLICY "Admins can manage tag templates for their organization"
      ON gear_tag_templates FOR ALL
      USING (user_is_admin_for_org(organization_id))
      WITH CHECK (user_is_admin_for_org(organization_id));
  END IF;
END $$;

-- ============================================
-- 15. Update Price Reduction Settings (in organizations table)
-- ============================================
-- Already handled by organization UPDATE policy above

-- ============================================
-- 16. Update Swap Registrations RLS Policies
-- ============================================
-- Only update if table exists (created in migration 20250104000000)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'seller_swap_registrations') THEN
    -- Drop existing policy
    DROP POLICY IF EXISTS "Admins can view swap registrations for their organization's events" ON seller_swap_registrations;

    -- View: Both admins and volunteers can view swap registrations
    CREATE POLICY "Org users can view swap registrations for their organization's events"
      ON seller_swap_registrations FOR SELECT
      USING (
        event_id IN (
          SELECT e.id FROM events e
          WHERE user_is_org_user_for_org(e.organization_id)
        )
      );
  END IF;
END $$;

