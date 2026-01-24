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

