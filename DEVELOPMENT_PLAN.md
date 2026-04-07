# Gear Swap App - Development Plan

> **Related Documents**: See [APP_DESCRIPTION.md](./APP_DESCRIPTION.md) for application architecture, features, and technical details.

## Overview

This document outlines the step-by-step development plan for building the Gear Swap application. The plan is organized into phases, with each phase building upon the previous one. Focus on completing each phase fully before moving to the next.

## Development Priorities

### Must-Have (MVP)
1. Seller registration and item submission
2. Check-in with label printing
3. POS with sale marking (no payment processing)
4. Pickup with payment status tracking (mark items as paid)
5. Basic notifications
6. Core reports

### Should-Have (Post-MVP)
1. Offline support
2. Advanced reporting
3. Photo uploads
4. Enhanced payment tracking features

### Nice-to-Have (Future)
1. Web dashboard
2. Advanced analytics
3. Multi-language support
4. AI features

---

## Phase 1: Core Infrastructure & Authentication

### 1.1 Database & Backend Setup

#### 1.1.1 **[DONE]** Verify all database migrations are applied
- Review migration files in `supabase/migrations/`
- Ensure all tables, RLS policies, and functions are created
- Test database connectivity from both apps

#### 1.1.1a **[DONE]** Add payment tracking field to items table (if not already present)
- Add `paid_at TIMESTAMPTZ` field to `items` table
- This tracks when an item was marked as paid (NULL = not paid yet)
- Items can be "sold" (status = 'sold') but not yet "paid" (paid_at = NULL)
- Create migration: `ALTER TABLE items ADD COLUMN paid_at TIMESTAMPTZ;`

#### 1.1.2 **[NOT STARTED]** Generate and update TypeScript types
- Run `supabase gen types` command
- Update `packages/shared/types/supabase.ts`
- Verify type accuracy across all tables

#### 1.1.3 **[NOT STARTED]** Set up Supabase Edge Functions (if not already created)
- Create `send-notification` function for SMS/email
- Create `generate-reports` function for data exports

#### 1.1.4 **[NOT STARTED]** Configure Supabase Auth providers
- Enable phone authentication for seller app
- Configure SMS provider (Twilio or Supabase default)
- Enable email/password authentication for organizer app
- Set up email templates for verification

### 1.2 Shared API Layer

#### 1.2.1 **[DONE]** Complete authentication API (`packages/shared/api/auth.ts`)
- Implement phone number login flow
- Implement SMS verification
- Implement email/password login for admins
- Add session management and refresh token handling

#### 1.2.2 **[DONE]** Complete seller API (`packages/shared/api/sellers.ts`)
- Create seller profile on registration
- Generate unique QR codes for sellers
- Handle guest seller creation
- Implement seller lookup by QR code

#### 1.2.3 **[DONE]** Complete events API (`packages/shared/api/events.ts`)
- Fetch events with proper filtering
- Handle event status transitions
- Implement event creation and editing
- Add event settings management

#### 1.2.4 **[DONE]** Complete items API (`packages/shared/api/items.ts`)
- Create items with custom fields
- Update item statuses
- Handle price reduction logic
- Implement item lookup by QR code
- Add bulk operations for check-in

#### 1.2.5 **[DONE]** Complete transactions API (`packages/shared/api/transactions.ts`)
- Create transaction records when items are sold
- Update item status to "sold"
- Record sold price (for reporting purposes)
- Trigger notifications on sale

#### 1.2.6 **[DONE]** Complete payment tracking API (`packages/shared/api/payouts.ts`)
- Mark individual items as "paid"
- Mark all items for a seller as "paid" (bulk operation)
- Query which items/sellers have been paid
- Update item `paid_at` timestamp

#### 1.2.7 **[DONE]** Complete organizations API (`packages/shared/api/organizations.ts`)
- Fetch organization settings
- Update commission rates (for reporting)
- Manage admin users
- Handle organization creation

### 1.3 Shared Utilities

