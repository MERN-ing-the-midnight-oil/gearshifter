# Gear Swap App - Development Plan

> **Related documents**: [APP_DESCRIPTION.md](./APP_DESCRIPTION.md) (architecture and features), [README.md](./README.md) (setup, env, deployment).

This plan is for **one maintainer** working **on and off** (for example every few weeks). It is a map and a checklist, not a contract to finish “Phase N” before touching “Phase N+1.” When you return after a gap, start from **[Returning after a break](#returning-after-a-break)** and the **session handoff** block, then pick a small vertical slice from **Suggested next work**.

---

## Returning after a break

Do this before writing new code (about **10–20 minutes**):

1. **Sync repo** — `git pull` (note any migration or `yarn.lock` changes).
2. **Dependencies** — if `package.json` / lockfile changed: `yarn install` from repo root.
3. **Supabase** — `supabase start` (local) or confirm linked remote; run or review new migrations if any. **Hosted project ref:** `spozqnkfwltgxqrokpaj` (Dashboard → Settings → General; API URLs use `https://spozqnkfwltgxqrokpaj.supabase.co`).
4. **Types** — after DB changes: `supabase gen types typescript --local > packages/shared/types/supabase.ts` (or your linked project equivalent).
5. **Env** — `.env` / `packages/*/.env` still match [`.env.example`](./.env.example) and [README.md](./README.md) **Environment Variables**.
6. **Smoke run** — `yarn dev:both` (or `yarn seller:start` + `yarn org:start`); sign in, open one seller screen and one organizer screen.

If something fails, fix tooling/env first; otherwise you will doubt your own code.

### Session handoff *(edit when you stop for the day)*

Fill this in **when you park** so “future you” has no blank page:

- **Last session (date):**
- **What shipped / changed:**
- **Next session: start with** *(one concrete task, e.g. “photo upload: storage bucket RLS”)*:
- **Open questions / risks:**

---

## Quick snapshot *(high level; verify in repo if unsure)*

<a id="quick-snapshot"></a>

| Area | State |
|------|--------|
| DB / migrations | Mature schema; **org-centric tenancy**; **`events.archived_at`** for soft-archive after pickup; **public read** policies on `events` / `organizations` and **swap registration field definitions + page settings** so invite links work before sign-in; **seller dashboard JWT scope** in `app_metadata.seller_dashboard_event_id` + strict RLS on seller paths (items, payouts, transactions, swap registrations, org-scoped catalog reads) — chain includes `20260503120000`, `20260503140000`, `20260504120000`, **`20260504180000`** (org staff `SELECT` sellers for org events), **`20260505120000`** (fix `sellers`↔`items` RLS recursion for org-linked seller reads), **`20260506140000`** (optional **check-in photo** columns + private Storage bucket `item-check-in-photos`) (see [§2.2.0](#220-one-dashboard-per-seller-per-event-per-session)) |
| Shared API | Auth, sellers, events, items, transactions, payouts, orgs, exports, etc. largely wired; **no** global seller `getEvents` / `getUpcomingEvents` / `getCurrentEventForSeller` (removed); **`syncSellerDashboardEventToAuthSession`** / **`clearSellerDashboardEventFromAuthSession`** (`sellerDashboardSession.ts`); **`itemCheckInPhotos.ts`** for organizer check-in capture + signed URLs |
| Seller app | **Phone OTP** is the primary seller path with **`postAuthRedirect`** from organizer links; **one dashboard per event per auth session** (no multi-event carousel, no browse-all-events screen); main stack is **Home + My Items + Notifications + Profile** scoped to linked event (`AsyncStorage` + JWT via Edge); **Home** can show **`StaffSellerQrSection`** (seller `qr_code` for staff to scan in Organizer check-in); event register / add-item with **registration window** + **archived** guards; **Expo web** (`yarn seller:web`) for invite URLs when origin is configured |
| Organizer app | Dashboard stack + **`OrganizerBreadcrumbs`** for wayfinding, **event archive** (eligibility by pickup/shop close), **seller invite panel** (QR + native/web URLs via `shared` link builders + optional `EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN`), **InlineWebCalendar** on web for date-heavy event screens, event flows, stations, check-in (**optional item photo** on **`check-in/item-details.tsx`**), POS, **pickup**, **reports**, **staff accounts** + `create-staff-account`; gear tag screens share **`tagTemplateFields`** helpers; **Expo web** (`yarn organizer:web`); **thermal printing** native-class |
| Marketing site | Static **`consignly-www/`** (Consignly positioning + **Privacy** / **Terms** pages linked from the landing `index.html`) — deploy separately from Expo apps |
| Edge Functions | **Hosted ref `spozqnkfwltgxqrokpaj`.** In repo / deployed: `create-seller`, `create-staff-account`, `notify-seller-on-sale`, `exchange-seller-session`, `auth-send-sms`, **`set-seller-dashboard-event`**, **`clear-seller-dashboard-event`** (JWT `seller_dashboard_event_id`); dev-only `dev-phone-session-bypass` when enabled; broader SMS/email blast pipelines not built as named in older plans |
| Push | Expo push + sale notification path (see README) |
| Realtime | Mostly pull-to-refresh / refetch; no full live subscriptions across the board |
| Offline | Not started |
| Commercial SaaS | **Not started** — no subscription/billing/org lifecycle flags in schema yet; org self-serve signup exists; selling to many orgs will need billing + policy tightening (see same section) |

---

## Suggested next work *(pick one per session)*

These match “back burner but moving” — each is a **bounded** slice:

1. **Seller auth polish** — Phone OTP + profile + `postAuthRedirect` + JWT dashboard scope are **shipped**; finish **opaque-token** entrypoints and SMS copy, regression matrix vs invites, and any remaining legacy email paths you still want to support for tests only.
2. **Seller invite + registration path** — Confirm migrations applied; set `EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN` where you host seller web; test anon → event/register → sign-up → form loads fields → submit; test native deep link; confirm archived events and closed registration windows show the right blocking copy.
3. **Production hardening** — Deploy functions, custom SMTP ([`docs/supabase-custom-smtp.md`](./docs/supabase-custom-smtp.md)), `STAFF_INVITE_REDIRECT_URL`, EAS builds; run one full event dry-run on staging.
4. **Multi-tenant / B2B SaaS hardening** (when selling beyond a pilot) — Billing or `organization` lifecycle fields; revisit **broad public `events` SELECT`** if a customer needs hiding non-invited events ([§1.1.5](#saas-multi-tenancy)); tighten permissive org `INSERT` RLS; confirm **`sellers`** RLS covers org-staff paths (guest seller, `getSellerById`). **Seller cross-event browse** is removed; seller row access is **JWT-scoped to one `event_id` per session** ([§2.2.0](#220-one-dashboard-per-seller-per-event-per-session)).
5. **Photo uploads** (post-MVP, high user value) — Seller add-item + organizer item views; **organizer check-in reference photos** are started (`item-check-in-photos` bucket + `items.check_in_photo_*`; see §3.3.4).
6. **Seller item detail / edit** — Dedicated `item/[id]` (or equivalent) if you want parity with organizer edits without only using add-item flows.
7. **Label printing polish** — Finish retries, edge cases, and device matrix (Zebra/Brother) under real Wi‑Fi.
8. **Web UX for sellers / org** (optional slice) — Responsive or desktop-first flows on **Expo web** for long forms and reports before any split to a separate web framework.
9. **Housekeeping** — Mark this file’s checkboxes when you finish a slice; grep for stale references to **`(tabs)/events`** / browse-all-events seller UX (README and any stray comments should match the **stack** under `(tabs)/` with Home, Items, Notifications, Profile only).

### Recommended build, ship, and test order

Use this as a **default sequence** when you are not firefighting a bug. Each step has a clear “done when”:

| Order | Focus | Build / configure | Test (manual is enough until you add E2E) |
|------:|--------|-------------------|---------------------------------------------|
| 1 | **Data layer** | `supabase start`, apply migrations, regen `packages/shared/types/supabase.ts` | From SQL or Studio: policies allow org staff CRUD; anon can read event + org + swap field defs where intended |
| 2 | **Env & auth** | Root `.env` / per-app env aligned with [`.env.example`](./.env.example); custom SMTP in hosted Supabase when not local; seller SMS provider configured in Supabase Auth | Organizer login, forgot password, **staff invite** (`create-staff-account`); seller phone OTP request + verify |
| 3 | **Seller acquisition** | `EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN` if using web invites | Open web invite **without** session → see event + registration form → create account → land on intended route (`postAuthRedirect`); repeat on device with native link |
| 4 | **Org event lifecycle** | Create/edit event (including **web calendar** if you use organizer web), manage screen | Registration open/close dates vs `status === 'registration'`; **archive** only after eligibility rule; archived hidden from normal seller flows |
| 5 | **Day-of stations** | Native organizer build with printer | Check-in (guest + returning), **labels**, POS sale, pickup paid/unpaid — one happy path each |
| 6 | **Reporting & wrap-up** | — | Reports hub CSV + donations closure; post-event inventory if you use it |
| 7 | **Release** | Deploy Edge Functions, EAS builds, secrets | Staging dry-run mirroring production URLs and SMTP |

---

## Status legend

| Tag | Meaning |
|-----|--------|
| **DONE** | Implemented for current product intent; may still need polish |
| **PARTIAL** | Works but incomplete vs ideal spec or missing edge cases |
| **IN PROGRESS** | Active WIP; safe to continue here |
| **MAINTENANCE** | Recurring task (e.g. regen types), not a greenfield |
| **NOT STARTED** | No meaningful implementation yet |
| **DEFERRED** | Intentionally not pursuing soon; optional revival |

---

## Development priorities

### Must-have (MVP)

1. Seller registration and item submission  
2. Check-in with label printing  
3. POS with sale marking (no payment processing)  
4. Pickup with payment status tracking (mark items as paid)  
5. Basic notifications  
6. Core reports  

### Should-have (post-MVP)

1. Offline support  
2. Advanced reporting (extra breakdowns, separate report screens, scheduled exports)  
3. Photo uploads  
4. Enhanced payment tracking features  
5. **B2B SaaS operations** — Per-org billing or subscription state, stricter org onboarding, audit-friendly exports and admin actions (overlaps [§1.1.5](#saas-multi-tenancy))  

### Nice-to-have (future)

1. **Dedicated web app** (e.g. Next.js) if Expo web stops being enough; today both apps already expose **Expo web** for browser use  
2. Advanced analytics  
3. Multi-language support  
4. AI features  

---

## Phase 1: Core infrastructure and authentication

### 1.1 Database and backend

#### 1.1.1 **DONE** — Migrations applied

- Review `supabase/migrations/` when returning after DB work elsewhere (recent examples: `events.archived_at`, public read for invites + swap registration catalog, backfill default registration fields, **seller dashboard JWT RLS**, **org `sellers` SELECT** without recursion, **`item-check-in-photos` Storage** + `items.check_in_photo_*`)  
- Test connectivity from both apps  

#### 1.1.1a **DONE** — `items.paid_at` (and related payout flow)

#### 1.1.2 **MAINTENANCE** — TypeScript types from Supabase

- After schema changes: `supabase gen types typescript --local > packages/shared/types/supabase.ts`  
- Run `yarn type-check` at root when you touch types or shared APIs  

#### 1.1.3 **PARTIAL** — Edge Functions and Storage

- **In repo:** `create-seller`, `create-staff-account`, `notify-seller-on-sale`, `exchange-seller-session`, `set-seller-dashboard-event`, `clear-seller-dashboard-event`, `auth-send-sms`, `dev-phone-session-bypass` (dev/staging only)  
- **Storage (migration-managed):** private bucket **`item-check-in-photos`** for optional staff-captured reference images at check-in; app uses signed URLs (`packages/shared/api/itemCheckInPhotos.ts`)  
- **Not built as originally named:** generic `send-notification` (SMS/email), `generate-reports` server export — some behavior lives in app + RPC/CSV instead  

#### 1.1.4 **PARTIAL** — Supabase Auth configuration

- **Organizer:** email/password, forgot/reset password flows  
- **Seller app:** migration in progress to Supabase native **phone OTP** (`signInWithPhone`, `verifyPhoneOTP`) and away from email verification requirements  
- Production: SMS provider, email templates, and **custom SMTP** for reliable invites/resets  

<a id="saas-multi-tenancy"></a>

#### 1.1.5 **PARTIAL** — Multi-tenancy and SaaS (B2B)

**Tenant root:** **`organizations`**; **`admin_users`** = staff linked to `auth.users` with `organization_id`, `is_org_admin`, and `permissions` (stations + optional admin capabilities). **RLS** uses `SECURITY DEFINER` helpers (`user_is_org_user_for_org`, `org_user_can_access_event`, etc.) so org-scoped data is enforced in Postgres, not only in the app.

**Already aligned with selling to many orgs:** event-scoped tables gated via org membership; staff invites via **`create-staff-account`** Edge Function (service role, JWT-checked).

**Follow-up when commercializing:**

| Topic | Note |
|--------|------|
| Billing / plan state | No first-class subscription row or flags on `organizations` yet; add when you integrate Stripe (or similar) and gate writes or features |
| Org creation | Policy allows authenticated users to insert `organizations` (bootstrap for self-serve signup); review tighten (invite-only, checkout-gated, or server-only) for production abuse control |
| `admin_users` shape | Today effectively **one org per staff login** (`get_user_organization_id`-style helpers); multi-org staff needs a membership model later |
| Seller ↔ org privacy | **Done (seller app):** removed stack “browse all events” and **RLS seller browse-all** policy; seller **items / payouts / transactions / swap registrations / catalog** require JWT `seller_dashboard_event_id` matching the row’s event (no null-claim fallback). **Still broad:** public `events` / `organizations` read for invite links — tighten with row flags or narrower `authenticated` policies if a customer requires hiding events from non-invitees |
| Seller ↔ another event/org | **By design:** same phone user can sell at **another** event only via a **new sign-in session** (new OTP or new opaque-token flow) so the JWT carries a different `seller_dashboard_event_id`; not a single global “my events” dashboard |
| `sellers` RLS | Policies center on **own profile** (`auth_user_id = auth.uid()`); verify org-staff paths (guest seller create, `getSellerById` for check-in) against production RLS—add org-scoped policies or Edge/RPC if anything relies on gaps |

### 1.2 Shared API layer

Items **1.2.1–1.2.7** remain **DONE** at a high level (`auth`, `sellers`, `events`, `items`, `transactions`, `payouts`, `organizations`).

### 1.3 Shared utilities

#### 1.3.1 **DONE** — QR code utilities  

#### 1.3.2 **DONE** — Price reduction utilities  

#### 1.3.3 **PARTIAL** — Formatters (`packages/shared/utils/formatters.ts`)

- Has helpers (e.g. UUID check, label time formatting)  
- Broader currency / phone / item-number formatting can still be centralized here  

#### 1.3.4 **DONE** — Event workflow helpers

- `eventArchiveEligibility.ts` — when staff may archive  
- `eventRegistrationWindow.ts` — seller swap registration window vs status + `archivedAt`  
- `qrCode.ts` — seller event deep links and web invite URLs  

---

## Phase 2: Seller app core features

### 2.1 Authentication

#### 2.1.1 **PARTIAL** — Seller login migration (`packages/seller-app/app/(auth)`)

- **Shipped:** phone entry (`login.tsx`) → OTP verify (`verify-phone.tsx`) → optional profile (`complete-profile.tsx`); `postAuthRedirect` preserved via route params; **JWT dashboard scope** synced after sign-in when redirect includes `/event/<uuid>/…` (`extractEventIdFromSellerRedirect` + `set-seller-dashboard-event` + `refreshSession`); sign-out clears scope (`clear-seller-dashboard-event` + local storage)  
- **Still to do:** durable seller opaque-token **product UX** end-to-end (SMS copy, hosted `/seller` handler passing **`eventId`** into `signInWithSellerOpaqueToken` when the org knows the event), token rotation metadata, full regression matrix vs invite links  
- Keep organizer email/password auth unchanged  

#### 2.1.2 **PARTIAL** — Dedicated SMS verify screen (`verify-phone.tsx`)

- OTP + resend wired to `signInWithPhone` / `verifyPhoneOTP`  
- Polish: countdown, paste-from-SMS UX, clearer rate-limit copy  

#### 2.1.3 **PARTIAL** — Seller signup/profile completion

- `signup.tsx` is a **compat redirect** to phone sign-in (deep links still work)  
- New sellers finish in `complete-profile.tsx` (name required, email optional; DB placeholder email when omitted)  

#### 2.1.4 **IN PROGRESS** — Phone-auth migration checklist (seller only)

- [ ] Add DB support for durable seller access token (high-entropy) and rotation metadata  
- [x] Add API helpers: find/create/link seller by normalized phone after OTP session (`resolveSellerAfterPhoneSignIn`, `createSellerAfterPhoneProfile`, `normalizePhoneE164US`)  
- [x] Add seller auth screens for phone request + OTP verify  
- [x] Preserve invite redirects (`redirect` / `postAuthRedirect`) across OTP flow  
- [x] **One dashboard per event per session:** `app_metadata.seller_dashboard_event_id` + strict seller RLS; client `setSellerDashboardEventId` / `useSellerScopedEventId`; removed browse-all-events UI and legacy “infer event from latest item” fallback  
- [ ] Keep walk-up and self-serve sellers on identical downstream shape *(guest phone claim RLS migration added; apply + test with real walk-up data)*  
- [ ] Add recovery path: lost link/new phone -> OTP -> same seller -> reissue permanent link  
- [x] Remove seller email/password-only assumptions from seller primary UX *(legacy `signUpAsSeller` remains for scripts/tests only)*  
- [ ] Regression test seller register/add-item/check-in QR lookup with organizer permissions unchanged  

### 2.2 Event browsing and registration

<a id="220-one-dashboard-per-seller-per-event-per-session"></a>

#### 2.2.0 **DONE** — One dashboard per seller **per event** (per **auth session**)

- **Product rule:** The seller **home** (`(tabs)/index`) and **My Items** (`(tabs)/items`) apply to **a single org event** chosen for that session — not a multi-event hub. Selling at **another** event (or another org’s event) uses a **new sign-in** so Supabase issues a JWT with a different `seller_dashboard_event_id`.  
- **Client:** `useSellerScopedEventId` resolves scope from **deep link `?eventId=`** or **`AsyncStorage`** (`sellerDashboardEventStorage`); opening register / event detail / add-item persists the event id and calls **`syncSellerDashboardEventToAuthSession`**.  
- **Server:** Edge **`set-seller-dashboard-event`** / **`clear-seller-dashboard-event`**; Postgres helpers `auth_seller_dashboard_event_id()`, `seller_dashboard_event_scope_matches()`, `organization_id_for_seller_dashboard_event()`; seller RLS on `items`, `transactions`, `payouts`, `seller_swap_registrations`, and org-scoped catalog reads **requires** a matching JWT claim (strict migration `20260504120000` — no “null claim = see all my items” path).  
- **Removed:** Stack screen **`(tabs)/events.tsx`** (browse-all upcoming events); shared hooks **`useEvents` / `useUpcomingEvents`** and APIs **`getEvents`**, **`getUpcomingEvents`**, **`getCurrentEventForSeller`**, **`getSellerMostRecentItemEventId`**.  
- **Not done here:** Narrowing **public** `events` SELECT for authenticated users ([§1.1.5](#saas-multi-tenancy)); wiring **every** opaque-token entrypoint to pass **`dashboardEventId`** (`buildSellerDashboardUrl` supports optional `eventId` query param).  

#### 2.2.1 **REMOVED** — Browse-all events list (`(tabs)/events.tsx`)

- **Superseded** by §2.2.0; sellers discover sales only via **organizer invite links** (and deep routes under `event/[id]/…`).  

#### 2.2.2 **PARTIAL** — Event details (`event/[id]/index.tsx`)

- Core UX done; keep aligned with **registration window** (`isSellerSwapRegistrationWindowOpen`) and **`archivedAt`** behavior  

#### 2.2.3 **PARTIAL** — Event registration (`event/[id]/register.tsx`)

- Dynamic fields + page settings + category picker wired; **depends on public read policies** for pre-auth web invites — regression-test after any RLS change  
- After OTP, **`setSellerDashboardEventId`** re-runs when **`user?.id`** appears so JWT scope matches the page’s `eventId` under strict RLS  

### 2.3 Item management

#### 2.3.1 **DONE** — Items list (`(tabs)/items.tsx`)

- Lists **only items for the linked dashboard event** (`useItemsByEvent` + scoped event id); empty state when no event is linked  

#### 2.3.2 **DONE** — Add item (`event/[id]/add-item.tsx`)

- Photo upload still a future enhancement inside this flow  
- Respect **archived** / locked event rules as enforced in API and UI  

#### 2.3.3 **NOT STARTED** — Dedicated item detail screen (e.g. `item/[id].tsx`)

- Today, flows center on lists + add-item; add if you want deep links and richer edit UX  

#### 2.3.4 **NOT STARTED** — Dedicated item edit screen (e.g. `item/edit.tsx`)

- May merge with 2.3.3 as one route with edit mode  

### 2.4 Seller home and profile

#### 2.4.1 **DONE** — Home / event view (`(tabs)/index.tsx`)

- Single-event header (“Your sale”), **“Your items for sale”** list, pre-register CTA; **`StaffSellerQrSection`** surfaces `sellers.qr_code` for staff check-in when present; no multi-event carousel; aligns with §2.2.0  

#### 2.4.2 **PARTIAL** — Profile (`(tabs)/profile.tsx`)

- Account info and sign-out; no dedicated full-screen seller QR workflow here yet  

#### 2.4.3 **DONE** — Notifications (`(tabs)/notifications.tsx`)

- Sale history / sale alerts (push path documented in README)  

### 2.5 QR code display

#### 2.5.1 **PARTIAL** — Seller QR for staff (`StaffSellerQrSection` on home)

- **Shipped on Home:** QR + copy for `sellers.qr_code` so event staff can scan in Organizer check-in  
- **Optional later:** dedicated full-screen `qr-code.tsx` if you want the same UX from Profile or a larger format  

---

## Phase 3: Organizer app core features

### 3.1 Authentication and organization

#### 3.1.1 **DONE** — Admin login, forgot/reset password  

- **Dev-only:** `/(auth)/test-login` for Axel-style test admin (do not ship to production stores without gating or removal)  

#### 3.1.2 **PARTIAL** — Organization selection / creation  

- Dashboard assumes **one org per signed-in staff user** via `admin_users`; creation paths: signup (`signUpAsAdmin`), scripts, Edge-assisted staff  
- **Future:** multi-org picker only if you introduce **memberships** (same user in several `organizations`)  

### 3.2 Event and org settings

#### 3.2.1 **PARTIAL** — Event list / dashboard (`(dashboard)/index.tsx`)

- Lists and navigation **DONE**; **archive eligible events** via `archiveEvent` + `isEventArchiveEligible` — verify copy and disabled states vs real pickup/shop-close data  

#### 3.2.2 **PARTIAL** — Create event (`(dashboard)/create-event.tsx`)

- Functional create/edit; **`InlineWebCalendar`** on **web** for date fields — smoke on `yarn organizer:web`  

#### 3.2.3 **DONE** — Org settings screens (stack under `(dashboard)/`)

- Categories, field definitions, swap registration fields, gear tags, price reduction, commission rates  
- **Post-event inventory:** `(dashboard)/post-event-inventory.tsx`  
- **Staff accounts:** `(dashboard)/staff-accounts.tsx` (invites via `create-staff-account`)  
- *Removed from tree:* `swap-registration-page.tsx` (use shared settings APIs if page customization is separate)  

#### 3.2.4 **DONE** — Seller invite surface on event manage (`SellerEventInvitePanel` in `(event)/manage.tsx`)

- QR + share + copy for native and optional **web invite origin**; uses `buildSellerEventDeepLink` / `buildSellerEventWebInviteUrl` from `shared`  

### 3.3 Check-in station

#### 3.3.1 **DONE** — Stations (`(event)/stations.tsx`)  

#### 3.3.2 **DONE** — Check-in main (`check-in/index.tsx`)  

#### 3.3.3 **DONE** — Guest registration (`check-in/register-guest.tsx`)  

#### 3.3.4 **IN PROGRESS** — Check-in workflow (print + optional photo)

- **Label printing:** Review → print → check-in; hardware variance and failure recovery (`hardware/printer.ts`, `tagPrinter.ts`)  
- **Optional check-in photo:** `check-in/item-details.tsx` can attach a reference image (stored under `item-check-in-photos/{item_id}/…`, columns `check_in_photo_storage_path` / `check_in_photo_captured_at`); extend to other check-in screens, POS cross-check UX, and retention policy as needed  

### 3.4 Point of sale

#### 3.4.1–3.4.3 **DONE** — POS screen, sale confirmation behavior, price reduction at scan time (`pos/index.tsx` + shared logic)  

### 3.5 Pickup station

**Design notes:** [docs/PICKUP_STATION_DESIGN.md](./docs/PICKUP_STATION_DESIGN.md)

#### 3.5.1 **DONE** — Pickup main (`pickup/index.tsx`)

- Scan and search-by-name, payout summary, paid/unpaid flows as implemented  

#### 3.5.2 **DONE** — Payment tracking (mark paid, payouts, check number where applicable)  

#### 3.5.3 **PARTIAL** — Unsold / donation / pickup edge flows  

- Many paths exist (e.g. donation certification, bulk operations); keep tightening vs org policy docs  

### 3.6 Reports

#### 3.6.1 **PARTIAL** — Reports hub (`reports/index.tsx` only)

- Event stats, donations closure, consignee CSV export (see README payment philosophy)  
- **Not separate routes:** `reports/sales.tsx`, `reports/payments.tsx`, `reports/inventory.tsx` — fold future breakdowns into this screen or add routes when needed  

---

## Phase 4: Hardware integration

### 4.1 Printer

#### 4.1.1 **IN PROGRESS** — `hardware/printer.ts` (Zebra/Brother, transport)  

#### 4.1.2 **PARTIAL** — `tagPrinter.ts` / templates  

#### 4.1.3 **PARTIAL** — `components/PrinterConnection.tsx`

- Connection UI and test print exist; print queue / advanced diagnostics still optional  

### 4.2 Scanner

#### 4.2.1 **NOT STARTED** — Shared reusable `QRCodeScanner` component (if you want one abstraction across apps)  

#### 4.2.2 **PARTIAL** — Scanner usage in organizer stations (per-screen integration, error UX)  

---

## Phase 5: Notifications and real-time

### 5.1 Notifications

#### 5.1.1 **PARTIAL** — Push (Expo)

- Tokens and seller sale pushes wired for the happy path; document and test on device + EAS  

#### 5.1.2 **NOT STARTED** — SMS (Twilio / Supabase SMS) for sales or reminders  

#### 5.1.3 **NOT STARTED** — Email (Resend / templates) for sales or paid status  

#### 5.1.4 **PARTIAL** — Triggers

- **Sale:** `notify-seller-on-sale`  
- **Pickup / paid / batch:** still mostly app-driven, not separate Edge notification pipelines  

### 5.2 Real-time updates

#### 5.2.1–5.2.2 **NOT STARTED** — Broad Supabase Realtime subscriptions for inventory and dashboards  

---

## Phase 6: Offline support

All items **NOT STARTED** (queue, sync, conflict UI). Treat as a dedicated initiative, not a side task between meetings.

---

## Phase 7: Testing and polish

Use this when stabilizing for a real event or store submission — **manual test scripts** per station are often enough before automated tests.

#### 7.1.x **NOT STARTED** — Formal automated E2E (Detox/Maestro/etc.)  

#### 7.2.x **PARTIAL** — UI polish (ongoing per screen)  

#### 7.3.x **NOT STARTED** — Performance pass (indexes, RLS review, image strategy)  

- Include **SaaS / tenancy** checks from [§1.1.5](#saas-multi-tenancy) (org insert, public `events` read, guest seller paths) when you harden for many orgs on one project; seller **row** RLS for items is now **JWT-scoped** ([§2.2.0](#220-one-dashboard-per-seller-per-event-per-session))  

#### 7.4 **MAINTENANCE** — Manual regression order

- Follow **[Recommended build, ship, and test order](#recommended-build-ship-and-test-order)** before a real event; add a short checklist row if your org has a custom policy (donations, payout method, etc.)  

---

## Phase 8: Deployment and documentation

#### 8.1.1 **PARTIAL** — Production Supabase, secrets, SMTP  

#### 8.1.2 **PARTIAL** — EAS production builds (`eas.json` at repo root)  

#### 8.1.3 **NOT STARTED** — Store submission and review cycles  

#### 8.2 **PARTIAL** — Docs (README + APP_DESCRIPTION + this file); user-facing PDFs/guides optional  

---

## Phase 9: Future enhancements (stretch)

- **Built-in card processing (Stripe/Square)** — stretch for *consignor payouts*; many orgs stay external  
- **B2B subscriptions (Stripe Billing, etc.)** — for *your* SaaS revenue per org; separate from in-event payment tracking  
- **Photo uploads** — overlaps Should-have; centralize spec when you start  
- **Dedicated web property** (marketing site + app subdomain), **i18n**, **heavy analytics** — after core flows are reliable; **browser UX** can start earlier via Expo web ([Quick snapshot](#quick-snapshot))  

---

## Development notes

### Refactors and conventions (recent)

- **Seller dashboard scope:** One **event** per **Supabase session** via `app_metadata.seller_dashboard_event_id` + strict RLS; client `packages/seller-app/lib/sellerDashboardEventStorage.ts`, `useSellerScopedEventId.ts`, shared `sellerDashboardSession.ts`; Edge `set-seller-dashboard-event` / `clear-seller-dashboard-event`; migrations `20260503120000_seller_dashboard_event_jwt_rls.sql`, `20260503140000_drop_legacy_seller_item_update_policy.sql`, `20260504120000_seller_rls_strict_dashboard_claim.sql`.  
- **Org staff ↔ `sellers` reads:** `20260504180000_org_select_sellers_for_org_events.sql` plus **`org_user_can_select_seller_row`** in `20260505120000_fix_sellers_org_policy_recursion.sql` — avoids infinite RLS recursion when org policies join through `items`.  
- **Check-in photos:** `20260506140000_item_check_in_photo.sql` + shared **`itemCheckInPhotos`** API; organizer UI wired from **`check-in/item-details.tsx`**.  
- **Shared tag template field metadata:** `packages/shared/utils/tagTemplateFields.ts` — used by organizer gear tag / preview flows to stay aligned with template JSON.  
- **Organizer navigation:** `packages/organizer-app/components/OrganizerBreadcrumbs.tsx` — breadcrumbs on dashboard/event stacks where enabled.  
- **Event status:** `active` | `closed` plus `items_locked` — see [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md).  
- **Event archive:** `events.archived_at` set from organizer dashboard when `isEventArchiveEligible`; seller flows treat archived events as closed.  
- **Staff:** `admin_users` with `role`, `is_org_admin`, `permissions.stations`, and optional admin-capability flags used by staff creation flows; organizer **Staff Accounts** screen + `create-staff-account` Edge Function.  
- **Stations:** `stations.tsx` is the mode picker; access gated by `permissions` and `is_org_admin`.  
- **Organizer dashboard:** Stack under `app/(dashboard)/` (not a nested `(tabs)` group in the current tree).  
- **Payment philosophy:** App tracks sold / paid / payouts for operations; org runs actual money movement — see README.  
- **Product shape (web vs native):** treat **keyboard-heavy seller listing** and **org reports** as first-class **browser** experiences when you prioritize them (Expo web today); keep **thermal printing** on **native-class** builds or a dedicated print station. Selling to many orgs is primarily a **web SaaS** motion (billing, contracts) even if you keep store apps as optional clients.  
- **Tenancy:** see [§1.1.5](#saas-multi-tenancy) for schema/RLS alignment and intentional gaps to close before commercial multi-org rollout.  

### Keeping the plan honest

1. After a meaningful session, update **Session handoff** at the top and any **PARTIAL → DONE** lines you touched.  
2. Prefer **one vertical slice** (e.g. “pickup donation copy + RLS check”) over scattering edits unless fixing regressions.  
3. If APP_DESCRIPTION or README drift from behavior, update them in the same PR or the next session so “return after weeks” stays cheap.  

---

## Related documentation

- [APP_DESCRIPTION.md](./APP_DESCRIPTION.md)  
- [README.md](./README.md)  
- [consignly-www/](./consignly-www/) — static **Consignly** marketing pages (`index.html`, `privacy-policy.html`, `terms.html`)  
- [docs/EVENT_STATUS_REFACTOR_REVIEW.md](./docs/EVENT_STATUS_REFACTOR_REVIEW.md)  
- [docs/supabase-custom-smtp.md](./docs/supabase-custom-smtp.md)  
- [docs/PICKUP_STATION_DESIGN.md](./docs/PICKUP_STATION_DESIGN.md)  
