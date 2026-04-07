-- Combined Migration File
-- Generated on Mon Jan 26 15:14:33 PST 2026
-- Apply this file via Supabase Dashboard SQL Editor

-- ========================================
-- Migration: 20250101000000_init_schema.sql
-- ========================================
-- Initial database schema for Gear Swap
-- This migration creates all core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE event_status AS ENUM ('registration', 'checkin', 'shopping', 'pickup', 'closed');
CREATE TYPE item_status AS ENUM ('pending', 'checked_in', 'for_sale', 'sold', 'picked_up', 'donated');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'check');

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.25,
  vendor_commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  registration_open_date DATE NOT NULL,
  registration_close_date DATE NOT NULL,
  shop_open_time TIMESTAMPTZ NOT NULL,
  shop_close_time TIMESTAMPTZ NOT NULL,
  price_drop_time TIMESTAMPTZ,
  status event_status NOT NULL DEFAULT 'registration',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sellers table (linked to auth.users)
CREATE TABLE sellers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin users table (linked to auth.users)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  permissions JSONB DEFAULT '{"check_in": true, "pos": true, "pickup": true, "reports": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  item_number TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  size TEXT,
  original_price DECIMAL(10,2) NOT NULL,
  reduced_price DECIMAL(10,2),
  enable_price_reduction BOOLEAN NOT NULL DEFAULT false,
  donate_if_unsold BOOLEAN NOT NULL DEFAULT false,
  status item_status NOT NULL DEFAULT 'pending',
  qr_code TEXT UNIQUE NOT NULL,
  checked_in_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  sold_price DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  sold_price DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  seller_amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  processed_by UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payouts table
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  check_number TEXT,
  issued_by UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  signed_by_seller BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  items UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_events_organization_id ON events(organization_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_items_event_id ON items(event_id);
CREATE INDEX idx_items_seller_id ON items(seller_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_qr_code ON items(qr_code);
CREATE INDEX idx_sellers_qr_code ON sellers(qr_code);
CREATE INDEX idx_sellers_phone ON sellers(phone);
CREATE INDEX idx_transactions_event_id ON transactions(event_id);
CREATE INDEX idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX idx_payouts_event_id ON payouts(event_id);
CREATE INDEX idx_payouts_seller_id ON payouts(seller_id);
CREATE INDEX idx_admin_users_organization_id ON admin_users(organization_id);



-- ========================================
-- Migration: 20250102000000_add_rls_policies.sql
-- ========================================
-- Row Level Security (RLS) Policies
-- Ensures data isolation and proper access control

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Organizations: Admins can see their organization
CREATE POLICY "Admins can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Events: Admins can see events for their organization, sellers can see events they have items in
CREATE POLICY "Admins can view events for their organization"
  ON events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Sellers can view all events for browsing/discovery (read-only)
CREATE POLICY "Sellers can browse all events"
  ON events FOR SELECT
  USING (
    -- Allow if user is authenticated as a seller (has a seller record)
    EXISTS (
      SELECT 1 FROM sellers WHERE id = auth.uid()
    )
    -- Exclude admins (they use the admin policy above)
    AND NOT EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view events they have items in"
  ON events FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT event_id FROM items WHERE seller_id = auth.uid()
    )
  );

-- Sellers: Users can see their own record
CREATE POLICY "Users can view their own seller record"
  ON sellers FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own seller record"
  ON sellers FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own seller record"
  ON sellers FOR UPDATE
  USING (id = auth.uid());

-- Admin users: Admins can see other admins in their organization
CREATE POLICY "Admins can view admins in their organization"
  ON admin_users FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Items: Sellers can see their own items, admins can see items for their organization's events
CREATE POLICY "Sellers can view their own items"
  ON items FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own items"
  ON items FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own items (before check-in)"
  ON items FOR UPDATE
  USING (
    seller_id = auth.uid() 
    AND status IN ('pending', 'checked_in')
  );

CREATE POLICY "Admins can view items for their organization's events"
  ON items FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update items for their organization's events"
  ON items FOR UPDATE
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
  );