#### 1.3.1 **[DONE]** QR Code utilities (`packages/shared/utils/qrCode.ts`)
- Complete QR code generation for sellers and items
- Implement QR code parsing and validation
- Add price reduction time checking logic

#### 1.3.2 **[DONE]** Pricing utilities (`packages/shared/utils/priceReduction.ts`)
- Handle price reduction logic based on time
- Support multiple price reduction points
- Calculate current price based on time and reduction settings

#### 1.3.3 **[NOT STARTED]** Formatters (`packages/shared/utils/formatters.ts`)
- Currency formatting
- Date/time formatting
- Item number generation
- Phone number formatting

---

## Phase 2: Seller App Core Features

### 2.1 Authentication Flow

#### 2.1.1 **[DONE]** Complete login screen (`packages/seller-app/app/(auth)/login.tsx`)
- Phone number input with validation
- Country code selector
- Error handling and user feedback

#### 2.1.2 **[NOT STARTED]** Complete verification screen (`packages/seller-app/app/(auth)/verify.tsx`)
- SMS code input (6-digit)
- Resend code functionality
- Auto-verification if possible
- Handle verification errors

#### 2.1.3 **[DONE]** Complete signup screen (`packages/seller-app/app/(auth)/signup.tsx`)
- First name, last name, email collection
- Profile photo upload (optional)
- Terms acceptance
- Create seller profile on completion

### 2.2 Event Browsing & Registration

#### 2.2.1 **[DONE]** Complete events list screen (`packages/seller-app/app/(tabs)/events.tsx`)
- Display upcoming events
- Show registration status (open/closed)
- Filter by date range
- Navigate to event details

#### 2.2.2 **[DONE]** Complete event details screen (`packages/seller-app/app/event/[id]/index.tsx`)
- Show event information (date, times, location)
- Display registration window
- Show "Register" button if eligible
- Display registration status if already registered

#### 2.2.3 **[DONE]** Complete event registration screen (`packages/seller-app/app/event/[id]/register.tsx`)
- Load dynamic registration fields from organization
- Render form fields based on field definitions
- Validate required fields
- Handle optional fields
- Save registration data
- Support guest registration flow

### 2.3 Item Management

#### 2.3.1 **[DONE]** Complete items list screen (`packages/seller-app/app/(tabs)/items.tsx`)
- Show all items across all events
- Filter by event, status, or category
- Display item status badges (including "paid" status)
- Show sold price if item is sold
- Navigate to item details

#### 2.3.2 **[DONE]** Complete add item screen (`packages/seller-app/app/event/[id]/add-item.tsx`)
- Load event-specific field definitions
- Render dynamic form fields
- Category selection
- Price input with validation
- Price reduction options (if enabled)
- Donation option toggle
- Photo upload (future enhancement)
- Save item and generate QR code

#### 2.3.3 **[NOT STARTED]** Complete item details screen (`packages/seller-app/app/item/[id].tsx`)
- Display all item information
- Show current status (including "paid" status)
- Display pricing information
- Show transaction details if sold
- Show paid status indicator
- Edit item (if status allows)

#### 2.3.4 **[NOT STARTED]** Complete item edit screen (`packages/seller-app/app/item/edit.tsx`)
- Load existing item data
- Allow editing of editable fields
- Validate changes
- Update item in database

### 2.4 Seller Dashboard & Profile

#### 2.4.1 **[DONE]** Complete home/dashboard screen (`packages/seller-app/app/(tabs)/index.tsx`)
- Show summary statistics (total items, sold items, paid items)
- Display recent activity
- Quick links to active events
- Show notifications count

#### 2.4.2 **[DONE]** Complete profile screen (`packages/seller-app/app/(tabs)/profile.tsx`)
- Display seller information
- Show QR code for check-in
- Edit profile information
- Logout functionality
- Account deletion (if needed)

