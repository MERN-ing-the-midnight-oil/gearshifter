# Project UI outline

**Interactive outline (styled, drill-down by section):** open [`Outline.html`](./Outline.html) in your browser (double-click the file, or from the repo root: `open Outline.html` on macOS).

Gearshifter is split into two Expo apps: the **organizer** app for staff and swap admins, and the **seller** app for consignors on their phones. Below is a plain-English tour of what people actually see and what they can do on each screen. Route paths and source files are noted so developers can find the code in `packages/<app>/app/`.

---

## Organizer app (`packages/organizer-app`)

### Around the app (not a single screen)

Once you are signed in, you always have a way to jump back: the **Home** control sends you to the main dashboard. If you tap a password-reset link from email, the app listens for Supabase’s recovery event and drops you on **reset password** so you can pick a new password without getting bounced away by the normal “already logged in” logic.

### Root entry — `/` → `app/index.tsx`

You mostly see a brief loading state while the app figures out who you are. There is nothing to tap here on purpose: as soon as auth settles, you are sent either to the **dashboard** if you already have a session, or to **login** if you do not.

### Admin login — `/(auth)/login` → `(auth)/login.tsx`

This is the standard email-and-password screen for organizer staff. You see the usual fields, a sign-in button, and links if you need to create an account or forgot your password. In development, there are shortcuts to fill a known test admin, and a special query flag can force a sign-out so you can see the form even when a session exists.

### Test login — `/(auth)/test-login` → `(auth)/test-login.tsx`

Think of this as a labeled side door for a specific demo tenant (Axel / Bellingham). You see explanatory copy about how that account was created and you can sign in with the pre-filled credentials. It is meant for staging and demos, not everyday volunteers.

### Create organizer account — `/(auth)/signup` → `(auth)/signup.tsx`

New swap organizations start here. You work through a form that collects your name, email, password, and the organization name and URL slug. When you submit, you are registering both yourself as an admin and the org shell you will run events under.

### Forgot password — `/(auth)/forgot-password` → `(auth)/forgot-password.tsx`

You type the email tied to your organizer account and ask for a reset. The app tells you to check your inbox; after you acknowledge, it sends you back toward login. The actual reset happens when you follow the link on a device that opens **reset password**.

### Reset password — `/(auth)/reset-password` → `(auth)/reset-password.tsx`

You land here from the recovery link (or an equivalent recovery session). You see two password fields and a save action. Once the new password sticks, you are nudged back into the signed-in world, usually the dashboard.

### Organizer home / events — `/(dashboard)` → `(dashboard)/index.tsx`

This is the hub after login. You see your organization name, every **event** you run (with dates and status), and a grid of shortcuts into org-wide settings—things like categories, gear tags, commission, staff, and so on. For each event you can jump into **manage**, copy the **seller registration** link for the web, archive or delete an event (with confirmations), or pull to refresh if the list feels stale. Sign out lives here too.

### Create event — `/(dashboard)/create-event` → `create-event.tsx`

You are walking through a long form: event name, dates, when registration opens and closes, shop hours, drop-off windows and location, status, and related options—with date and time pickers that behave sensibly on both web and native. Saving creates the new event record so it can show up on the home list.

### Categories — `/(dashboard)/categories` → `categories.tsx` (admins only)

Volunteers without admin rights are gently redirected away. Admins see every **item category** the org uses, and can open modals to add or edit a category, wire it to a **gear tag template**, and define the extra attributes sellers must fill in for items in that category (text fields, numbers, dropdowns, and so on).

### Item fields (org-wide) — `/(dashboard)/field-definitions` → `field-definitions.tsx` (admins only)

Same admin gate as categories. Here you are shaping the **custom fields** that apply to items across the org—labels, field types, which field counts as “price,” which powers automatic price reductions, dropdown choices, and helper text sellers will read later.

### Gear tags — `/(dashboard)/gear-tags` → `gear-tags.tsx` (admins only)

This is the print-design studio: tag dimensions, which data fields print where, QR placement, orientation, and a live **preview** so you are not guessing what will come off the printer. You create, duplicate, tweak, and delete **tag templates** until the physical labels match how your swap runs intake.

### Commission rates — `/(dashboard)/commission-rates` → `commission-rates.tsx` (admins only)

