# Gear Swap - Architecture Overview

A full-stack consignment management system for gear swaps, built with React Native (Expo), Supabase, and TypeScript.

## Project Vision

Free tool for local non-profits to run gear swap events (bike swaps, ski swaps, etc.). Future SaaS product for organizations nationwide.

## Tech Stack

- **Frontend**: React Native (Expo) + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Real-time + Storage)
- **Offline**: WatermelonDB (syncs with Supabase)
- **Payments**: Stripe/Square (future)
- **Notifications**: Twilio (SMS) + Resend (email)
- **Monorepo**: Yarn Workspaces
- **AI Development**: Cursor IDE

## Repository Structure

```
/gear-swap-monorepo
├── package.json                    # Root workspace config
├── tsconfig.json                   # Shared TypeScript config
├── .gitignore
├── README.md                       # This file
│
├── /supabase                       # Supabase project files
│   ├── /migrations                 # Database migration files
│   │   ├── 20250101_init_schema.sql
│   │   ├── 20250102_add_rls_policies.sql
│   │   └── 20250103_add_transactions.sql
│   ├── /functions                  # Edge Functions (serverless)
│   │   ├── /send-notification
│   │   ├── /process-payout
│   │   └── /generate-reports
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
│   ├── auth.ts                     # Auth helpers (login, logout, session)
│   ├── items.ts                    # Item CRUD operations
│   ├── events.ts                   # Event queries
│   ├── sellers.ts                  # Seller operations
│   ├── transactions.ts             # Transaction operations
│   └── storage.ts                  # File upload helpers
│
├── /types                          # TypeScript definitions
│   ├── supabase.ts                 # Auto-generated from DB schema
│   ├── database.ts                 # Custom database types
│   ├── models.ts                   # Business logic types
│   └── index.ts
│
├── /components                     # Reusable UI components
│   ├── /ItemCard                   # Display item info
│   │   ├── ItemCard.tsx
│   │   └── ItemCard.styles.ts
│   ├── /QRCodeScanner              # QR scanning component
│   │   ├── QRCodeScanner.tsx
│   │   └── QRCodeScanner.styles.ts
│   ├── /QRCodeDisplay              # Show QR code
│   ├── /CategoryPicker             # Select item category
│   ├── /PricePicker                # Input price with validation
│   ├── /Button                     # Styled button
│   ├── /Input                      # Styled text input
│   ├── /Card                       # Container component
│   └── index.ts
│
├── /hooks                          # Custom React hooks
│   ├── useAuth.ts                  # Auth state management
│   ├── useItems.ts                 # Fetch/manage items
│   ├── useEvents.ts                # Fetch/manage events
│   ├── useRealtime.ts              # Real-time subscriptions
│   ├── useNotifications.ts         # Push notification setup
│   ├── useOffline.ts               # Offline sync status
│   └── index.ts
│
├── /utils                          # Helper functions
│   ├── formatters.ts               # Format currency, dates, etc.
│   ├── validators.ts               # Form validation
│   ├── qrCode.ts                   # QR code generation/parsing
│   ├── itemNumber.ts               # Generate unique item numbers
│   ├── pricing.ts                  # Calculate prices, commissions
│   └── index.ts
│
├── /constants                      # App-wide constants
│   ├── categories.ts               # Item categories
│   ├── statuses.ts                 # Item/event status enums
│   ├── permissions.ts              # Admin permission levels
│   ├── config.ts                   # App config (API URLs, etc.)
│   └── index.ts
│
└── /context                        # React context providers
    ├── AuthContext.tsx             # Global auth state
    ├── EventContext.tsx            # Currently selected event
    └── index.ts
```

---

## Package: /seller-app