#### 2.4.3 **[NOT STARTED]** Complete notifications screen (`packages/seller-app/app/(tabs)/notifications.tsx`)
- Display notification history
- Show sale notifications with details
- Mark notifications as read
- Filter by type or date

### 2.5 QR Code Display

#### 2.5.1 **[NOT STARTED]** Complete QR code screen (`packages/seller-app/app/qr-code.tsx`)
- Generate and display seller QR code
- Make QR code scannable
- Add instructions for use at check-in
- Allow saving QR code as image

---

## Phase 3: Organizer App Core Features

### 3.1 Authentication & Organization Setup

#### 3.1.1 **[DONE]** Complete admin login screen (`packages/organizer-app/app/(auth)/login.tsx`)
- Email/password input
- Error handling
- "Forgot password" flow

#### 3.1.2 **[DONE]** Complete organization selection/creation
- Display user's organizations
- Allow switching between organizations
- Create new organization (if permitted)
- Set active organization context

### 3.2 Event Management

#### 3.2.1 **[DONE]** Complete event list screen (`packages/organizer-app/app/(dashboard)/index.tsx`)
- Display all events for organization
- Filter by status or date
- Show event statistics (items, sales, revenue)
- Navigate to event details or mode selection

#### 3.2.2 **[DONE]** Complete create event screen (`packages/organizer-app/app/(dashboard)/(tabs)/create-event.tsx`)
- Event name and description
- Date and time configuration
- Registration window settings
- Shop open/close times
- Price reduction time settings
- Event status management
- Save and publish event

#### 3.2.3 **[DONE]** Complete event settings screens
- Categories management (`packages/organizer-app/app/(dashboard)/categories.tsx`)
- Field definitions (`packages/organizer-app/app/(dashboard)/field-definitions.tsx`)
- Swap registration fields (`packages/organizer-app/app/(dashboard)/swap-registration-fields.tsx`)
- Swap registration page customization (`packages/organizer-app/app/(dashboard)/swap-registration-page.tsx`)
- Gear tag templates (`packages/organizer-app/app/(dashboard)/gear-tags.tsx`)
- Price reduction settings (`packages/organizer-app/app/(dashboard)/price-reduction-settings.tsx`)
- Commission rates (`packages/organizer-app/app/(dashboard)/commission-rates.tsx`)

### 3.3 Check-In Station

#### 3.3.1 **[DONE]** Complete stations selection (`packages/organizer-app/app/(event)/stations.tsx`)
- Replaces former select-mode.tsx
- Permission-based station access (check-in, POS, pickup, reports)
- Uses `admin_users.permissions.stations` and `is_org_admin`
- Display available modes based on user permissions

#### 3.3.2 **[DONE]** Complete check-in main screen (`packages/organizer-app/app/(event)/check-in/index.tsx`)
- QR code scanner for seller codes
- Display seller information after scan
- Show list of registered items
- Navigate to label printing
- Handle guest registration

#### 3.3.3 **[DONE]** Complete guest registration screen (`packages/organizer-app/app/(event)/check-in/register-guest.tsx`)
- Collect seller information (name, phone, email)
- Verify photo ID (mark as verified)
- Allow immediate item addition
- Create guest seller account

#### 3.3.4 **[IN PROGRESS]** Complete label printing workflow
- Review items to print
- Select items for printing
- Generate label data with QR codes
- Connect to printer (Zebra/Brother)
- Print labels
- Mark items as checked in
- Handle print errors and retries

### 3.4 Point of Sale (POS) Station

#### 3.4.1 **[DONE]** Complete POS main screen (`packages/organizer-app/app/(event)/pos/index.tsx`)
- QR code scanner for item codes
- Display item information after scan
- Show current price (with time-based reduction if applicable)
- Display original price and reduced price
- Show item details (category, description, size)

#### 3.4.2 **[DONE]** Complete sale confirmation screen
- Display final price (with time-based reduction if applicable)
- Show price reduction indicator if applicable
- Optional: Collect buyer information (for records)
- Confirm sale (organization processes actual payment externally)
- Create transaction record with sold price
- Update item status to "sold"
- Trigger seller notification
- Show success message
- Return to scanning mode