You see simple switches and percentage fields for what the org takes from consignment sales (and vendor-specific commission if you use it). Turning a commission off clears it; turning it on expects a sensible percentage before save.

### Price reduction settings — `/(dashboard)/price-reduction-settings` → `price-reduction-settings.tsx` (admins only)

This answers “who gets to decide mid-event discounts—the org or the seller?” You choose policies for reduction amounts, how many steps are allowed, timing, and optionally constrain which clock times are valid, then save so the seller app and check-in flows respect those rules.

### Seller registration (web) — `/(dashboard)/swap-registration-fields` → `swap-registration-fields.tsx` (admins only)

You are designing the **public registration** experience: which questions appear, required vs optional, suggested presets you can enable in one tap, and the marketing copy (title, welcome message, grouping) around those fields.

### Staff accounts — `/(dashboard)/staff-accounts` → `staff-accounts.tsx`

People who run the floor appear here in a table: org admins vs volunteers, which **stations** each person may use (check-in, POS, pickup, reports), and fine-grained **capabilities** for admins (who can create users, change passwords, manage events, touch money reports, and so on). Admins invite new staff, set initial passwords, and adjust access. A URL flag can drop you straight into “create someone new.”

### Post-event inventory — `/(dashboard)/post-event-inventory` → `post-event-inventory.tsx` (admins only)

After the swap, sometimes gear lives in a spreadsheet in your head—this screen is the structured version. You see rows you have added manually (description, category, size, optional list price), can refresh the list, add another line, or clean up mistakes.

### Manage event — `/(event)/manage` → `manage.tsx`

Pick one event and you are in its control room: edit dates and status, choose which **item types** apply to this event, copy or share the **seller app invite**, peek at who has registered, and hop to **stations** when the doors open. It is the bridge between “planning the swap” and “running the swap.”

### Stations — `/(event)/stations` → `stations.tsx`

You see big friendly tiles for **Check-in**, **POS**, **Pickup**, and **Reports**—but only the ones your account is allowed to open. Tapping a tile takes you into that workflow for the current event id. If nobody gave you station access, you get a clear message instead of dead ends.

### Check-in home — `/(event)/check-in` → `check-in/index.tsx`

Floor staff live here during intake. You can switch between scanning a QR, searching for a seller by name or phone, registering someone new, or—once a seller is selected—seeing **all their items** for this event. Printing tags in bulk and drilling into a single item both start from here.

### Register seller (check-in) — `…/check-in/register-seller` → `register-seller.tsx`

A short form for first name, last name, phone, and email. You use it when someone shows up who is not already in the system; the app tries to match existing sellers by phone so you do not accidentally create duplicates.

### Register guest — `…/check-in/register-guest` → `register-guest.tsx`

For walk-ins without an app history, you confirm you checked **photo ID**, then capture full contact and mailing address. It is a heavier form on purpose because staff are attesting they verified the person in front of them.

### Review items (check-in) — `…/check-in/review-items` → `review-items.tsx`

After you have a seller in context, this is the readout of their line items: each row shows number, description, price, and status. You can jump into **item details**, add another line item, or read off their **seller QR** for them to keep.

### Add item (check-in) — `…/check-in/add-item` → `add-item.tsx`

Staff-facing item entry: every field your org configured shows up in order, plus category picking from the event’s tree. There is a switch for whether this item should **complete check-in now** or stay pending until someone finishes receive steps—handy when the physical item is not in hand yet.

### Item details (check-in) — `…/check-in/item-details` → `item-details.tsx`

This is where intake becomes real: you see the item, its status, and you are asked to **document receipt**—usually a photo on device, or a short written handoff note on web—before you mark it ready for the floor. You can print a single tag, move statuses along, and optionally ping the seller that their gear was checked in.

### Point of sale — `/(event)/pos` → `pos/index.tsx`

Cashier mode. You scan or paste an item QR, confirm you have the right piece of gear (including a peek at the check-in photo if one exists), enter buyer contact and the sale price, then finish the sale. Receipts can go out by **SMS** or as a **QR** flow the buyer scans—whichever fits the line forming behind you.

### Pickup — `/(event)/pickup` → `pickup/index.tsx` (admins only)

