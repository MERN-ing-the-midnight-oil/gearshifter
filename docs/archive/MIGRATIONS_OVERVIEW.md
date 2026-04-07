# Database Migrations Overview

This document provides a comprehensive overview of all database migrations for the Gear Shifter application.

## Migration Order

Migrations are applied in chronological order (by timestamp). Here's the complete sequence:

1. **20250101000000_init_schema.sql** - Initial schema
2. **20250102000000_add_rls_policies.sql** - Row Level Security
3. **20250103000000_add_dynamic_fields.sql** - Dynamic field system
4. **20250104000000_add_swap_registration_fields.sql** - Swap registration system
5. **20250105000000_add_page_customization_and_tags.sql** - Page customization & tags
6. **20250106000000_add_price_reduction_settings.sql** - Price reduction controls
7. **20250107000000_support_guest_sellers.sql** - Guest seller support
8. **20250108000000_add_buyer_info_to_transactions.sql** - Buyer information
9. **20250109000000_add_insert_policies_for_testing.sql** - INSERT policies for testing

---

## Migration Details

### 1. Initial Schema (20250101000000_init_schema.sql)

**Purpose**: Creates the core database structure

**What it creates**:
- **Extensions**: UUID generation (`uuid-ossp`)
- **Enums**:
  - `event_status`: 'registration', 'checkin', 'shopping', 'pickup', 'closed'
  - `item_status`: 'pending', 'checked_in', 'for_sale', 'sold', 'picked_up', 'donated'
  - `payment_method`: 'cash', 'card', 'check'

- **Core Tables**:
  - `organizations` - Organizations running swap events
  - `events` - Swap events
  - `sellers` - Seller accounts (linked to auth.users)
  - `admin_users` - Organization administrators
  - `items` - Items for sale
  - `transactions` - Sales transactions
  - `payouts` - Seller payouts

- **Indexes**: Performance indexes on foreign keys and commonly queried columns

**Key Relationships**:
- Events belong to organizations
- Items belong to events and sellers
- Transactions link items, events, sellers, and admin users
- Admin users belong to organizations

---

### 2. Row Level Security Policies (20250102000000_add_rls_policies.sql)

**Purpose**: Implements data isolation and access control

**What it does**:
- Enables RLS on all tables
- Creates policies for:
  - **Organizations**: Admins can view their organization
  - **Events**: 
    - Admins can view events for their organization
    - Sellers can browse all events (read-only)
    - Sellers can view events they have items in
  - **Sellers**: Users can view/insert/update their own record
  - **Admin Users**: Admins can view other admins in their organization
  - **Items**: 
    - Sellers can view/insert/update their own items (before check-in)
    - Admins can view/update items for their organization's events
  - **Transactions**: 
    - Sellers can view their own transactions
    - Admins can view/insert transactions for their organization's events
  - **Payouts**: 
    - Sellers can view their own payouts
    - Admins can view/insert/update payouts for their organization's events

**Security Model**: Multi-tenant isolation - each organization's data is isolated from others

---

### 3. Dynamic Field System (20250103000000_add_dynamic_fields.sql)

**Purpose**: Allows organizations to define custom categories and item fields

**What it creates**:
- **Tables**:
  - `item_categories` - Organization-defined categories (supports nesting via `parent_id`)
  - `item_field_definitions` - Organization-defined fields for items

- **Enum**: `field_type` - 'text', 'textarea', 'number', 'decimal', 'boolean', 'dropdown', 'date', 'time'

- **Updates**:
  - `sellers.email` - Made required (NOT NULL)
  - `items` - Added `custom_fields` (JSONB) and `category_id` (UUID)

- **RLS Policies**: Admins manage, sellers can view for their events

**Features**:
- Organizations can create custom item fields
- Supports nested categories
- Fields can be price fields, price reduction fields
- Dropdown fields with custom options

---

### 4. Swap Registration Fields (20250104000000_add_swap_registration_fields.sql)

**Purpose**: Custom fields for seller swap registration (separate from app signup)

**What it creates**:
- **Tables**:
  - `swap_registration_field_definitions` - Custom fields for registration
  - `seller_swap_registrations` - Tracks seller registrations for events

- **Updates to `sellers`**:
  - `profile_photo_url`
  - `address`, `address_line2`, `city`, `state`, `zip_code`, `country`
  - `marketing_opt_in`
  - `contact_info` (JSONB)

- **Features**:
  - Suggested fields (profile_photo, address, contact_info, marketing_opt_in)
  - Optional fields (sellers can skip even if marked required)
  - Auto-updates `updated_at` timestamp via trigger

**Use Case**: Organizations can collect additional information when sellers register for a specific swap event

---

### 5. Page Customization & Tags (20250105000000_add_page_customization_and_tags.sql)

**Purpose**: Customize registration pages and create printable gear tag templates