-- Transactions: Sellers can see transactions for their items, admins can see all for their organization
CREATE POLICY "Sellers can view their own transactions"
  ON transactions FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Admins can view transactions for their organization's events"
  ON transactions FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert transactions for their organization's events"
  ON transactions FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
    AND processed_by = auth.uid()
  );

-- Payouts: Sellers can see their own payouts, admins can see all for their organization
CREATE POLICY "Sellers can view their own payouts"
  ON payouts FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Admins can view payouts for their organization's events"
  ON payouts FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert payouts for their organization's events"
  ON payouts FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
    AND issued_by = auth.uid()
  );

CREATE POLICY "Admins can update payouts for their organization's events"
  ON payouts FOR UPDATE
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
  );



-- ========================================
-- Migration: 20250103000000_add_dynamic_fields.sql
-- ========================================
-- Migration: Add dynamic field system for organizations
-- Allows organizations to define custom categories and item fields

-- Update sellers table: make email required and permanent
ALTER TABLE sellers 
  ALTER COLUMN email SET NOT NULL;

-- Item Categories table (organization-defined categories with nesting support)
CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES item_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name, parent_id)
);

-- Item Field Definitions table (organization-defined fields for items)
CREATE TYPE field_type AS ENUM (
  'text',
  'textarea',
  'number',
  'decimal',
  'boolean',
  'dropdown',
  'date',
  'time'
);

CREATE TABLE item_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type field_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  placeholder TEXT,
  help_text TEXT,
  validation_rules JSONB DEFAULT '{}',
  -- For dropdown fields: options stored as JSON array
  options JSONB,
  -- For price reduction fields: configuration
  is_price_field BOOLEAN NOT NULL DEFAULT false,
  is_price_reduction_field BOOLEAN NOT NULL DEFAULT false,
  price_reduction_percentage BOOLEAN NOT NULL DEFAULT false, -- true = percentage, false = fixed amount
  price_reduction_time_control TEXT NOT NULL DEFAULT 'org', -- 'org' or 'seller'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Update items table to store custom field data
ALTER TABLE items 
  ADD COLUMN custom_fields JSONB DEFAULT '{}',
  ADD COLUMN category_id UUID REFERENCES item_categories(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_item_categories_organization_id ON item_categories(organization_id);
CREATE INDEX idx_item_categories_parent_id ON item_categories(parent_id);
CREATE INDEX idx_item_field_definitions_organization_id ON item_field_definitions(organization_id);
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_items_custom_fields ON items USING GIN(custom_fields);

-- Enable RLS
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for item_categories
CREATE POLICY "Admins can view categories for their organization"
  ON item_categories FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage categories for their organization"
  ON item_categories FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Sellers can view categories for events they're participating in
CREATE POLICY "Sellers can view categories for their events"
  ON item_categories FOR SELECT
  USING (
    organization_id IN (
      SELECT DISTINCT e.organization_id 
      FROM events e
      JOIN items i ON e.id = i.event_id
      WHERE i.seller_id = auth.uid()
    )
  );

-- RLS Policies for item_field_definitions
CREATE POLICY "Admins can view field definitions for their organization"
  ON item_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage field definitions for their organization"
  ON item_field_definitions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Sellers can view field definitions for events they're participating in
CREATE POLICY "Sellers can view field definitions for their events"
  ON item_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT DISTINCT e.organization_id 
      FROM events e
      JOIN items i ON e.id = i.event_id
      WHERE i.seller_id = auth.uid()
    )
  );





-- ========================================
-- Migration: 20250104000000_add_swap_registration_fields.sql
-- ========================================
-- Migration: Add swap registration field system
-- Allows organizations to define custom fields for seller swap registration
-- Separate from app registration (which only requires email)

