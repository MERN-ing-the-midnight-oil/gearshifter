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