#### 3.4.3 **[DONE]** Handle price reduction logic
- Check current time vs. price reduction time
- Apply correct price automatically
- Show price reduction indicator
- Log price used in transaction

### 3.5 Pickup Station

**Design decisions**: See [docs/PICKUP_STATION_DESIGN.md](./docs/PICKUP_STATION_DESIGN.md).

#### 3.5.1 **[NOT STARTED]** Complete pickup main screen (`packages/organizer-app/app/(event)/pickup/index.tsx`)
- QR code scanner for seller codes
- **"Seller has presented their ID"** → show search-by-name to find seller (no QR)
- Display seller information
- Show sold items with prices and paid status
- Show unsold items list
- Display which items have been marked as paid

#### 3.5.2 **[NOT STARTED]** Complete payment tracking
- Mark individual items as "paid" (after organization processes payout)
- Mark all items for seller as "paid" (bulk operation)
- Update item `paid_at` timestamp
- Show confirmation when items are marked as paid
- Track which items have been paid (for reporting)

#### 3.5.3 **[NOT STARTED]** Complete unsold items handling
- Display list of unsold items
- Help locate items (if needed)
- Mark items as picked up when retrieved
- **Mark item as donated (any time)**: show warning "You are certifying that the seller has donated the item"; then update status; send in-app notification to seller
- **Admin bulk**: "Mark all eligible unsold as donated" for items with "donate if not sold" (admin, after event)
- Update inventory

### 3.6 Reports & Analytics

#### 3.6.1 **[NOT STARTED]** Complete reports dashboard (`packages/organizer-app/app/(event)/reports/index.tsx`)
- Sales summary (total items sold, total revenue)
- Item statistics (total, sold, paid, unsold, donated)
- Top selling categories
- Revenue over time (if multiple days)

#### 3.6.2 **[NOT STARTED]** Complete sales report (`packages/organizer-app/app/(event)/reports/sales.tsx`)
- List all transactions
- Filter by date, category
- Show transaction details (item, price, seller, sold time)
- Show paid status for each item
- Export to CSV

