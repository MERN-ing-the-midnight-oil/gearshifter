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