**Purpose**: Mobile app for sellers to register items and track sales.

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
│   │   ├── verify.tsx              # SMS code verification
│   │   └── register.tsx            # First/last name, email
│   │
│   ├── /(tabs)                     # Main app tabs (bottom nav)
│   │   ├── _layout.tsx             # Tab layout
│   │   ├── index.tsx               # Home/dashboard
│   │   ├── events.tsx              # Browse upcoming events
│   │   ├── items.tsx               # My items (all events)
│   │   ├── notifications.tsx       # Notification history
│   │   └── profile.tsx             # User profile settings
│   │
│   ├── /event                      # Event-specific screens
│   │   ├── [id].tsx                # Event details
│   │   └── add-item.tsx            # Add item to event
│   │
│   ├── /item                       # Item-specific screens
│   │   ├── [id].tsx                # Item details
│   │   └── edit.tsx                # Edit item
│   │
│   └── qr-code.tsx                 # Display seller QR code
│
├── /components                     # App-specific components
│   ├── EventCard.tsx               # Event list item
│   ├── ItemStatusBadge.tsx         # "For Sale", "Sold", etc.
│   ├── SalesNotification.tsx       # Push notification UI
│   └── index.ts
│
├── /assets                         # Images, fonts, etc.
│   ├── /images
│   ├── /fonts
│   └── icon.png
│
└── /lib                            # App-specific utilities
    ├── notifications.ts            # Push notification setup
    └── navigation.ts               # Navigation helpers
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
│   │
│   ├── /(auth)                     # Admin authentication
│   │   ├── _layout.tsx
│   │   ├── login.tsx               # Email/password login
│   │   └── forgot-password.tsx
│   │
│   ├── /(dashboard)                # Event selection & overview
│   │   ├── _layout.tsx             # Dashboard layout
│   │   ├── index.tsx               # Event list
│   │   ├── analytics.tsx           # Sales analytics
│   │   └── settings.tsx            # Organization settings
│   │
│   ├── /(event)                    # Event-specific workflows
│   │   ├── _layout.tsx             # Event context wrapper
│   │   ├── select-mode.tsx         # Choose station mode
│   │   │
│   │   ├── /check-in               # Check-in station
│   │   │   ├── index.tsx           # Scan seller QR
│   │   │   ├── review-items.tsx    # Show seller's items
│   │   │   ├── print-labels.tsx    # Print label workflow
│   │   │   └── quick-add.tsx       # Add items for walk-ups
│   │   │
│   │   ├── /pos                    # Point of sale station
│   │   │   ├── index.tsx           # Scan item QR
│   │   │   ├── confirm-sale.tsx    # Confirm price/payment
│   │   │   └── receipt.tsx         # Optional receipt display
│   │   │
│   │   ├── /pickup                 # Pickup station
│   │   │   ├── index.tsx           # Scan seller QR
│   │   │   ├── payout.tsx          # Show amount owed, issue check
│   │   │   └── find-items.tsx      # Help locate unsold items
│   │   │
│   │   └── /reports                # Reports & reconciliation
│   │       ├── index.tsx           # Report dashboard
│   │       ├── sales.tsx           # Sales report
│   │       ├── payouts.tsx         # Payout report
│   │       ├── inventory.tsx       # Unsold items
│   │       └── export.tsx          # Export data (CSV, PDF)
│   │
│   └── /label-preview              # Preview label before printing
│       └── index.tsx
│
├── /components                     # Organizer-specific components
│   ├── /StationHeader              # Mode indicator banner
│   ├── /LabelPrinter               # Label printing component
│   │   ├── LabelPrinter.tsx
│   │   ├── usePrinter.ts           # Printer connection hook
│   │   └── LabelTemplate.tsx       # Label layout
│   ├── /Scanner                    # QR/barcode scanner
│   │   ├── Scanner.tsx
│   │   └── useScanner.ts
│   ├── /SellerDetails              # Display seller info
│   ├── /ItemList                   # List items with actions
│   ├── /PayoutSummary              # Payout calculation display
│   └── index.ts
│
├── /hardware                       # Hardware integration
│   ├── printer.ts                  # Zebra/Brother printer SDK
│   ├── scanner.ts                  # Camera/barcode scanner
│   └── index.ts
│
└── /lib
    ├── offline-queue.ts            # Queue sales when offline
    └── permissions.ts              # Admin permission checks
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
├── commission_rate (decimal) - default 0.25 (25%)
├── vendor_commission_rate (decimal) - default 0.20 (20%)
└── created_at (timestamptz)

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
├── status (enum) - registration|checkin|shopping|pickup|closed
└── settings (jsonb) - categories, donation options, etc.

sellers
├── id (uuid, pk, fk → auth.users)
├── first_name (text)
├── last_name (text)
├── phone (text, unique)
├── email (text)
├── qr_code (text, unique) - generated on registration
└── created_at (timestamptz)

