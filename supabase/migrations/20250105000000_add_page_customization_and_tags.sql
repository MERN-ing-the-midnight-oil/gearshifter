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