-- Swap Registration Field Definitions table
CREATE TABLE swap_registration_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type field_type NOT NULL, -- Reuse field_type enum from item_field_definitions
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_optional BOOLEAN NOT NULL DEFAULT true, -- If true, sellers can skip this field
  display_order INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  placeholder TEXT,
  help_text TEXT,
  validation_rules JSONB DEFAULT '{}',
  options JSONB, -- For dropdown fields
  is_suggested_field BOOLEAN NOT NULL DEFAULT false, -- True for pre-defined suggested fields
  suggested_field_type TEXT, -- 'profile_photo', 'address', 'contact_info', 'marketing_opt_in', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Seller Swap Registrations table
-- Tracks which sellers have registered for which events and their registration data
CREATE TABLE seller_swap_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  registration_data JSONB DEFAULT '{}', -- Stores all field values
  is_complete BOOLEAN NOT NULL DEFAULT false, -- True if all required fields are filled
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, seller_id)
);

-- Update sellers table to add address and marketing opt-in
ALTER TABLE sellers 
  ADD COLUMN profile_photo_url TEXT,
  ADD COLUMN address TEXT,
  ADD COLUMN address_line2 TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state TEXT,
  ADD COLUMN zip_code TEXT,
  ADD COLUMN country TEXT DEFAULT 'USA',
  ADD COLUMN marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN contact_info JSONB DEFAULT '{}'; -- For additional contact info

-- Create indexes
CREATE INDEX idx_swap_reg_field_defs_org_id ON swap_registration_field_definitions(organization_id);
CREATE INDEX idx_seller_swap_regs_event_id ON seller_swap_registrations(event_id);
CREATE INDEX idx_seller_swap_regs_seller_id ON seller_swap_registrations(seller_id);
CREATE INDEX idx_seller_swap_regs_complete ON seller_swap_registrations(is_complete);

-- Enable RLS
ALTER TABLE swap_registration_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_swap_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for swap_registration_field_definitions
CREATE POLICY "Admins can view swap registration fields for their organization"
  ON swap_registration_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage swap registration fields for their organization"
  ON swap_registration_field_definitions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Sellers can view swap registration fields for events they can register for
CREATE POLICY "Sellers can view swap registration fields for events"
  ON swap_registration_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT e.organization_id 
      FROM events e
      WHERE e.status IN ('registration', 'checkin', 'shopping', 'pickup')
    )
  );

-- RLS Policies for seller_swap_registrations
CREATE POLICY "Sellers can view their own swap registrations"
  ON seller_swap_registrations FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own swap registrations"
  ON seller_swap_registrations FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own swap registrations"
  ON seller_swap_registrations FOR UPDATE
  USING (seller_id = auth.uid());

-- Admins can view all swap registrations for their organization's events
CREATE POLICY "Admins can view swap registrations for their organization's events"
  ON seller_swap_registrations FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN admin_users au ON e.organization_id = au.organization_id
      WHERE au.id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_swap_registration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seller_swap_registration_updated_at
  BEFORE UPDATE ON seller_swap_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_swap_registration_updated_at();



-- ========================================
-- Migration: 20250105000000_add_page_customization_and_tags.sql
-- ========================================
-- Migration: Add swap registration page customization and gear tag templates

-- Swap Registration Page Customization table
CREATE TABLE swap_registration_page_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_title TEXT NOT NULL DEFAULT 'Register for Swap',
  page_description TEXT,
  welcome_message TEXT,
  field_groups JSONB DEFAULT '[]', -- Array of field groups/sections
  -- field_groups format: [{"id": "group1", "title": "Personal Information", "fields": ["field1", "field2"], "order": 1}]
  custom_styles JSONB DEFAULT '{}', -- Custom colors, fonts, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Gear Tag Templates table