#### 3.6.3 **[NOT STARTED]** Complete payment tracking report (`packages/organizer-app/app/(event)/reports/payments.tsx`)
- List all sellers with sold items
- Show items sold per seller with prices
- Display paid/unpaid status for each item
- Filter by paid/unpaid status
- Export to CSV (for organization's accounting system)

#### 3.6.4 **[NOT STARTED]** Complete inventory report (`packages/organizer-app/app/(event)/reports/inventory.tsx`)
- List unsold items
- Filter by category, status
- Show items marked for donation
- Export to CSV

---

## Phase 4: Hardware Integration

### 4.1 Printer Integration

#### 4.1.1 **[IN PROGRESS]** Complete printer connection (`packages/organizer-app/hardware/printer.ts`)
- Support Zebra printers (ZPL)
- Support Brother printers
- Bluetooth connection handling
- WiFi connection handling
- Connection status monitoring

#### 4.1.2 **[NOT STARTED]** Complete label template system (`packages/organizer-app/hardware/tagPrinter.ts`)
- Load organization's tag template
- Render label with dynamic fields
- Generate QR code for label
- Format label according to template
- Handle different label sizes

#### 4.1.3 **[NOT STARTED]** Complete printer UI component (`packages/organizer-app/components/PrinterConnection.tsx`)
- Display connection status
- Allow manual printer selection
- Test print functionality
- Show print queue
- Handle print errors

### 4.2 Scanner Integration

#### 4.2.1 **[NOT STARTED]** Complete QR code scanner component (`packages/shared/components/QRCodeScanner.tsx`)
- Camera access and permissions
- QR code detection
- Handle multiple QR code formats
- Error handling for invalid codes
- Success feedback (vibration, sound)

#### 4.2.2 **[IN PROGRESS]** Integrate scanner in organizer app
- Check-in station scanner
- POS station scanner
- Pickup station scanner
- Handle scanner errors gracefully

---

## Phase 5: Notifications & Real-Time Features

### 5.1 Notification System

#### 5.1.1 **[NOT STARTED]** Set up push notifications
- Configure Expo notifications
- Request permissions
- Handle notification tokens
- Store tokens in database

#### 5.1.2 **[NOT STARTED]** Implement SMS notifications
- Integrate Twilio or Supabase SMS
- Send sale notifications
- Send pickup reminders
- Handle SMS delivery status

#### 5.1.3 **[NOT STARTED]** Implement email notifications
- Integrate Resend or Supabase email
- Send sale confirmations
- Send payment status updates (when marked as paid)
- Send event reminders

#### 5.1.4 **[NOT STARTED]** Create notification triggers
- Edge function for sale notifications
- Edge function for pickup reminders
- Batch notification processing
- Notification preferences

### 5.2 Real-Time Updates

#### 5.2.1 **[NOT STARTED]** Implement real-time subscriptions
- Subscribe to item status changes
- Subscribe to transaction updates
- Subscribe to event status changes
- Handle connection/disconnection

#### 5.2.2 **[NOT STARTED]** Update UI in real-time
- Refresh item lists automatically
- Update seller dashboard on sale
- Update organizer dashboard on transactions
- Show connection status indicator

---

## Phase 6: Offline Support

### 6.1 Offline Data Storage

#### 6.1.1 **[NOT STARTED]** Set up WatermelonDB (if using)
- Initialize database
- Define schema
- Set up sync configuration

#### 6.1.2 **[NOT STARTED]** Implement offline queue
- Queue transactions when offline
- Queue item status updates
- Queue check-in operations
- Store queue in local database

#### 6.1.3 **[NOT STARTED]** Implement sync mechanism
- Detect when online
- Process queued operations
- Handle sync conflicts
- Show sync status to users

### 6.2 Offline UI Handling

#### 6.2.1 **[NOT STARTED]** Show offline indicators
- Display connection status
- Warn users when offline
- Show queued operations count

#### 6.2.2 **[NOT STARTED]** Handle offline errors gracefully
- Cache critical data
- Allow limited functionality offline
- Queue user actions
- Sync when connection restored

---

## Phase 7: Testing & Polish

### 7.1 Testing

#### 7.1.1 **[NOT STARTED]** Test seller app flows
- Registration flow
- Item creation flow
- Notification receipt
- QR code generation

#### 7.1.2 **[NOT STARTED]** Test organizer app flows
- Check-in workflow
- POS workflow
- Pickup workflow
- Report generation

#### 7.1.3 **[NOT STARTED]** Test edge cases
- Price reduction timing
- Payment status tracking
- Guest seller flow
- Offline scenarios
- Error handling

### 7.2 UI/UX Polish

#### 7.2.1 **[NOT STARTED]** Improve visual design
- Consistent color scheme
- Typography improvements
- Icon usage
- Spacing and layout

#### 7.2.2 **[NOT STARTED]** Improve user experience
- Loading states
- Error messages
- Success feedback
- Empty states
- Onboarding flows

#### 7.2.3 **[NOT STARTED]** Accessibility
- Screen reader support
- High contrast mode
- Font scaling
- Touch target sizes

### 7.3 Performance Optimization

#### 7.3.1 **[NOT STARTED]** Optimize database queries
- Add indexes where needed
- Optimize RLS policies
- Reduce query complexity

#### 7.3.2 **[NOT STARTED]** Optimize app performance
- Image optimization
- Code splitting
- Lazy loading
- Memoization

---

## Phase 8: Deployment & Documentation

### 8.1 Deployment Preparation

#### 8.1.1 **[NOT STARTED]** Set up production environment
- Production Supabase project
- Environment variables
- API keys and secrets

#### 8.1.2 **[NOT STARTED]** Build apps for production
- Configure EAS Build
- Create production builds
- Test production builds

#### 8.1.3 **[NOT STARTED]** Deploy to app stores
- Apple App Store submission
- Google Play Store submission
- Handle app review process

### 8.2 Documentation

#### 8.2.1 **[NOT STARTED]** User documentation
- Seller app user guide
- Organizer app user guide
- FAQ section

#### 8.2.2 **[NOT STARTED]** Technical documentation
- API documentation
- Database schema documentation
- Deployment guide
- Troubleshooting guide

---

## Phase 9: Future Enhancements (Post-MVP)

### 9.1 Payment Integration (Stretch Goal)

#### 9.1.1 **[NOT STARTED]** Integrate Stripe/Square (if organizations want built-in payment processing)
- Payment processing at POS
- Automatic commission calculation and deduction
- Receipt generation
- Refund handling
- Note: Many organizations may prefer to keep using their existing payment systems

### 9.2 Advanced Features

#### 9.2.1 **[NOT STARTED]** Photo uploads for items
- Image storage in Supabase
- Image optimization
- Display in seller app
- Display in organizer app

#### 9.2.2 **[NOT STARTED]** Web dashboard
- Desktop interface for admins
- Advanced analytics
- Bulk operations
- Multi-event management

#### 9.2.3 **[NOT STARTED]** Multi-language support
- Internationalization setup
- Translation files
- Language selection

#### 9.2.4 **[NOT STARTED]** Advanced analytics
- Revenue trends
- Category performance
- Seller analytics
- Predictive insights

---

## Development Notes

### Recent Refactors (2025)

**Event Status Simplification**: Event status was refactored from five states (`registration` | `checkin` | `shopping` | `pickup` | `closed`) to two (`active` | `closed`). Added `events.items_locked` for controlling when sellers can add/edit items. See [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md) for details.

**Admin Permissions**: `admin_users` now has `is_org_admin` and a structured `permissions.stations` shape: `{check_in, pos, pickup, reports}`. Station access is permission-based. RLS enforces POS permission for transactions and pickup permission for payouts.

**Stations Screen**: Replaced `select-mode.tsx` with `stations.tsx`, which shows only stations the user has permission to access.

**Organizer Dashboard**: Dashboard uses `(tabs)` with Events, Create Event, and Settings. Event management, categories, field definitions, etc. are stack screens reachable from settings or event management.

### Payment Handling Philosophy

**Important**: The app does NOT process payments or calculate payouts. Organizations use their existing payment systems (Square, cash, checks, etc.). The app simply tracks which items have been sold and which sellers have been marked as "paid" after the organization processes payouts externally.

### Payout Tracking Approach

Instead of calculating payout amounts, the app allows org users to mark individual items or entire sellers as "paid" after processing payouts through their existing systems. This keeps the app simple and flexible for different organizational workflows.

### Development Guidelines

- This plan assumes the database schema is mostly complete (based on migrations)
- Some screens may already exist but need completion
- Focus on one phase at a time, completing each fully before moving to the next
- Test thoroughly at each phase
- Get user feedback early and often
- Prioritize core workflows (registration → check-in → sale → mark as paid) first

### Seller App Event Status (Future)

The seller app still displays the legacy five status values in some places. When ready to update, see [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md) for the suggested mapping (e.g. `event.status === 'active' && !event.itemsLocked` for "can add items").

### Keeping Documents in Sync

When making changes to the codebase:
1. Update [APP_DESCRIPTION.md](./APP_DESCRIPTION.md) if architecture, features, or workflows change
2. Update [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) if development tasks or priorities change
3. Update [README.md](./README.md) if setup, configuration, or technical details change

---

## Related Documentation

- [APP_DESCRIPTION.md](./APP_DESCRIPTION.md) - Application architecture and features
- [README.md](./README.md) - Project setup and technical details
- [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md) - Event status refactor (active/closed), admin permissions, seller app mapping notes

