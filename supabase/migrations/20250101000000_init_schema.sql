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