CREATE TABLE gear_tag_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Bike Tag", "Skis Tag", "General Tag"
  description TEXT,
  -- Tag layout configuration
  layout_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'compact', 'detailed'
  width_mm DECIMAL(5,2) NOT NULL DEFAULT 50.0, -- Tag width in millimeters
  height_mm DECIMAL(5,2) NOT NULL DEFAULT 30.0, -- Tag height in millimeters
  -- Fields to display on tag (JSON array of field names and positions)
  tag_fields JSONB NOT NULL DEFAULT '[]',
  -- Format: [{"field": "item_number", "label": "Item #", "position": {"x": 0, "y": 0}, "fontSize": 12, "required": true}, ...]
  -- Required fields for this tag type
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  -- Optional: Link to categories (if null, can be used for any category)
  category_ids UUID[],
  -- Tag styling
  font_family TEXT DEFAULT 'Arial',
  font_size DECIMAL(4,2) DEFAULT 10.0,
  border_width DECIMAL(3,2) DEFAULT 0.5,
  qr_code_size DECIMAL(4,2) DEFAULT 15.0, -- QR code size in mm
  qr_code_position TEXT DEFAULT 'bottom-right', -- 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
  qr_code_enabled BOOLEAN NOT NULL DEFAULT true, -- QR codes are always enabled on sticker tags
  -- QR code data configuration: which fields are included when QR code is scanned
  -- Format: JSON array of field names, e.g., ["item_number", "price", "reduced_price", "price_drop_time", "photos"]
  qr_code_data_fields JSONB DEFAULT '["item_number"]', -- Fields to include in QR code data
  -- QR code access control: who can see what data
  qr_code_seller_access JSONB DEFAULT '{}', -- Fields sellers can see when scanning (empty = org users only)
  is_default BOOLEAN NOT NULL DEFAULT false, -- True if this is the default tag template
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create indexes
CREATE INDEX idx_swap_reg_page_settings_org_id ON swap_registration_page_settings(organization_id);
CREATE INDEX idx_gear_tag_templates_org_id ON gear_tag_templates(organization_id);
CREATE INDEX idx_gear_tag_templates_active ON gear_tag_templates(is_active);
CREATE INDEX idx_gear_tag_templates_default ON gear_tag_templates(is_default);

-- Enable RLS
ALTER TABLE swap_registration_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_tag_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for swap_registration_page_settings
CREATE POLICY "Admins can view page settings for their organization"
  ON swap_registration_page_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage page settings for their organization"
  ON swap_registration_page_settings FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Sellers can view page settings for events they can register for
CREATE POLICY "Sellers can view page settings for events"
  ON swap_registration_page_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT e.organization_id 
      FROM events e
      WHERE e.status IN ('registration', 'checkin', 'shopping', 'pickup')
    )
  );

-- RLS Policies for gear_tag_templates
CREATE POLICY "Admins can view tag templates for their organization"
  ON gear_tag_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage tag templates for their organization"
  ON gear_tag_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Sellers can view tag templates for events they're participating in
CREATE POLICY "Sellers can view tag templates for their events"
  ON gear_tag_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT DISTINCT e.organization_id 
      FROM events e
      JOIN items i ON e.id = i.event_id
      WHERE i.seller_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp for page settings
CREATE OR REPLACE FUNCTION update_swap_reg_page_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_swap_reg_page_settings_updated_at
  BEFORE UPDATE ON swap_registration_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_swap_reg_page_settings_updated_at();

-- Function to update updated_at timestamp for tag templates
CREATE OR REPLACE FUNCTION update_gear_tag_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gear_tag_templates_updated_at
  BEFORE UPDATE ON gear_tag_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_gear_tag_templates_updated_at();



-- ========================================
-- Migration: 20250106000000_add_price_reduction_settings.sql
-- ========================================
-- Migration: Add price reduction control settings for organizations
-- Allows orgs to control who can set price reductions and timing

-- Add price reduction settings to organizations table
ALTER TABLE organizations 
  ADD COLUMN price_reduction_settings JSONB DEFAULT '{
    "sellerCanSetReduction": true,
    "sellerCanSetTime": true,
    "defaultReductionTime": null,
    "allowedReductionTimes": []
  }';