admin_users
├── id (uuid, pk, fk → auth.users)
├── organization_id (uuid, fk → organizations)
├── first_name (text)
├── last_name (text)
├── email (text)
├── permissions (jsonb) - {check_in, pos, pickup, reports}
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
├── status (enum) - pending|checked_in|for_sale|sold|picked_up|donated
├── qr_code (text, unique)
├── checked_in_at (timestamptz)
├── sold_at (timestamptz)
├── sold_price (decimal)
└── created_at (timestamptz)

transactions
├── id (uuid, pk)
├── event_id (uuid, fk → events)
├── item_id (uuid, fk → items)
├── seller_id (uuid, fk → sellers)
├── sold_price (decimal)
├── commission_amount (decimal)
├── seller_amount (decimal)
├── payment_method (enum) - cash|card|check
├── processed_by (uuid, fk → admin_users)
└── sold_at (timestamptz)

payouts
├── id (uuid, pk)
├── event_id (uuid, fk → events)
├── seller_id (uuid, fk → sellers)
├── total_amount (decimal)
├── check_number (text)
├── issued_by (uuid, fk → admin_users)
├── signed_by_seller (boolean)
├── paid_at (timestamptz)
└── items (uuid[]) - array of item IDs
```

### Row Level Security (RLS)

Every table has RLS policies to ensure:
- Sellers only see their own data
- Admins see data for their organization's events
- Proper isolation between organizations

---

## Data Flow Examples

### 1. Seller Registers Item

```
Seller App (add-item.tsx)
  → Shared API (items.ts → createItem())
    → Supabase (INSERT into items)
      → Real-time broadcast
        → Organizer App (event dashboard updates)
```

### 2. Item Sold at POS

```
Organizer App (pos/confirm-sale.tsx)
  → Shared API (transactions.ts → createTransaction())
    → Supabase (INSERT into transactions, UPDATE items.status)
      → Edge Function (send-notification)
        → Twilio/Resend (SMS/Email to seller)
          → Seller App (push notification)
```

### 3. Offline Check-in (No Internet)

```
Organizer App (check-in station)
  → WatermelonDB (local insert → sync queue)
    → [Internet restored]
      → Shared API (sync with Supabase)
        → Supabase (batch INSERT items)
```

---

## Development Workflow

### Initial Setup

```bash
# Clone repo
git clone https://github.com/yourorg/gear-swap-monorepo.git
cd gear-swap-monorepo

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
yarn organizer:start

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

# Build and deploy seller app
cd packages/seller-app
eas build --platform ios --profile production
eas submit --platform ios

# Build and deploy organizer app
cd packages/organizer-app
eas build --platform ios --profile production
eas submit --platform ios
```

---

## Key Design Decisions

### 1. Two Separate Apps
- **Seller App**: Simple, public-facing, phone-optimized
- **Organizer App**: Complex, admin-only, tablet-optimized
- **Rationale**: Clear separation, better UX, smaller bundles, enhanced security

### 2. Supabase Backend
- PostgreSQL for ACID transactions (critical for financial data)
- Real-time for live inventory updates across stations
- Row-level security for multi-tenant isolation
- **Rationale**: Scalable, predictable costs, easy migration path

### 3. Monorepo Structure
- 70% code shared between apps
- 30% app-specific features
- **Rationale**: DRY principle, type safety, easier refactoring

### 4. Offline-First Architecture
- WatermelonDB for local storage
- Sync queue for when internet returns
- **Rationale**: Physical events have unreliable WiFi

### 5. QR Code Strategy
- Seller QR: Encodes seller ID (on phone)
- Item QR: Encodes item ID (on printed label)
- **Rationale**: Fast scanning, works offline with cached data

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
- [ ] Stripe/Square payment integration
- [ ] Photo uploads for items
- [ ] SMS reminders (pickup deadline)
- [ ] Web dashboard (Next.js)

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

## Environment Variables

### Shared
```bash
EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Seller App
```bash
EXPO_PUBLIC_APP_VARIANT=seller
EXPO_PUBLIC_ENABLE_NOTIFICATIONS=true
```

### Organizer App
```bash
EXPO_PUBLIC_APP_VARIANT=organizer
EXPO_PUBLIC_ENABLE_PRINTER=true
EXPO_PUBLIC_PRINTER_TYPE=zebra
```

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