End-of-event desk for money and unsold gear. Non-admins are redirected back to **manage**. Admins scan or find a seller, see **payout math** (what sold, what is still owed), mark items or whole sellers as paid, handle **donations**, and move eligible pieces into **organization inventory** when that is part of your workflow.

### Reports — `/(event)/reports` → `reports/index.tsx` (admins only)

A readout of how the event performed: counts and totals, export to **CSV** for consignee-style reconciliation, declaring the event **closed**, and donation-related actions where your rules apply. Volunteers without admin financial access should not see this screen.

---

## Seller app (`packages/seller-app`)

### Around the app

When you are logged in, the app wires up **push notifications** so you can hear about sales. If you are logged out, almost every path sends you to **login**—except someone shares a direct **`/event/...`** link, which still opens so you can read the flyer-style event page before you commit to signing in.

### Login — `/(auth)/login` → `(auth)/login.tsx`

You type a US phone number and request a texted code. In development there may be a bypass so you are not blocked when SMS is flaky. If you arrived from an invite link, a **redirect** parameter quietly brings you back to that event after you authenticate.

### Verify phone — `/(auth)/verify-phone` → `verify-phone.tsx`

Standard “enter the six digits we texted you” step. You can resend if the code expired, and successful verification hands off to whatever screen you still need (sometimes **complete profile**, sometimes straight into the tabs).

### Complete profile — `/(auth)/complete-profile` → `complete-profile.tsx`

First-time sellers see a friendly form for first name, last name, and optionally email. If the system already has a seller row for your account, this screen simply forwards you on—you do not fill it twice.

### Signup (legacy) — `/(auth)/signup` → `(auth)/signup.tsx`

Old bookmarks still hit `/signup`. You only see a spinner for a moment; the app immediately replaces the route with **login** because phone sign-in *is* how new sellers are created now.

### Home / dashboard — `/(tabs)` → `(tabs)/index.tsx`

This is your living room for the **event you care about right now**: your name, phone, seller QR staff can scan, every item you have in that event with color-coded status, rough **payout estimates** after commission, and—when staff have documented check-in—any **check-in notes or photos** you are allowed to see. You can pull to refresh, switch which event you are focused on, jump to your profile, add or edit listings, delete things that are still **pending** (not handed in yet), or sign out.

### My items — `/(tabs)/items` → `items.tsx`

A tighter list of the same inventory for people who live on the second tab. Same statuses and delete rules for pending rows; tapping an item takes you into the add/edit flow when the app allows edits.

### Notifications — `/(tabs)/notifications` → `notifications.tsx`

A chronological feed of **things that sold**: what it was called, what it sold for, what you keep after fees, and when it happened. Pull to refresh when you are killing time between rack visits; the list also refreshes when you return to the tab.

### Profile — `/(tabs)/profile` → `profile.tsx`

Simple self-service: your display name fields and a save button, plus sign out. Signing out also forgets which event you had pinned to the dashboard so the next login starts clean.

### Event landing — `/event/[id]` → `event/[id]/index.tsx`

Anyone with the link sees a polished **event flyer** in the app: host org, schedule, registration window, commission language, pickup times. If registration is open and you are not signed in, you get buttons to **sign in** or **create account** that remember this event. If you are already signed in, you can jump straight to your **dashboard** or start **pre-registering items** for this swap.

### Add or edit item (event) — `/event/[id]/add-item` → `event/[id]/add-item.tsx`

The full seller item builder: pick type/category, fill every field the organizers require, preview how tag-oriented fields line up, and save. If you opened an existing `itemId`, you are editing instead of creating. Saving also pins this event as your “current” one on the home tab when that is helpful.

### Register (legacy URL) — `/event/[id]/register` → `event/[id]/register.tsx`

Printed QR codes from an older flow might still point here. You see a short “taking you to your dashboard” message while the app stores the event id and sends you to the main **tabs** experience—there is no separate in-app registration wizard anymore.

---

## How to read this outline (and the code)

The paragraphs above stay at the level a volunteer lead could skim before training day. They are not exhaustive of every validation message or edge case—that behavior lives in **`packages/shared`** (hooks, Supabase helpers, shared types). When you add a new screen under `app/`, add a short subsection here and mirror it in **`Outline.html`** so the interactive outline stays in sync.
