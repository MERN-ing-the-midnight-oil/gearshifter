-- Seller thermal receipt templates (POS) and organization sale behavior preferences.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sale_behavior_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organizations.sale_behavior_settings IS 'JSON: { notifySellerSmsOnSale, notifySellerPushOnSale, defaultSellerReceiptTemplateId }';

CREATE TABLE seller_receipt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  layout_type TEXT NOT NULL DEFAULT 'standard',
  width_mm DECIMAL(5,2) NOT NULL DEFAULT 58.0,
  height_mm DECIMAL(5,2) NOT NULL DEFAULT 80.0,
  tag_fields JSONB NOT NULL DEFAULT '[]',
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  category_ids UUID[],
  font_family TEXT DEFAULT 'Arial',
  font_size DECIMAL(4,2) DEFAULT 10.0,
  border_width DECIMAL(3,2) DEFAULT 0.5,
  qr_code_size DECIMAL(4,2) DEFAULT 14.0,
  qr_code_position TEXT DEFAULT 'bottom-right',
  qr_code_offset_x_mm DECIMAL(5,2) NOT NULL DEFAULT 0,
  qr_code_offset_y_mm DECIMAL(5,2) NOT NULL DEFAULT 0,
  qr_code_enabled BOOLEAN NOT NULL DEFAULT false,
  qr_code_data_fields JSONB DEFAULT '[]',
  qr_code_seller_access JSONB DEFAULT '[]',
  tag_orientation TEXT NOT NULL DEFAULT 'portrait'
    CHECK (tag_orientation IN ('portrait', 'landscape')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_seller_receipt_templates_org_id ON seller_receipt_templates(organization_id);
CREATE INDEX idx_seller_receipt_templates_active ON seller_receipt_templates(is_active);
CREATE INDEX idx_seller_receipt_templates_default ON seller_receipt_templates(is_default);

ALTER TABLE seller_receipt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view seller receipt templates for their organization"
  ON seller_receipt_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage seller receipt templates for their organization"
  ON seller_receipt_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_seller_receipt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seller_receipt_templates_updated_at
  BEFORE UPDATE ON seller_receipt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_receipt_templates_updated_at();