**What it creates**:
- **Tables**:
  - `swap_registration_page_settings` - Customize registration page layout
  - `gear_tag_templates` - Printable tag templates for items

- **Features**:
  - **Page Settings**:
    - Custom page title, description, welcome message
    - Field groups (organize fields into sections)
    - Custom styles
  
  - **Tag Templates**:
    - Multiple templates per organization
    - Customizable layout (standard, compact, detailed)
    - Configurable tag size (width/height in mm)
    - Field positioning on tags
    - QR code configuration (size, position, data fields)
    - Category-specific templates
    - Default template support

- **Triggers**: Auto-update `updated_at` timestamps

---

### 6. Price Reduction Settings (20250106000000_add_price_reduction_settings.sql)

**Purpose**: Organization-level control over price reduction behavior

**What it adds**:
- **To `organizations`**:
  - `price_reduction_settings` (JSONB) with:
    - `sellerCanSetReduction` - Can sellers set price reductions?
    - `sellerCanSetTime` - Can sellers set reduction time?
    - `defaultReductionTime` - Default time for reductions
    - `allowedReductionTimes` - Allowed time options

- **To `items`**:
  - `price_reduction_times` (JSONB array) - Multiple reduction schedules
  - Format: `[{time: timestamp, price: number, isPercentage: boolean}]`

**Use Case**: Organizations can control whether sellers can set automatic price reductions and when they occur

---

### 7. Guest Seller Support (20250107000000_support_guest_sellers.sql)

**Purpose**: Support walk-in sellers who don't have the app

**What it changes**:
- **To `sellers`**:
  - `auth_user_id` (UUID, nullable) - Links to auth.users if seller has account
  - `is_guest` (BOOLEAN) - True for walk-in sellers
  - `photo_id_verified` (BOOLEAN) - ID verification status
  - `photo_id_verified_by` (UUID) - Admin who verified ID
  - `photo_id_verified_at` (TIMESTAMPTZ) - When ID was verified

- **Structural Changes**:
  - Removes foreign key constraint on `sellers.id` (was `REFERENCES auth.users`)
  - Makes `id` independent of auth.users
  - Adds unique constraint on `auth_user_id`
  - Migrates existing sellers: sets `auth_user_id = id`, `is_guest = false`

**Use Case**: Org users can create seller records and print tags for sellers who don't have accounts

---

### 8. Buyer Information (20250108000000_add_buyer_info_to_transactions.sql)

**Purpose**: Track who purchased each item

**What it adds**:
- **To `transactions`**:
  - `buyer_name` (TEXT)
  - `buyer_email` (TEXT)
  - `buyer_phone` (TEXT)
  - `buyer_contact_info` (JSONB)
  - Makes `payment_method` nullable (not processing payments yet)

**Use Case**: Record buyer contact information for follow-up, returns, or customer service

---

### 9. INSERT Policies for Testing (20250109000000_add_insert_policies_for_testing.sql)

**Purpose**: Allow INSERT operations for testing and initial setup

**What it adds**:
- **Organizations**: Authenticated users can create organizations
- **Events**: Admins can create events for their organization
- **Admin Users**: Admins can create other admin users in their organization

**Note**: In production, you may want to restrict organization creation further or use service role key for initial setup

---

## Database Schema Summary

### Core Tables
- `organizations` - Organizations
- `events` - Swap events
- `sellers` - Seller accounts (supports guest sellers)
- `admin_users` - Organization administrators
- `items` - Items for sale
- `transactions` - Sales transactions
- `payouts` - Seller payouts

### Configuration Tables
- `item_categories` - Organization-defined categories
- `item_field_definitions` - Organization-defined item fields
- `swap_registration_field_definitions` - Registration fields
- `swap_registration_page_settings` - Registration page customization
- `gear_tag_templates` - Printable tag templates
- `seller_swap_registrations` - Seller event registrations

### Key Features
- ✅ Multi-tenant isolation (RLS)
- ✅ Dynamic field system
- ✅ Guest seller support
- ✅ Custom registration forms
- ✅ Printable tag templates
- ✅ Price reduction controls
- ✅ Buyer tracking

---

## Applying Migrations

### Option 1: Supabase Dashboard
1. Go to SQL Editor
2. Run each migration file in order
3. Verify tables are created

### Option 2: Supabase CLI
```bash
supabase db push
```

### Option 3: Manual Application
Copy and paste each migration's SQL into your database client

---

## Migration Status

**Current Status**: ⚠️ **Not Applied** - Migrations need to be applied to your Supabase instance

**To Apply**: See `APPLY_MIGRATIONS.md` for detailed instructions

---

## Notes

- Migrations are idempotent where possible (using `IF NOT EXISTS`)
- Some migrations modify existing tables (ALTER TABLE)
- RLS policies are cumulative - each migration adds more policies
- The last migration (INSERT policies) is specifically for testing/development






