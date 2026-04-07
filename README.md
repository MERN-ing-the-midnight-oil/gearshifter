# Gear Swap - Architecture Overview

A full-stack consignment management system for gear swaps, built with React Native (Expo), Supabase, and TypeScript.

## Project Vision

Free tool for local non-profits to run gear swap events (bike swaps, ski swaps, etc.). Future SaaS product for organizations nationwide.

## Payment Handling Philosophy

**Important**: This app does NOT process card payments or sync with Square. Organizations use their existing payment systems (Square, cash registers, checks, etc.). The app simply:

- Tracks which items have been **sold** (status = 'sold')
- Tracks which items have been **marked as paid** (`paid_at` on items, with optional **check number** stored on **`payouts`** rows when staff records payment at pickup)
- Provides **CSV export** on the event Reports screen (consignee-level rows for accounting)
- Supports **post-event organization inventory** (items kept after the swap—storage, resale, donations—not tied to a single event)

This keeps the app simple, flexible, and compatible with any payment workflow organizations already have in place. Payment processing integration (Stripe/Square) is available as an optional stretch goal for organizations that want built-in payment handling.

## Tech Stack

- **Frontend**: React Native (Expo) + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Real-time + Storage)
- **Connectivity**: The product assumes **reliable Wi‑Fi or cellular data** at events (no offline queue in the apps today).
- **Payments**: Not handled by app (organizations use existing systems)
- **Sale alerts**: **Expo push notifications** to sellers when an item sells (Supabase Edge Function `notify-seller-on-sale` + Expo Push API). SMS/email to sellers is a **stretch goal** (see Future Enhancements).
- **Monorepo**: Yarn Workspaces
- **Build & release**: Expo Application Services (EAS); configuration in root `eas.json`
- **AI Development**: Cursor IDE

## Repository Structure

```
/gearshifter
├── package.json                    # Root workspace config
├── eas.json                        # EAS Build configuration
├── tsconfig.json                   # Shared TypeScript config
├── .gitignore
├── README.md                       # This file
│
├── /supabase                       # Supabase project files
│   ├── /migrations                 # Database migration files (see folder for full list)
│   │   ├── 20250101*               # Init schema
│   │   ├── 20250102*               # RLS policies
│   │   ├── 20250103*               # Dynamic fields
│   │   ├── 20250104*               # Swap registration fields
│   │   ├── 20250105*               # Page customization, gear tags
│   │   ├── 20250106*               # Price reduction settings
│   │   ├── 20250107*               # Guest sellers
│   │   ├── 20250108*               # Buyer info on transactions
│   │   ├── 20250110* ... 20250131* # RLS fixes, org creation, user roles, optional fields
│   │   ├── 20250201* ... 20250204* # Commission optional, paid_at, categories, event status
│   │   ├── 20250226*               # donation_declared_at on events
│   │   ├── 20250318*               # pickup window, gear drop-off on events
│   │   ├── 20260319* … 20260320*   # seller items RLS, labels, delete pending RPC, status enum
│   │   ├── 20260331*               # seller expo push tokens; org post-event inventory table
│   │   └── (see supabase/migrations for full list)
│   ├── /functions                  # Supabase Edge Functions (e.g. create-seller, notify-seller-on-sale)
│   ├── config.toml                 # Supabase config
│   └── seed.sql                    # Test data for development
│
└── /packages
    ├── /shared                     # Shared code (~70% of codebase)
    ├── /seller-app                 # Consumer mobile app
    ├── /organizer-app              # Admin tablet app
    └── /web-dashboard (future)     # Desktop web interface
```

---

## Package: /shared

**Purpose**: Reusable code shared across seller and organizer apps.