-- Update items table to support multiple price reduction times
ALTER TABLE items
  ADD COLUMN price_reduction_times JSONB DEFAULT '[]'; -- Array of {time: timestamp, price: number}
  -- Keep existing fields for backward compatibility
  -- reduced_price, enable_price_reduction, price_drop_time still exist

-- Create index for price reduction queries
CREATE INDEX idx_items_price_reduction_times ON items USING GIN(price_reduction_times);



-- ========================================
-- Migration: 20250107000000_support_guest_sellers.sql
-- ========================================
-- Migration to support guest/walk-in sellers who don't have the app
-- Allows org users to create seller records and item tags for sellers without accounts

-- Step 1: Add new columns for guest seller support
ALTER TABLE sellers
  ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN photo_id_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN photo_id_verified_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN photo_id_verified_at TIMESTAMPTZ;

-- Step 2: Migrate existing data
-- For existing sellers, auth_user_id = id (they have accounts)
-- is_guest = false (they have accounts)
UPDATE sellers SET auth_user_id = id, is_guest = false WHERE id IS NOT NULL;

-- Step 3: Drop the foreign key constraint on id
-- This allows id to be independent of auth.users
ALTER TABLE sellers DROP CONSTRAINT sellers_id_fkey;

-- Step 4: Create unique constraint on auth_user_id (only one seller per auth user)
CREATE UNIQUE INDEX idx_sellers_auth_user_id ON sellers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Step 5: Add indexes for faster lookups
CREATE INDEX idx_sellers_auth_user_id_lookup ON sellers(auth_user_id);
CREATE INDEX idx_sellers_is_guest ON sellers(is_guest);

-- Step 6: Make phone not unique (guest sellers might not have unique phones)
-- Actually, let's keep phone unique but allow NULL for guest sellers
-- Or we can make it unique only for non-guest sellers
-- For now, let's keep it unique but handle duplicates in application logic

-- Add comments explaining the structure
COMMENT ON COLUMN sellers.id IS 'Seller ID (UUID, primary key, independent of auth.users)';
COMMENT ON COLUMN sellers.auth_user_id IS 'Link to auth.users if seller has an authenticated account (nullable)';
COMMENT ON COLUMN sellers.is_guest IS 'True if seller does not have an authenticated account (walk-in seller)';



-- ========================================
-- Migration: 20250108000000_add_buyer_info_to_transactions.sql
-- ========================================
-- Migration to add buyer information to transactions
-- Records who purchased each item for contact and tracking purposes

ALTER TABLE transactions
  ADD COLUMN buyer_name TEXT,
  ADD COLUMN buyer_email TEXT,
  ADD COLUMN buyer_phone TEXT,
  ADD COLUMN buyer_contact_info JSONB DEFAULT '{}';

-- Add comments
COMMENT ON COLUMN transactions.buyer_name IS 'Name of the person who purchased the item';
COMMENT ON COLUMN transactions.buyer_email IS 'Email address of the buyer (optional)';
COMMENT ON COLUMN transactions.buyer_phone IS 'Phone number of the buyer (optional)';
COMMENT ON COLUMN transactions.buyer_contact_info IS 'Additional buyer contact information (JSON)';

-- Make payment_method nullable since we're not processing payments
ALTER TABLE transactions
  ALTER COLUMN payment_method DROP NOT NULL;



-- ========================================
-- Migration: 20250109000000_add_insert_policies_for_testing.sql
-- ========================================
-- Migration: Add INSERT policies for organizations, events, and admin_users
-- These policies allow authenticated users to create these entities
-- Note: In production, you may want to restrict these further or use service role key

-- Allow authenticated users to create organizations
-- In production, you might want to restrict this to specific roles or use a function
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow admins to create events for their organization
CREATE POLICY "Admins can create events for their organization"
  ON events FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Allow admins to create other admin_users in their organization
-- Note: This allows the first admin to be created via service role key,
-- then subsequent admins can be created by existing admins
CREATE POLICY "Admins can create admin_users in their organization"
  ON admin_users FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );



