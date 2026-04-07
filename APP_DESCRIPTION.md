# Gear Swap App - Description & Architecture

> **Related Documents**: See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for the step-by-step development plan.

## Overview

The Gear Swap application is a comprehensive consignment management system designed to help non-profit organizations efficiently run gear swap events (bike swaps, ski swaps, outdoor equipment exchanges, etc.). The system consists of two mobile applications that work together to manage the entire lifecycle of a swap event, from pre-registration through final payment tracking.

## Core Purpose

The app streamlines the complex process of managing consignment sales where individuals bring items to sell, the organization displays them during an event, processes sales, and tracks which sellers have been paid. The system eliminates manual paperwork, reduces errors, provides real-time inventory tracking, and ensures sellers are promptly notified when their items sell.

**Important**: The app does not handle payment processing or payout calculations—organizations use their existing payment systems (Square, cash, checks, etc.). The app simply tracks which items have been sold and which sellers have been marked as paid.

## Application Architecture

### Two-App System

The system consists of two separate mobile applications:

1. **Seller App** - Consumer-facing mobile app for individuals consigning items
2. **Organizer App** - Admin-facing tablet app for event staff and volunteers

This separation provides:
- Clear user experience boundaries
- Better security (admin features isolated)
- Optimized UI for different device types (phone vs. tablet)
- Smaller app bundles
- Independent deployment cycles

### Monorepo Structure

The codebase is organized as a monorepo using Yarn Workspaces:

```
/packages
├── /shared          # ~70% of codebase - shared between apps
├── /seller-app     # Consumer mobile app
└── /organizer-app  # Admin tablet app
```

The shared package contains:
- API clients and data access layer
- TypeScript types and models
- Reusable UI components
- Utility functions
- Constants and configuration
- React hooks and context providers

## Seller App (Consumer-Facing)

### Purpose
Mobile application designed for the general public who want to consign items at swap events.

### Target Device
iOS/Android phones (portrait mode)

### User Types
- **Authenticated Users**: Create accounts with phone number authentication
- **Guest Sellers**: Register on-site without creating accounts (handled by organizers)

### Key Capabilities

#### Event Management
- Browse upcoming events
- View event details (date, times, location, registration window)
- Register for events
- Complete dynamic registration forms (customizable by organizations)

#### Item Management
- Upload multiple items with detailed information
- Select categories
- Set descriptions, sizes, and pricing
- Configure optional price reduction schedules (e.g., "reduce to $50 at 4pm if not sold")
- Opt items for donation if unsold
- Edit items (before check-in)
- View all items across all events

#### Status Tracking
- Real-time status updates: pending → checked_in → for_sale → sold → paid
- View sold prices
- See payment status (paid/unpaid)
- Track items across multiple events

#### Notifications
- Receive real-time notifications when items sell (SMS + push)
- Notification history
- Payment status updates

#### QR Code Access
- Display seller QR code for quick check-in at events
- Save QR code as image

## Organizer App (Admin-Facing)

### Purpose
Tablet-optimized application for event staff, volunteers, and organization administrators.

### Target Device
iOS/Android tablets (landscape preferred)

### User Types
- **Organization Admins**: Full access to all features
- **Volunteers**: Limited permissions based on role (`permissions.stations`: check-in, POS, pickup, reports)

### Key Capabilities

#### Event Management
- Create and configure events
- Set event dates, times, and registration windows
- Configure price reduction policies
- Manage event status (active | closed) and items_locked for controlling when sellers can add/edit items
- Customize registration forms with dynamic fields
- Manage item categories
- Design gear tag templates for printed labels

#### Check-In Station
- Scan seller QR codes to retrieve registered items
- Review and verify item information
- Print adhesive labels with QR codes for each item
- Handle walk-up registrations for guests
- Verify photo IDs for guest sellers
- Mark items as checked in

#### Point of Sale (POS) Station
- Scan item QR codes to retrieve pricing information
- Automatically calculate correct price based on time-based reductions
- Display item details (category, description, size, price)
- Mark items as sold (organization processes actual payment externally)
- Update inventory in real-time
- Trigger notifications to sellers

#### Pickup Station
- Scan seller QR codes to view sold items
- Display sold items with prices and payment status
- Mark individual items or entire sellers as "paid" (after organization processes payouts)
- Help sellers locate unsold items
- Mark items as picked up or donated
- Update inventory

#### Reports & Analytics
- Sales reports with revenue breakdowns
- Payment tracking reports (which sellers have been marked as paid)
- Inventory reports (unsold items)
- Donation reports
- Data export (CSV, PDF) for accounting systems

## Technical Architecture

### Backend: Supabase

**Database**: PostgreSQL
- ACID transactions for data integrity
- Row-level security (RLS) for multi-tenant isolation
- Real-time subscriptions for live updates
- Full-text search capabilities

**Authentication**:
- Phone number authentication for seller app (SMS verification)
- Email/password authentication for organizer app
- Session management with refresh tokens

**Edge Functions**:
- `send-notification`: SMS and email notifications
- `generate-reports`: Data export and report generation

**Storage**:
- File storage for images (future: item photos)
- QR code images

### Frontend: React Native (Expo)

**Framework**: Expo Router (file-based routing)
- TypeScript for type safety
- Shared codebase between apps
- Platform-specific optimizations (iOS/Android/Web)

**State Management**:
- React Context for global state (auth, events)
- React Query / SWR for server state (future consideration)
- Local state with React hooks

**Real-Time Updates**:
- Supabase real-time subscriptions
- Automatic UI updates when data changes
- Connection status indicators

### Offline Support

**Strategy**: Offline-first architecture (planned)
- WatermelonDB for local data storage
- Sync queue for operations when offline
- Automatic sync when connection restored
- Critical for unreliable event WiFi

### QR Code System

**Seller QR Codes**:
- Encodes seller ID
- Displayed on seller's phone
- Scanned at check-in and pickup stations

**Item QR Codes**:
- Encodes item ID
- Printed on adhesive labels
- Scanned at POS station

**Benefits**:
- Fast scanning workflows
- Works offline with cached data
- No manual data entry

## Key Workflows

### Pre-Event: Registration

1. Seller browses events in seller app
2. Seller registers for event (completes dynamic registration form)
3. Seller adds items with details, pricing, and preferences
4. Items are in "pending" status

### Event Day: Check-In

1. Seller arrives at check-in station
2. Organizer scans seller QR code
3. System displays seller's registered items
4. Organizer reviews and verifies items
5. Organizer prints labels with QR codes for each item
6. Labels are attached to physical items
7. Items are marked as "checked_in"
8. Items are placed on display shelves

### During Event: Sales

1. Customer browses items on display
2. Customer selects item to purchase
3. Organizer at POS station scans item QR code
4. System displays item information and current price (with time-based reduction if applicable)
5. Organization processes payment through their existing system (Square, cash, etc.)
6. Organizer marks item as "sold" in app
7. System creates transaction record
8. System triggers notification to seller (SMS + push)
9. Item status updates to "sold" in real-time

### Post-Event: Pickup

1. Shopping closes, system generates sales reports
2. Seller arrives at pickup station
3. Organizer scans seller QR code
4. System displays:
   - Sold items with prices and payment status
   - Unsold items list
5. Organization processes payout through their existing system
6. Organizer marks items or seller as "paid" in app
7. System updates item `paid_at` timestamp
8. Seller retrieves unsold items (if any)
9. Items marked for donation remain in inventory

## Business Logic

### Item Status Lifecycle

```
pending → checked_in → for_sale → sold → paid → picked_up
                                    ↓
                                 donated
```

- **pending**: Item registered but not yet checked in
- **checked_in**: Item verified and label printed
- **for_sale**: Item on display (status may be implicit)
- **sold**: Item purchased, transaction recorded
- **paid**: Seller marked as paid (tracked via `paid_at` timestamp)
- **picked_up**: Unsold item retrieved by seller
- **donated**: Unsold item marked for donation

### Price Reduction System

**Time-Based Reductions**:
- Items can have scheduled price reductions
- Reductions activate at specified times
- Multiple reduction points supported
- Price calculated at POS scan time (lazy evaluation)

**Configuration Options**:
- Organization controls timing vs. seller controls timing
- Fixed reduction times vs. seller-selected times
- Percentage reductions vs. fixed amount reductions

**Example**:
- Item listed at $100
- Seller opts for reduction to $75 at 4pm
- If scanned before 4pm: price = $100
- If scanned after 4pm: price = $75

### Payment Tracking

**Simple Status Tracking**:
- Items have `paid_at` timestamp field
- NULL = not paid yet
- Timestamp = when marked as paid

**Workflow**:
1. Item is sold → status = 'sold', `paid_at` = NULL
2. Organization processes payout externally
3. Organizer marks item as paid → `paid_at` = NOW()
4. Reports show paid/unpaid status

**Bulk Operations**:
- Mark all items for a seller as paid (single action)
- Mark individual items as paid
- Query which items/sellers have been paid

### Multi-Tenancy

**Organization Isolation**:
- Each organization has isolated data
- Row-level security (RLS) enforces separation
- Organizations can have multiple events
- Admin users belong to specific organizations

**SaaS Ready**:
- Organization-level configuration
- Customizable registration forms
- Custom gear tag templates
- Independent commission rate settings (for reporting)

## Technology Stack

### Frontend
- **React Native** (Expo) - Cross-platform mobile development
- **TypeScript** - Type safety
- **Expo Router** - File-based routing
- **React Context** - Global state management

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Edge Functions
  - Storage

### Development Tools
- **Yarn Workspaces** - Monorepo management
- **TypeScript** - Type checking
- **ESLint** - Code linting
- **Expo CLI** - Development and build tools

### Hardware Integration (Organizer App)
- **Zebra Printers** (ZPL) - Label printing
- **Brother Printers** - Label printing
- **Camera API** - QR code scanning

### Notifications
- **Expo Notifications** - Push notifications
- **Twilio** - SMS notifications
- **Resend / Supabase Email** - Email notifications

### Future Considerations
- **WatermelonDB** - Offline data storage
- **Stripe/Square** - Payment processing (optional stretch goal)

## Data Models

### Core Entities

**Organizations**
- Multi-tenant isolation
- Customizable settings
- Commission rates (for reporting only)

**Events**
- Belong to organizations
- Have status lifecycle
- Configure price reduction policies
- Custom registration forms

**Sellers**
- Can be authenticated or guest
- Have unique QR codes
- Can participate in multiple events

**Items**
- Belong to events and sellers
- Have status lifecycle
- Support price reductions
- Track payment status via `paid_at`

**Transactions**
- Record when items are sold
- Store sold price
- Link to items, sellers, and events
- Full audit trail

### Database Schema Highlights

See [README.md](./README.md) for complete database schema documentation.

Key tables:
- `organizations` - Multi-tenant isolation
- `events` - Event configuration and status
- `sellers` - Seller profiles and QR codes
- `items` - Item details, status, and payment tracking
- `transactions` - Sales records
- `admin_users` - Organization staff
- `payouts` - Optional payout tracking (most orgs use `paid_at` on items)

## Security & Privacy

### Authentication
- Phone number authentication for sellers (SMS verification)
- Email/password for organizers
- Session management with refresh tokens
- Password reset flows

### Authorization
- Row-level security (RLS) on all tables
- Sellers only see their own data
- Admins see data for their organization only
- Permission-based access control for volunteers

### Data Privacy
- No personal contact info on printed labels
- QR codes encode IDs only (not sensitive data)
- Secure API endpoints
- Encrypted data in transit

## Performance Considerations

### Real-Time Updates
- Supabase real-time subscriptions for live inventory
- Efficient change detection
- Minimal network overhead

### Offline Support
- Local data caching
- Operation queuing when offline
- Automatic sync when online
- Conflict resolution strategies

### Scalability
- PostgreSQL for ACID compliance
- Indexed queries for performance
- Efficient RLS policies
- Connection pooling

## Future Enhancements

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) Phase 9 for detailed future enhancements.

**Stretch Goals**:
- Payment processing integration (Stripe/Square) - optional
- Photo uploads for items
- Web dashboard for admins
- Advanced analytics
- Multi-language support

## Related Documentation

- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) - Step-by-step development plan
- [README.md](./README.md) - Project setup and technical details
- [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md) - Event status refactor and seller app mapping notes