```
/packages/shared
├── package.json
├── tsconfig.json
├── index.ts                        # Main export file
│
├── /api                            # Supabase client & API calls
│   ├── supabase.ts                 # Supabase client initialization
│   ├── auth.ts                     # Auth helpers (login, logout, password reset, session)
│   ├── items.ts                    # Item CRUD operations
│   ├── events.ts                   # Event queries
│   ├── sellers.ts                  # Seller operations
│   ├── transactions.ts             # Transaction operations
│   ├── payouts.ts                  # Mark paid (inserts payouts + sets paid_at)
│   ├── eventExport.ts              # CSV export for event reports
│   ├── organizationInventory.ts    # Org-level post-event inventory
│   ├── organizations.ts            # Organization settings
│   ├── categories.ts               # Item categories
│   ├── fieldDefinitions.ts         # Dynamic item fields
│   ├── swapRegistrationFields.ts   # Registration form fields
│   ├── sellerSwapRegistrations.ts  # Seller registrations per event
│   ├── swapRegistrationPageSettings.ts
│   └── gearTagTemplates.ts         # Label/tag templates
│
├── /types                          # TypeScript definitions
│   ├── supabase.ts                 # Auto-generated from DB schema
│   ├── models.ts                   # Business logic types
│   └── index.ts
│
├── /components                     # Reusable UI components (placeholder; index.ts only)
│   └── index.ts
│
├── /hooks                          # Custom React hooks
│   ├── useAuth.ts                  # Auth state management
│   ├── useItems.ts                 # Fetch/manage items
│   ├── useEvents.ts                # Fetch/manage events
│   ├── useTransactions.ts          # Transaction operations
│   ├── useOrganizer.ts             # Organizer context
│   ├── useAdminUser.ts             # Admin user & permissions
│   ├── useSellerSaleNotifications.ts
│   └── index.ts
│
├── /utils                          # Helper functions
│   ├── qrCode.ts                   # QR code generation/parsing
│   ├── priceReduction.ts           # Time-based price reduction logic
│   ├── formatters.ts               # Display/formatter helpers
│   ├── itemDisplay.ts              # Seller-facing titles & status labels (e.g. pre-registered)
│   └── index.ts
│
├── /constants                      # App-wide constants
│   ├── statuses.ts                 # Item/event status enums (active|closed)
│   ├── qrCodeFields.ts             # QR code field definitions
│   ├── tagSizes.ts                 # Label/tag size options
│   ├── config.ts                   # App config
│   ├── categories.ts               # Category constants
│   └── index.ts
│
└── /context                        # React context providers (placeholder; index.ts only)
    └── index.ts
```

---

## Package: /seller-app

**Purpose**: Mobile app for sellers to pre-register items (before check-in) and track sales.

**Terminology**: **Pre-register** / **Pre-registered** = item submitted in-app before staff check-in (database status `pending`). **Register for this event** = swap/seller signup (org registration form)—not the same as item pre-registration. Keeps language for unchecked-in inventory distinct from org-confirmed inventory.

**Target Device**: iOS/Android phones (portrait mode)

**User Type**: General public, one-time users

```
/packages/seller-app
├── package.json
├── app.json                        # Expo config
├── tsconfig.json
├── .env                            # Environment variables
│
├── /app                            # Expo Router file-based routing
│   ├── _layout.tsx                 # Root layout
│   │
│   ├── /(auth)                     # Authentication screens
│   │   ├── _layout.tsx             # Auth layout (stack navigation)
│   │   ├── login.tsx               # Phone number input
│   │   └── signup.tsx              # First/last name, email (seller registration)
│   │
│   ├── /(tabs)                     # Main app tabs (bottom nav)
│   │   ├── _layout.tsx             # Tab layout
│   │   ├── index.tsx               # Home (Event View)
│   │   ├── events.tsx              # Browse upcoming events
│   │   ├── items.tsx               # My items (all events)
│   │   ├── notifications.tsx       # Notification history
│   │   └── profile.tsx             # User profile settings
│   │
│   └── /event/[id]                 # Event-specific screens
│       ├── index.tsx               # Event details
│       ├── add-item.tsx            # Pre-register item for event
│       └── register.tsx             # Seller registration for event
│
├── /components                     # App-specific components (minimal)
│   └── ...
│
├── /assets                         # Images, etc.
│   └── favicon.png
│
└── /lib                            # App-specific utilities
    └── theme.ts
```

---

## Package: /organizer-app

**Purpose**: Tablet app for event staff to manage check-in, sales, and pickup.

**Target Device**: iOS/Android tablets (landscape preferred)

**User Type**: Organization admins and volunteers

```
/packages/organizer-app
├── package.json
├── app.json                        # Expo config
├── tsconfig.json
├── .env
│
├── /app                            # Expo Router file-based routing
│   ├── _layout.tsx                 # Root layout
│   ├── index.tsx                   # Entry / redirect
│   │
│   ├── /(auth)                     # Admin authentication
│   │   ├── _layout.tsx
│   │   ├── login.tsx               # Email/password login
│   │   ├── signup.tsx              # Org admin signup
│   │   ├── forgot-password.tsx     # Request password reset email
│   │   └── reset-password.tsx      # Set new password (after email link / PASSWORD_RECOVERY)
│   │
│   ├── /(dashboard)                # Event selection & org settings
│   │   ├── _layout.tsx             # Dashboard layout (stack)
│   │   ├── index.tsx               # Event list & org overview
│   │   ├── create-event.tsx        # Create event
│   │   ├── categories.tsx          # Item categories
│   │   ├── commission-rates.tsx    # Commission rate settings
│   │   ├── field-definitions.tsx   # Item field definitions
│   │   ├── gear-tags.tsx           # Gear tag templates
│   │   ├── price-reduction-settings.tsx
│   │   ├── swap-registration-fields.tsx  # Seller registration form
│   │   ├── post-event-inventory.tsx # Org inventory after a swap
│   │   └── users.tsx               # Team members
│   │
│   ├── /(event)                    # Event-specific workflows
│   │   ├── _layout.tsx             # Event context wrapper
│   │   ├── manage.tsx              # Manage event details
│   │   ├── stations.tsx            # Choose station (permission-based)
│   │   ├── /check-in               # Check-in station
│   │   │   ├── index.tsx           # Scan seller QR
│   │   │   ├── register-seller.tsx # Register seller at event
│   │   │   ├── register-guest.tsx  # Guest seller registration
│   │   │   ├── add-item.tsx        # Add item for seller
│   │   │   ├── item-details.tsx    # View/edit item at check-in
│   │   │   └── review-items.tsx    # Review items before check-in
│   │   ├── /pos                    # Point of sale station
│   │   │   └── index.tsx           # Scan item QR, confirm sale
│   │   ├── /pickup                 # Pickup station
│   │   │   └── index.tsx           # Scan seller QR, mark paid, check #, add to org inventory
│   │   └── /reports                # Event reports
│   │       └── index.tsx           # Summary, donations closure, CSV export
│
├── /components                     # Organizer-specific components
│   ├── PrinterConnection.*         # Printer connection UI
│   ├── TagPreviewMockup.tsx        # Label/tag preview
│   ├── /LabelPrinter               # Label printing components
│   │   └── LabelTemplate.tsx
│   └── ...
│
├── /hardware                       # Hardware integration
│   ├── printer.ts                  # Zebra/Brother printer SDK
│   ├── tagPrinter.ts               # Tag printing helpers
│   ├── usePrinter.ts               # Printer connection hook
│   └── index.ts
│
└── /lib
    └── theme.ts
```

---

## Supabase Database Schema

**Key Tables** (detailed migrations in `/supabase/migrations`)

### Core Tables

```
organizations
├── id (uuid, pk)
├── name (text)
├── slug (text, unique) - for multi-tenancy
├── commission_rate (decimal, nullable) - optional, for reporting only
├── vendor_commission_rate (decimal, nullable) - optional, for reporting only
└── created_at (timestamptz)

organization_inventory_items (org-level stock after swaps — not per-event)
├── organization_id (uuid, fk → organizations)
├── optional source_event_id / source_item_id — when promoted from an event item
├── seller_of_record_id (nullable) — original consignor when promoted
├── status — in_stock | sold | disposed | donated_out
└── … description, category, pricing fields (see migration 20260331140000)

events
├── id (uuid, pk)
├── organization_id (uuid, fk → organizations)
├── name (text) - "Spring 2025 Bike Swap"
├── event_date (date)
├── registration_open_date (date)
├── registration_close_date (date)
├── shop_open_time (timestamptz)
├── shop_close_time (timestamptz)
├── price_drop_time (timestamptz) - when reduced prices activate
├── status (enum) - active|closed
├── items_locked (boolean) - when true, sellers cannot add/edit items
├── donation_declared_at (timestamptz, nullable) - when set, event closed for donations
├── pickup_start_time / pickup_end_time (timestamptz, nullable) - seller pickup window for unsold gear
├── gear_drop_off_* / gear_drop_off_place - optional drop-off window and location
└── settings (jsonb) - categories, donation options, etc.

sellers
├── id (uuid, pk) - independent UUID (may differ from auth user id)
├── auth_user_id (uuid, nullable, fk → auth.users) - null for guest/walk-in sellers
├── first_name (text)
├── last_name (text)
├── phone (text)
├── email (text)
├── qr_code (text, unique) - generated on registration
├── expo_push_token (text, nullable) - for sale push notifications
└── created_at (timestamptz)

admin_users (organization staff — two **roles**; see below)
├── id (uuid, pk, fk → auth.users)
├── organization_id (uuid, fk → organizations)
├── first_name (text)
├── last_name (text)
├── email (text)
├── role (enum) - **admin** | **volunteer** (who can sign in; see “Organization users” below)
├── is_org_admin (boolean) - full org control (team management, all stations)
├── permissions (jsonb) - {stations: {check_in, pos, pickup, reports}}
└── created_at (timestamptz)

items
├── id (uuid, pk)
├── event_id (uuid, fk → events)
├── seller_id (uuid, fk → sellers)
├── item_number (text, unique) - "SG2025-001234"
├── category (text)
├── description (text)
├── size (text, nullable)
├── original_price (decimal)
├── reduced_price (decimal, nullable)
├── enable_price_reduction (boolean)
├── donate_if_unsold (boolean)
├── status (enum) - core flow: pending → checked_in → for_sale → sold → picked_up; donation/closure: donated; see “Item status (edge cases)” below
├── qr_code (text, unique)
├── checked_in_at (timestamptz)
├── sold_at (timestamptz)
├── sold_price (decimal)
├── paid_at (timestamptz, nullable) - when item was marked as paid
└── created_at (timestamptz)

transactions
├── id (uuid, pk)
├── event_id (uuid, fk → events)
├── item_id (uuid, fk → items)
├── seller_id (uuid, fk → sellers)
├── sold_price (decimal) - price item was sold for
├── commission_amount / seller_amount (decimal) - for reporting (org commission)
├── processed_by (uuid, fk → admin_users)
├── sold_at (timestamptz)
├── buyer_name (text, nullable)
├── buyer_email (text, nullable)
├── buyer_phone (text, nullable)
└── buyer_contact_info (jsonb, nullable)

payouts — one row per payout when staff marks sold items paid at pickup
├── id (uuid, pk)
├── event_id (uuid, fk → events)
├── seller_id (uuid, fk → sellers)
├── total_amount (decimal) — sum of transaction seller_amount for included items
├── check_number (text, nullable) — optional, e.g. check written to consignee
├── issued_by (uuid, fk → admin_users)
├── signed_by_seller (boolean)
├── paid_at (timestamptz)
└── items (uuid[]) — item IDs included in this payout
Note: Marking paid updates both `items.paid_at` and inserts a `payouts` row (pickup permission required).
```

### Item status (edge cases)

Besides the main flow above, `item_status` includes additional values used at the edges of the swap lifecycle and operations:

- **donated_abandoned** — Unsold items left after donation/closure rules apply (policy-dependent).
- **unclaimed** — Not picked up in the expected window when the event is closed out.
- **withdrawn** — Seller pulled the item before or during the event (per org policy).
- **lost** / **damaged** — Inventory exceptions after check-in.

Regenerate `packages/shared/types/supabase.ts` after migrations (`supabase gen types typescript --local`) so enums stay in sync.

### Organization users (two roles)

Org accounts in `admin_users` are signed-in **staff** for the organizer app. There are two complementary notions:

1. **`role`**: **`admin`** vs **`volunteer`** — who this login represents day-to-day (e.g. volunteer shifts). Both use the same app; capabilities are driven by `permissions` and `is_org_admin`.
2. **`is_org_admin`**: When **true**, the user can manage the team (create volunteer accounts, full org settings). Volunteers typically have `is_org_admin: false` and station `permissions` limited by an org admin.

Station access is always gated by `permissions.stations` (check-in, POS, pickup, reports) unless `is_org_admin` grants full access.

### Row Level Security (RLS)

Every table has RLS policies to ensure:
- Sellers only see their own data
- Admins see data for their organization's events
- Proper isolation between organizations

---

## Data Flow Examples

### 1. Seller Pre-registers an Item

```
Seller App (event/[id]/add-item.tsx)
  → Shared API (items.ts → createItem())  # status pending = pre-registered until check-in
    → Supabase (INSERT into items)
      → Real-time broadcast
        → Organizer App (event dashboard updates)
```

### 2. Item Sold at POS

```
Organizer App (pos/index.tsx)
  → Shared API (transactions.ts → recordSale())
    → Supabase (INSERT into transactions, UPDATE items.status = 'sold')
      → Edge Function (notify-seller-on-sale) with staff JWT
        → Expo Push API (seller’s registered expo_push_token on sellers row)
          → Seller App (push notification + Notifications tab lists the sale)
Note: Organization processes actual payment through their existing system. Deploy the function and set secrets: EXPO_ACCESS_TOKEN (Expo), plus standard Supabase keys.
```

### 3. Item Marked as Paid

```
Organizer App (pickup/index.tsx)
  → Shared API (payouts.ts → markItemAsPaid / markSellerItemsAsPaid)
    → Supabase (INSERT payouts with optional check_number; UPDATE items.paid_at)
      → Real-time broadcast
        → Seller App (item shows paid)
Note: Organization issues payment (check/cash/etc.) outside the app; staff records it here.
```

---


## Development Workflow

### Initial Setup

```bash
# Clone repo
git clone https://github.com/yourorg/gearshifter.git
cd gearshifter

# Install dependencies
yarn install

# Start Supabase locally
supabase start

# Generate TypeScript types from database
supabase gen types typescript --local > packages/shared/types/supabase.ts
```

### Daily Development

```bash
# Terminal 1: Run seller app
yarn seller:start

# Terminal 2: Run organizer app
yarn org:start

# Terminal 3: Watch for Supabase changes
supabase db diff --watch
```

### Database Changes

```bash
# Make changes in Supabase Studio UI (localhost:54323)
# Then generate migration file:
supabase db diff -f add_vendor_support

# Apply migration locally:
supabase db reset

# Regenerate types:
supabase gen types typescript --local > packages/shared/types/supabase.ts

# Commit migration:
git add supabase/migrations/*
git commit -m "Add vendor support"
```

### Deployment

```bash
# Deploy database migrations
supabase db push --project-ref prod-project-id

# Deploy Edge Functions (e.g. sale push notification)
supabase functions deploy notify-seller-on-sale
# Set Expo access token for push (Expo dashboard → Access tokens)
supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token --project-ref prod-project-id

# Build and deploy apps (EAS Build configured in eas.json)
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to app stores
eas submit --platform ios --latest
eas submit --platform android --latest
```

---

## Key Design Decisions

### 1. Two Separate Apps
- **Seller App**: Simple, public-facing, phone-optimized
- **Organizer App**: Complex, admin-only, tablet-optimized
- **Rationale**: Clear separation, better UX, smaller bundles, enhanced security

### 2. Supabase Backend
- PostgreSQL for ACID transactions (critical for inventory and sales data)
- Real-time for live inventory updates across stations
- Row-level security for multi-tenant isolation
- **Rationale**: Scalable, predictable costs, easy migration path

### 2a. Payment Handling Philosophy
- **No built-in payment processing**: Organizations use their existing payment systems (Square, cash, checks, etc.)
- **Simple payment tracking**: App tracks which items are sold and which have been marked as "paid"
- **Rationale**: Keeps app simple, flexible, and compatible with any payment system organizations already use

### 3. Monorepo Structure
- 70% code shared between apps
- 30% app-specific features
- **Rationale**: DRY principle, type safety, easier refactoring

