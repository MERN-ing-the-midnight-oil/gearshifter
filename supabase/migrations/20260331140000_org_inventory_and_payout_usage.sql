-- Post-event / org-level inventory (not tied to a single swap event)
-- Used for items the org keeps after donation, abandonment, or unclaimed flows.

CREATE TABLE organization_inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  source_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  item_number_snapshot TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  size TEXT,
  origin_note TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold', 'disposed', 'donated_out')),
  listed_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  sold_at TIMESTAMPTZ,
  seller_of_record_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_org_inventory_unique_source_item
  ON organization_inventory_items (source_item_id)
  WHERE source_item_id IS NOT NULL;

CREATE INDEX idx_org_inventory_organization_id ON organization_inventory_items(organization_id);
CREATE INDEX idx_org_inventory_status ON organization_inventory_items(organization_id, status);

ALTER TABLE organization_inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can select org inventory"
  ON organization_inventory_items FOR SELECT
  USING (user_is_org_user_for_org(organization_id));

CREATE POLICY "Org users can insert org inventory"
  ON organization_inventory_items FOR INSERT
  WITH CHECK (
    user_is_org_user_for_org(organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Org users can update org inventory"
  ON organization_inventory_items FOR UPDATE
  USING (user_is_org_user_for_org(organization_id));

CREATE POLICY "Org users can delete org inventory"
  ON organization_inventory_items FOR DELETE
  USING (user_is_org_user_for_org(organization_id));
