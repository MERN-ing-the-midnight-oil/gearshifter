# Event status refactor – manual review

Event status was simplified from five states (`registration` \| `checkin` \| `shopping` \| `pickup` \| `closed`) to two (`active` \| `closed`). The **organizer app and schema** were updated. The **seller app was not changed** so that you can decide how to map the new model to seller UX.

## Places still using the old linear status (for your review)

These files still branch on the previous status values. Update or remove as needed for your product (e.g. map `active` + `items_locked` to “can add items”, “show QR”, etc.).

### Seller app (unchanged on purpose)

1. **`packages/seller-app/app/(tabs)/index.tsx`**
   - `currentEvent.status === 'closed'` – CTA / summary
   - `currentEvent.status === 'registration'` – “Add Items” CTA
   - `currentEvent.status === 'checkin'` – “Show My QR Code” CTA
   - `currentEvent.status === 'closed'` – “View Event Summary”
   - `currentEvent.status === 'pickup'` – timing note “Pickup window is open”
   - `currentEvent.status === 'shopping'` – timing note “Event is in progress”
   - Badge styling: `formatEventStatus` / `getEventStatusBadgeStyle` still use the old 5 statuses

2. **`packages/seller-app/app/event/[id]/index.tsx`**
   - `event.status === 'registration'` in `isRegistrationOpen()` (registration window)
   - Badge: `formatEventStatus` / `getEventStatusBadgeStyle` for old statuses

3. **`packages/seller-app/app/(tabs)/events.tsx`**
   - `event.status === 'registration'` in `isRegistrationOpen()`
   - `event.status === 'registration' && !isRegistrationOpen(event)` for “Registration opens …” copy
   - Badge: `formatEventStatus` / `getEventStatusBadgeStyle` for old statuses

### Suggested mapping for seller app (when you update it)

- **Registration / “can add items”**: `event.status === 'active' && !event.itemsLocked` (and within org-defined registration dates if you use them).
- **Check-in / “show QR”**: e.g. `event.status === 'active'` (sellers can show QR whenever event is active; you can refine with dates if needed).
- **Shopping / “event in progress”**: `event.status === 'active'`.
- **Pickup / “pickup window”**: keep using org-defined shop/pickup times; no need for a separate status.
- **Closed**: `event.status === 'closed'`.
- **Badges**: use two labels: “Active” and “Closed” (and optionally “Items locked” if you surface that to sellers).

## Other references

- **`scripts/js/test-payment-tracking.ts`**  
  Uses variable name `eventStatus` for **payment** status (getEventPaymentStatus), not event lifecycle status. No change required.

## Summary of refactor (already done)

- **DB**: `event_status` enum is `active` \| `closed`; `events.items_locked` added; `admin_users.is_org_admin` and new `permissions.stations` shape.
- **Shared**: `EventStatus`, `Event.itemsLocked`, `AdminPermissions`, `AdminUser.isOrgAdmin` and `permissions`; `getUserPermissions()`; events API and mapping.
- **Organizer**: Removed `select-mode.tsx`; added permission-based `stations.tsx`; manage event uses active/closed and items_locked; dashboard badges use active/closed; RLS enforces POS/pickup permissions on transactions/payouts.