### 4. Connectivity at events
- Stations assume **live** Supabase access for check-in, POS, and pickup.
- **Rationale**: Simpler implementation; many venues provide usable Wi‑Fi or cellular data. If you later need offline queues, that would be a separate initiative.

### 5. QR Code Strategy
- Seller QR: Encodes seller ID (on phone)
- Item QR: Encodes item ID (on printed label)
- **Rationale**: Fast scanning; organizer devices may cache lookups where the UI already loads data.

### 6. Price Reduction Timing
- Lazy evaluation (calculated at POS scan time)
- No background jobs needed
- **Rationale**: Simpler, no cron jobs, always accurate

### 7. Multi-Tenancy
- Organization-level isolation
- Each org can have multiple events
- **Rationale**: SaaS-ready, scalable business model

---

## Future Enhancements

### Phase 2
- [ ] Photo uploads for items
- [ ] Web dashboard (Next.js)
- [ ] Enhanced payment tracking features

### Phase 2.5 (Stretch Goals)
- [ ] SMS / email seller notifications (Twilio, Resend, or Supabase templates) — push is implemented first
- [ ] Stripe/Square payment integration (optional - for orgs that want built-in processing)

### Phase 3
- [ ] White-label customization
- [ ] Self-service organization signup
- [ ] Analytics dashboard (revenue, trends)
- [ ] Automated email marketing

### Phase 4
- [ ] AI-powered item categorization
- [ ] Dynamic pricing suggestions
- [ ] Fraud detection
- [ ] Multi-language support

---

## Org Admin Dashboard (Organizer App)

Outline of what an organization user sees and can do from the dashboard. **Organization users** are rows in `admin_users` with two complementary fields:

- **`role`**: **`admin`** or **`volunteer`** — reflects how the account is labeled (e.g. staff vs volunteer).
- **`is_org_admin`**: **`true`** for org owners/managers who can manage **Team Members** and all settings; **`false`** for typical volunteer logins, which rely on per-station `permissions`.

### What the org admin sees

- **Header**: Signed-in user (name/email), role (**admin** / **volunteer**), **Sign Out**
- **Org context**: "Org Dashboard" title and organization name
- **Org summary** (when linked): Commission rate and vendor commission rate (or "Not set")
- **Events section**: List of events for the org, each showing:
  - Event name, date, status (Active / Closed)
  - Shop hours and registration window (if set)
  - **Manage Event** and **Delete** (per event)
- **Item configuration** (when org is linked): Shortcuts to:
  - Categories
  - Item Fields
  - Seller Registration Form
  - Gear Tags
  - Price Reductions
  - Commission Rates
- **Team management** (admins only): Shortcut to **Team Members** (manage org users and create volunteer accounts)
- **Empty state**: "No Events Yet" with **+ Create New [Org] Event** when there are no events

If the account has no organization linked, they see a "No organization linked" card with instructions to link via Supabase/script or sign out.

### What the org admin can do from the dashboard

| From dashboard | Action |
|----------------|--------|
| **Events** | **+ Create New Event** → create-event flow |
| **Event card** | **Manage Event** → event manage screen; **Delete** → delete event (with confirm) |
| **Item configuration** | Open **Categories**, **Item Fields**, **Seller Registration Form**, **Gear Tags**, **Price Reductions**, or **Commission Rates** to configure org-wide settings |
| **Team** (admins) | Open **Team Members** to manage users and create volunteer accounts |
| **Header** | **Sign Out** |

### From “Manage Event” (reached from dashboard)

On the event manage screen the org admin can:

- View/edit event details (name, status, event date, shop open/close, items locked)
- Open **Stations** (assign devices to check-in, POS, pickup)
- Open **Open station** → choose check-in, POS, or pickup for that device
- See registered sellers count and list
- Link to **Manage team members** (dashboard users)
- **Back** to dashboard

Event-level flows (from manage or stations): **Check-in** (register guests, scan seller items), **POS** (sales), **Pickup** (seller pickup), **Reports** (sales/payout reports).

---

## Seller app home & tabs

Outline of what a seller sees and can do from the seller app (tab-based).

### What the seller sees

- **Tab bar**: Home | Events | Items | Notifications | Profile

