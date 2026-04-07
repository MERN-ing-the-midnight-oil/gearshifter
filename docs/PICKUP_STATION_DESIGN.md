# Pickup Station – Design Decisions (Phase 3.5)

This document captures agreed behavior for the Pickup Station so implementation stays consistent.

---

## 1. Identifying the seller

- **Primary**: Scan seller QR code (camera or manual entry), same pattern as check-in.
- **Fallback**: "Seller has presented their ID" — when the volunteer taps this, show **search-by-name** (and/or search by phone/email if available) to find the seller. Use when the seller doesn’t have the app or QR code but has ID.

Flow: [Scan QR] **or** [Seller has presented their ID] → if the latter, show search field and results; on select, load that seller’s pickup data for the current event.

---

## 2. Donating items

### 2.1 Marking a single item as donated (any time)

- Org volunteers can mark an item as **donated at any time** (not limited to post-event).
- Before applying the action, show a **warning**:
  - **"You are certifying that the seller has donated the item."** (or equivalent)
- On confirm: call `updateItemStatus(itemId, 'donated')` (or equivalent API).
- **Notification**: After an item is marked donated, the seller receives an **in-app notification** that their item was marked as donated.

### 2.2 Bulk: "Mark all eligible unsold as donated"

- **Who**: Admin only (or per your permission model).
- **When**: Typically **after the end of the event** (e.g. from Reports or Event close flow).
- **Eligible items**: Unsold items that have **"donate if not sold"** (`donate_if_unsold === true`) and are still in a status that can be donated (e.g. `for_sale` or `checked_in`), and not already `donated` or `picked_up`.
- **Behavior**: One action (e.g. "Mark all eligible unsold as donated") that bulk-updates those items to `donated`.
- **Notification**: Sellers should receive in-app notifications when their items are marked as donated (same as single-item flow; bulk may trigger multiple notifications or one summary, TBD).

---

## 3. References

- Implementation: `packages/organizer-app/app/(event)/pickup/index.tsx`
- Payment APIs: `packages/shared/api/payouts.ts` (`markItemAsPaid`, `markSellerItemsAsPaid`, `getSellerPaymentStatus`, etc.)
- Item status: `packages/shared/api/items.ts` (`updateItemStatus`, `processDonations` for reference)
- Phase 3.5 tasks: `DEVELOPMENT_PLAN.md` § 3.5.1–3.5.3

---

## 4. Out of scope for this doc

- Exact copy and placement of "Seller has presented their ID" (e.g. button vs link).
- Whether bulk-donate lives in Pickup UI, Reports, or Event-close screen (design decision: admin post-event; location TBD).
- Format and channel of in-app notifications (in-app only per above; implementation in notification system).
