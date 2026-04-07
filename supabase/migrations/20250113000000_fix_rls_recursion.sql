-- Migration: Fix infinite recursion in RLS policies
-- The recursion occurs because:
-- 1. Events policy "Sellers can view events they have items in" queries items table
-- 2. Items policy "Admins can view items for their organization's events" queries events table
-- This creates a circular dependency

-- ============================================
-- Fix Events Policies
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

-- Recreate the policy using the function (but actually, we don't need this since
-- "Sellers can browse all events" already allows sellers to see all events)
-- So we'll just leave it removed to avoid recursion

-- ============================================
-- Fix Items Policies
-- ============================================

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