**Home tab (Event View)**

- **Header**: "Event View" with **Current Event** dropdown (lists upcoming events)
- **Event card** (when an event is selected): date, shop start/end, gear drop-off window/place (if set), seller pickup window for unsold gear (if set)
- **Your items for this event**: list with per-item status (e.g. **Pre-registered** while `pending`), price/share estimates, edit/remove while pre-registered
- **Pre-register an item to sell**: primary CTA to open the add-item flow for the selected event

**Events tab**

- **Header**: "Upcoming Events" / "Browse and join gear swap events"
- List of upcoming events: name, org, status badge, date, shop hours, commission; registration open/close copy; **View Details & Pre-register Items** or **View Details**
- Empty: "No Upcoming Events"

**Items tab**

- **My Items**: All consigned items with status pills (e.g. **Pre-registered** before check-in); edit/remove while pre-registered

**Notifications tab**

- **Sale alerts**: List of your completed sales (from `transactions`) with item label/number, sale price, your estimated proceeds, and time. **Push notifications** fire when staff record a sale at POS (requires physical device, notification permission, and EAS **project ID** in seller `app.json` for Expo push tokens).

**Profile tab**

- **Profile** title and signed-in email/phone
- **Account**: User ID
- **Sign Out**

### What the seller can do from the tabs

| From | Action |
|------|--------|
| **Home (Event View)** | Pick **Current Event**; review timing; **Pre-register new item** → `add-item` for that event; open items from **Your items for this event** (edit/remove when pre-registered) |
| **Events** | Tap event → **Event detail** (`/event/[id]`) |
| **Items** | Cross-event list of consigned items with status |
| **Notifications** | Review past sale alerts (and grant push permission on device for live alerts) |
| **Profile** | **Sign Out** |

### From Event detail (reached from Events tab)

- **Event details**: Date, shop hours, commission, vendor commission, registration open/close, price drop time (if set)
- **Registration**: Opens / closes dates; "Registration is currently open" or "Registration opens soon" / "Registration has closed"
- When **registration is open** and user is signed in: **Register for This Event** → seller registration form; **Pre-register items** → add items to this event

### From event-level flows (after selecting an event)

| Screen | Purpose |
|--------|--------|
| **Register** | Complete seller registration form for the event (org-defined fields) |
| **Pre-register item** (`add-item`) | Add a consignment item (category, org-defined item fields, price, etc.); shows as pre-registered until check-in |

---

## Environment Variables

### Shared
```bash
EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Seller App
```bash
EXPO_PUBLIC_APP_VARIANT=seller
EXPO_PUBLIC_ENABLE_NOTIFICATIONS=true   # set to false to skip push registration
```

Set **`expo.extra.eas.projectId`** in `packages/seller-app/app.json` to your EAS project UUID (from `eas init` / `eas project:info`) so Expo can issue push tokens.

### Supabase (Edge Functions — deployed project)

For **`notify-seller-on-sale`**, set secrets (Dashboard → Edge Functions → Secrets or CLI):

```bash
# Expo — Project settings → Access tokens → Generate (for Expo Push API)
EXPO_ACCESS_TOKEN=your-expo-access-token
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions when deployed on Supabase.

### Organizer App
```bash
EXPO_PUBLIC_APP_VARIANT=organizer
EXPO_PUBLIC_ENABLE_PRINTER=true
EXPO_PUBLIC_PRINTER_TYPE=zebra
```

---

## Related Documentation

- [APP_DESCRIPTION.md](./APP_DESCRIPTION.md) - Application architecture and features
- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) - Step-by-step development plan
- [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md) - Event status refactor (active/closed) and seller app mapping notes

---

## Contributing

This is currently a solo project built with AI assistance (Cursor IDE). 

When ready to open source:
1. Follow Conventional Commits
2. Run TypeScript checks before committing
3. Keep shared package pure (no app-specific code)
4. Update migrations with `supabase db diff`

---

## License

TBD (likely MIT for open source version, proprietary for SaaS)

---

## Contact

Built by [Your Name] for Shifting Gears and the gear swap community.

Questions? [your.email@example.com]