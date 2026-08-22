# Testing Guide

A practical, step-by-step guide to setting up this app from scratch and verifying that
every feature actually works — not just that it builds. Every command and UI flow below
has been run against a real local instance while writing this doc.

If you just want automated sanity checks, jump to [Automated checks](#automated-checks).
If you want to click through the app yourself, start at [Environment setup](#environment-setup)
and follow [Manual walkthrough](#manual-walkthrough) in order. If you want to script your
own end-to-end tests, see [Writing your own smoke tests](#writing-your-own-smoke-tests).

## Contents

- [Prerequisites](#prerequisites)
- [Environment setup](#environment-setup)
- [Automated checks](#automated-checks)
- [Manual walkthrough](#manual-walkthrough)
  1. [Sign-up, onboarding, and tenant isolation](#1-sign-up-onboarding-and-tenant-isolation)
  2. [Staff, roles, and permissions](#2-staff-roles-and-permissions)
  3. [Products, warehouses, branches](#3-products-warehouses-branches)
  4. [Stock transfers](#4-stock-transfers)
  5. [Sales and payments](#5-sales-and-payments)
  6. [Credit notes and printing](#6-credit-notes-and-printing)
  7. [Customers and debt](#7-customers-and-debt)
  8. [Expenses](#8-expenses)
  9. [Plan limits](#9-plan-limits)
  10. [Automated debt reminders](#10-automated-debt-reminders)
  11. [Branding](#11-branding)
  12. [Billing (Paystack)](#12-billing-paystack)
  13. [Security & accountability](#13-security--accountability)
  14. [Platform admin & support](#14-platform-admin--support)
  15. [Low-stock alerts, branch transfers, and perishable batch tracking](#15-low-stock-alerts-branch-transfers-and-perishable-batch-tracking)
  16. [Business verification (CAC) and account enable/disable](#16-business-verification-cac-and-account-enabledisable)
  17. [Barcode/QR scanning and stock counts](#17-barcodeqr-scanning-and-stock-counts)
  18. [Two-factor authentication (2FA) for Owners and platform staff](#18-two-factor-authentication-2fa-for-owners-and-platform-staff)
  19. [CSV data export (products, customers, sales)](#19-csv-data-export-products-customers-sales)
  20. [Warehouse-level batch tracking](#20-warehouse-level-batch-tracking)
  21. [Purchase orders and suppliers](#21-purchase-orders-and-suppliers)
- [Mobile app](#mobile-app)
- [Writing your own smoke tests](#writing-your-own-smoke-tests)
- [Troubleshooting](#troubleshooting)
- [What this guide can't verify for you](#what-this-guide-cant-verify-for-you)

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (a local install, or Docker — anything reachable at a `DATABASE_URL`)
- For mobile testing: an Expo Go app on a phone, or Xcode/Android Studio for a
  simulator/emulator (see [Mobile app](#mobile-app))

## Environment setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in:

- `DATABASE_URL` — your Postgres connection string
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`

Everything else in `.env.example` (`PAYSTACK_SECRET_KEY`, `TERMII_API_KEY`, `CRON_SECRET`,
`RUNTIME_DATABASE_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`) has a working fallback, "not
configured" path, or sensible default for local testing — see the relevant section below
for what to do about each.

```bash
npx prisma migrate dev
npm run db:seed
npm run dev
```

The app is now running at `http://localhost:3000`. `db:seed` is idempotent — safe to
re-run any time (e.g. after pulling a change that adds a new plan or permission). It also
creates a super-admin login from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`
(`.env.example`'s defaults: `admin@example.com` / `LocalAdmin123!`) — sign in with those
and visit `/admin` immediately, no separate setup step. That's a fixed, predictable
credential deliberately meant for local use only — see
[Platform admin & support](#14-platform-admin--support) below, and never set those two
variables to anything real outside local dev.

### Least-privilege database role (optional locally, required in production)

The app is designed to connect at runtime as a role that structurally cannot tamper with
the append-only audit trail — see [Security & accountability](#13-security--accountability)
to actually verify this. To set it up:

```bash
# psql doesn't understand Prisma's `?schema=public` query parameter, so
# it has to be stripped from the URL first — every psql example in this
# doc does the same.
psql "${DATABASE_URL%%\?*}" -c "CREATE ROLE inventory_runtime WITH LOGIN PASSWORD '<pick a password>';"
npm run db:grants
```

Then set `RUNTIME_DATABASE_URL` in `.env` to that role's connection string and restart
`npm run dev`. If you skip this, the app falls back to `DATABASE_URL` — fine for a quick
try, but skip the grants-enforcement check in section 13 if you do.

## Automated checks

Run these first — they catch a large class of problems in seconds, before you click
through anything by hand.

```bash
npm run typecheck          # tsc --noEmit
npm run lint                # ESLint
npm run build                # production build — also catches issues typecheck/lint miss
npx prisma validate           # schema is internally consistent
npm run reconcile:stock        # StockMovement ledger agrees with cached stock quantities
```

`reconcile:stock` needs at least one company with some stock movement history to be a
meaningful check — on a freshly seeded, empty database it'll just report 0 rows checked.

`.github/workflows/ci.yml` runs the typecheck/lint/build steps (web) and typecheck/bundle-export
steps (mobile) automatically on every push — this section is what to run locally before that,
or if you don't have CI wired up in your own fork.

For the mobile app:

```bash
cd mobile
npm install
npm run typecheck
npx expo export --platform ios --platform android   # confirms Metro can bundle the whole app
rm -rf dist                                            # clean up the export output afterward
```

## Manual walkthrough

Each section below is a self-contained checklist: what to click, and what should happen.
They build on each other in order (later sections assume earlier ones are done), so it's
easiest to work straight through with one browser session. Where a `name`/`placeholder`
attribute is given, that's for anyone scripting these steps with Playwright — see
[Writing your own smoke tests](#writing-your-own-smoke-tests).

### 1. Sign-up, onboarding, and tenant isolation

1. Go to `/sign-up`, create an account (name, email, password), then fill in a company
   name on the onboarding screen that follows. You land on `/dashboard` as the company's
   **Owner**.
2. **Sign out and repeat with a second, unrelated email** to create a second company. This
   second company is your tenant-isolation control group for every section below — after
   creating any resource (a product, a sale, a customer...) as Company A, sign in as
   Company B and confirm:
   - It doesn't appear in Company B's list views.
   - Reusing Company A's resource URL directly while signed in as Company B (e.g. copy a
     sale's `/sales/<id>` URL from Company A's session and paste it into Company B's
     browser) returns a 404, not the resource.

   This is the single most important check in this whole guide — it's the difference
   between "multi-tenant" and "multi-tenant in name only." Do it for at least products,
   sales, and customers.

### 2. Staff, roles, and permissions

1. As Owner, go to `/staff` → invite a colleague by email, picking a role (Owner, Admin,
   Branch Manager, Warehouse Manager, or Cashier — the seeded system roles). No email
   provider is configured by default, so the invite surfaces as a copyable link instead of
   an actual email — copy it.
2. Open the invite link in a private/incognito window, accept it, set a password. You're
   now signed in as that staff member with their role's default permissions.
3. Back as Owner, open that staff member's detail page (`/staff/[id]`) and **deny** a
   permission their role normally grants (e.g. deny `sales.record` on a Cashier).
4. Switch to the staff member's session and confirm the denied action is blocked — **on
   their very next request, with no re-login.** This is a DB-backed permission check, not
   a cached JWT claim, so it should take effect immediately.
5. Suspend or remove the staff member from `/staff`, then confirm their *next* request
   redirects to `/sign-in` — suspension force-invalidates their sessions outright, not just
   an app-layer flag.

### 3. Products, warehouses, branches

1. `/branches/new` — create a branch (`input[name="name"]`).
2. `/products/new` — create a product (`input[name="sku"]`, `input[name="name"]`,
   `input[name="unitPrice"]`). Confirm it now shows a zeroed stock row for the branch you
   just made (visible on `/stock`).
3. `/warehouses/new` — create a warehouse. Confirm the *existing* product now also shows a
   zeroed row there — stock provisioning runs symmetrically in both directions (new
   product → all existing locations; new location → all existing products).
4. As a role without the right permission (a Cashier trying to create a product, say),
   confirm the create action is blocked both in the UI and if you try the underlying
   Server Action directly.

### 4. Stock transfers

Two independent intake paths — test both:

1. **External delivery** (no warehouse involved): `/transfers/new-external` — pick a
   product and destination branch, set a quantity, give it a source name
   (`input[name="externalSourceName"]`). This goes straight to `RECEIVED` and increments
   branch stock in one step. This is also the path a business with **zero warehouses**
   uses to stock branches at all — confirm it still works for a company that's never
   created a warehouse.
2. **Warehouse-sourced or branch-sourced transfer**: `/transfers/new` — request a transfer
   from either a warehouse or another branch (pick the source type; the picker only shows
   when both are available). As a *different* staff member than the requester, approve it,
   dispatch it, then receive it. Confirm:
   - The requester cannot also approve their own request (self-approval is blocked by
     default) — no Approve button is shown to the requester at all, just an explanation.
   - The source location's stock decrements at dispatch, branch stock increments at
     receipt — not both at once.
   - A branch cannot be selected as its own destination when it's already the source.
   - Receiving a *different* quantity than requested is recorded as-is and flagged as a
     discrepancy, not silently corrected.
3. With **zero warehouses and fewer than two branches**, visit `/transfers/new` directly —
   it should explain there's no source available and point you to `/transfers/new-external`,
   not show a broken form with an empty source dropdown.

### 5. Sales and payments

1. `/sales/new` — pick a branch, add a walk-in customer name, add one or more line items,
   submit. Confirm the total is server-computed (matches what the form showed) and stock
   decremented by exactly the quantities sold.
2. Try to oversell (quantity greater than available stock) — should be rejected, not
   allowed to go negative.
3. On the sale detail page, record a **partial** payment, then another partial payment
   that completes it. Confirm the status transitions `CONFIRMED` → `PARTIALLY_PAID` →
   `PAID`, and that an overpayment attempt (more than the remaining balance) is rejected.
4. Void a sale (as a role with `sales.void`) and confirm stock is restored via a
   compensating movement — the original sale record stays, just marked `VOIDED`, never
   deleted.
5. With **zero branches** (a brand-new company before creating one), visit `/sales/new`
   directly — should explain there's no branch yet and link to `/branches/new`, not show a
   broken required dropdown.

### 6. Credit notes and printing

1. On a sale's detail page (as a role with `credit_notes.issue` — Owner/Admin by default),
   issue a partial credit note with an amount and reason. Confirm the sale's outstanding
   balance drops by exactly that amount, and a sequential `CN-NNNNNN` number is assigned.
2. Try to issue a credit note for **more** than the currently-outstanding balance — should
   be rejected with a clear message.
3. Void the credit note (`credit_notes.void`) and confirm the outstanding balance reverts
   to what it was before — the sale itself is untouched.
4. Visit `/sales/[id]/print` and `/credit-notes/[id]/print` — both should render a clean,
   app-chrome-free invoice/credit-note (use your browser's print preview to confirm the
   nav/header actually disappears, not just that the page loads).

### 7. Customers and debt

1. `/customers/new` — create a customer, then record a sale linked to them with a future
   `dueDate` (check "This is a credit sale" on the sale form) instead of paying in full.
2. Confirm `/customers` shows their outstanding balance, and once the due date passes, an
   "overdue" flag.
3. Issue a credit note against one of their sales and confirm the customer's aggregated
   outstanding balance drops accordingly — this is computed live from
   `grandTotal - amountPaid - creditedTotal` across all their sales, never a stored,
   potentially-stale column.

### 8. Expenses

1. `/expenses/new` — record an expense against one of the seeded default categories (Rent,
   Utilities, Salaries, etc.), either company-wide or scoped to a branch.
2. Void an expense and confirm the "this month" total on `/expenses` drops by exactly its
   amount — not to zero, and not still counting it.

### 9. Plan limits

The seeded plans: **Solo** (₦5,000/mo — 1 branch, 0 warehouses, 2 staff), **Starter**
(₦15,000/mo — 2 branches, 1 warehouse, 10 staff), **Growth** (₦40,000/mo — 10 branches, 5
warehouses, 50 staff). New companies trial on Starter-level limits regardless of which
plan they eventually pick.

To actually test a cap being hit without waiting to organically grow a company that big,
temporarily tighten a plan's limits directly in the database, e.g.:

```sql
UPDATE "Plan" SET features = '{"maxBranches": 1, "maxWarehouses": 0, "maxStaff": 1}' WHERE name = 'Starter';
```

Then confirm: the branches/warehouses/staff pages show a live "X of Y used" indicator, the
first resource under the cap succeeds, the next one is rejected **server-side** (not just
a disabled button — try calling the Server Action past the point the UI would block you),
and no record is created on rejection. Restore the plan's real limits afterward.

### 10. Automated debt reminders

No real Termii account is needed to verify the plumbing:

1. `/settings/debt-reminders` — enable reminders for the company, set a days-overdue
   threshold.
2. With `TERMII_API_KEY` unset/placeholder (the `.env.example` default), trigger a send —
   either the "Send reminders now" button on `/customers`, or manually hit the cron route:

   ```bash
   curl http://localhost:3000/api/cron/debt-reminders \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   (No/wrong `Authorization` header should get a `401`; the correct `CRON_SECRET` from
   `.env` gets a `200`.) With a placeholder key, it should find candidates but send
   nothing and write no `DebtReminder` rows — a configuration problem, not a per-message
   failure, so nothing gets logged as attempted.
3. Re-run immediately — it should find zero candidates for the same customer (a 3-day
   cooldown applies regardless of the configured threshold, so a 1-day setting can't spam
   daily).
4. Opt one customer out (`Customer.remindersEnabled` off, via their detail page) and
   confirm they're excluded from the candidate list even though they're otherwise overdue.

### 11. Branding

`/settings/branding` — set a primary color, secondary color, and logo URL. Confirm the
color shows up on primary buttons/links across the app (check computed styles, not just
that you saved a value), and that a **second company** with no branding configured shows
neither color — no cross-tenant leakage of theme.

### 12. Billing (Paystack)

No real Paystack account is needed to test the webhook plumbing — sign locally with the
same HMAC-SHA512 scheme Paystack uses:

```bash
SECRET=$(grep PAYSTACK_SECRET_KEY .env | cut -d'"' -f2)
BODY='{"event":"charge.success","data":{"reference":"test_ref","metadata":{"companyId":"<a real company id>","planId":"<a real plan id>"}}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha512 -hmac "$SECRET" | sed 's/^.* //')

curl -i -X POST http://localhost:3000/api/webhooks/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIG" \
  -d "$BODY"
```

Grab a real `companyId`/`planId` first (the webhook silently no-ops without a
company/plan it recognizes):

```bash
psql "${DATABASE_URL%%\?*}" -c 'SELECT id, name FROM "Plan";'
psql "${DATABASE_URL%%\?*}" -c 'SELECT id FROM "Company" LIMIT 1;'
```

Confirm:

- A tampered signature (or none at all) is rejected with `401` **before** the payload is
  parsed or touched.
- The identical payload sent twice is idempotent — check `PaystackEvent.processedAt`
  doesn't change on the second delivery, not just that you get a `200` both times.
- `invoice.payment_failed` moves the subscription to `PAST_DUE`, and `/dashboard`/
  `/settings/billing` stay reachable while every other route redirects to
  `/billing-required` — confirm the grace period boundary (7 days past
  `currentPeriodEnd`) on both sides.
- `/settings/billing` lists all three plans with correct prices/limits — this is also
  where the Solo plan's "No warehouse" wording is worth double-checking (it's a real bug
  class: a plan capped at exactly `0` of something is easy to accidentally render as a
  literal `"0"` instead of hiding/relabeling the line — see the git history around the
  Solo plan's introduction if you want the specifics).

### 13. Security & accountability

- **Least-privilege DB role** (skip if you didn't set up `RUNTIME_DATABASE_URL`): as the
  `inventory_runtime` role, attempt to directly `UPDATE`/`DELETE` a row in `AuditLog`,
  `StockMovement`, or `DebtReminder` — it should fail with a Postgres permission error,
  not succeed.

  ```bash
  psql "${RUNTIME_DATABASE_URL%%\?*}" -c 'DELETE FROM "AuditLog" WHERE id = (SELECT id FROM "AuditLog" LIMIT 1);'
  # expect: ERROR:  permission denied for table AuditLog
  ```
- **Audit log coverage**: `/audit-log` (a role needs `AUDIT_LOG_VIEW`) lists the
  per-company trail with an entity-type filter. Confirm a row was written for things you
  did above: staff invited, a permission changed, a sale recorded, a transfer's state
  changed, a credit note issued. For anything not shown there, `psql`/Prisma Studio
  (`npx prisma studio`) still work directly against the `AuditLog` table.
- **Rate limiting**: rapidly submit the same sale/payment/staff-invite action many times in
  a row (a simple loop, or spam-clicking) — should eventually get a clear rate-limit
  error rather than either silently succeeding unboundedly or crashing.
- **Security headers**: `curl -I http://localhost:3000/` and confirm `Content-Security-Policy`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`,
  and `Referrer-Policy` are all present.

### 14. Platform admin & support

Platform staff (`User.platformRole`) are entirely separate from any company's
Membership/Role system — they see across every company via `/admin`, not as a member of
one.

1. Sign in with `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` (seeded automatically by
   `npm run db:seed` — see [Environment setup](#environment-setup)) and visit `/admin`.
   Confirm it lists every company you've created while testing, with plan/subscription
   status and branch/warehouse/staff counts — but no access to any company's actual sales,
   products, or staff data (view-only by design).
2. `/admin/team` (super admin only) — add a new person by email as a **Support agent**. If
   the email has no account yet, one is created and a password shown once — copy it.
3. Sign in as that support agent. Confirm they can reach `/admin` (companies) and
   `/admin/support`, but visiting `/admin/team` directly redirects them back to `/admin` —
   they can't grant platform access to anyone, including themselves.
4. `/admin/support` — the password-reset tool. Enter a real test user's email, generate a
   reset link, and confirm it actually works: open the link in a private window, set a new
   password, sign in with it. The old password should no longer work. An email with no
   account should clearly say so, not silently fail.
5. Back as the super admin, remove the support agent's access from `/admin/team`.
   Confirm their *next* request to `/admin` bounces them to `/dashboard` (or `/onboarding`
   if they have no company either) — signing in still works, they just lose platform
   access.
6. `/admin/audit-log` — confirm every action above (support agent added, a reset link
   generated, access removed) shows up, attributed to the right person.

### 15. Low-stock alerts, branch transfers, and perishable batch tracking

1. On a product's edit page, set a **reorder point** (e.g. `5`) and leave it blank on
   another. Deliver stock below that number via `/transfers/new-external`. Confirm:
   - `/dashboard` shows a "Low stock" card with the total count and the affected product
     names — the product with no reorder point set is never included, even at zero stock.
   - `/stock` shows a red "Low stock" badge next to the affected product, with the current
     total vs. the reorder point.
2. Mark a product **"Perishable / tracked by batch"** when creating or editing it. Confirm:
   - `/transfers/new-external` requires a batch number and expiry date for that product
     (and only that product — a non-tracked product's form has no batch fields at all), and
     rejects the delivery server-side if submitted without them.
   - `/batches` lists the batch under "Expiring soon" (or "Expired" once its date passes),
     with the correct remaining quantity; the "All" tab shows every batch regardless of
     expiry.
   - `/dashboard` shows an "Expiring soon" card counting batches expiring within 14 days,
     separately calling out how many are already expired.
3. Record a sale of a batch-tracked product, or dispatch it out via a branch-to-branch
   transfer, from a branch with two batches at different expiry dates. Confirm the
   **earlier-expiring batch's `quantityRemaining` is consumed first** (FEFO) — check
   `/batches` before and after. This should happen transparently; nothing on the sale or
   transfer form asks which batch to use.
4. Request a transfer sourced from **another branch** (not a warehouse) via `/transfers/new`
   — the source-type picker only appears when both a warehouse and a second branch are
   available; otherwise the form defaults to whichever source actually exists. Confirm you
   cannot pick the same branch as both source and destination, and that the rest of the
   lifecycle (approve by a different staff member, dispatch, receive) behaves exactly like
   a warehouse-sourced transfer.
5. **Batch identity survives a branch-to-branch transfer.** Receive a batch-tracked product
   into Branch A with a specific batch number and expiry, then transfer some of it to Branch
   B. Confirm `/batches` shows a batch at Branch B with the **same** batch number and expiry
   date (not a generic "transferred stock" entry) — receiving doesn't ask for batch details
   again, since it carries over automatically from what was dispatched.
6. **Batch identity also survives a warehouse-sourced transfer** — warehouses track batches
   too now, not just branches (see §20 for the full walkthrough). Receiving a batch-tracked
   product from a warehouse does NOT ask for batch details again, the same as a branch
   source. Manual batch entry at receipt is only ever needed when the source location
   genuinely has no matching batch rows to consume from (e.g. batch tracking was turned on
   for the product after stock already existed there).
7. Receive a **second delivery under an already-used batch number** at the same branch
   (e.g. two shipments of the same lot). Confirm it increments the existing batch's quantity
   instead of erroring.
8. Record a sale of a batch-tracked product, then **void that sale**. Confirm the batch's
   `quantityRemaining` on `/batches` is restored by exactly the sale's quantity — not just
   the aggregate stock total — even if other sales or deliveries touched that batch in the
   meantime.

### 16. Business verification (CAC) and account enable/disable

1. Sign up a new company, optionally filling in the **CAC RC number** and **incorporation
   date** on the company step — both are optional, and a company with neither can still
   operate normally. Confirm a 5-day `verificationDeadline` is set at creation (check
   `Company.verificationDeadline` in the DB, or just trust the countdown shows correctly).
2. As Owner/Admin, go to `/settings/verification` and submit a certificate link. Confirm the
   status moves to "Submitted — awaiting review" and the company shows up under `/admin`'s
   **Needs review** filter for a platform super admin.
3. As the super admin, open that company's `/admin/companies/[id]` page. Confirm the RC
   number, incorporation date, and a clickable link to the submitted certificate all show
   up, and click **Approve & verify**. Confirm:
   - The company now shows "Verified" on its own `/settings/verification` page.
   - It appears under `/admin`'s **Verified** filter, with a small checkmark badge next to
     its name in the companies list.
4. On a different company, submit a certificate and **Reject** it with a reason. Confirm the
   company's Owner sees the rejection reason on `/settings/verification` and can resubmit —
   resubmitting moves it back to "awaiting review".
5. On a company that never submitted anything, use **Approve without CAC** (with an optional
   note). Confirm its Owner sees "approved to operate without a CAC" instead of a submission
   form, and the company is excluded from the **Needs review**/**Overdue** filters.
6. As the super admin, **Disable** a company's account with a reason. Confirm:
   - That company's staff are immediately redirected to `/account-disabled` on their next
     page load, showing the disable reason — not the confusing "create your company" form a
     suspended-but-unhandled account used to fall through to.
   - **Enable account** restores access on the staff member's very next request, without
     needing to sign in again.
7. Confirm a `SUPPORT_AGENT` (not a super admin) sees the same read-only company detail page
   but none of the verification-review or enable/disable controls — this stays a `SUPER_ADMIN`-only
   trust decision, same as granting platform access.

### 17. Barcode/QR scanning and stock counts

1. On the web app, edit or create a product and set a **Barcode** value. Confirm saving a
   second product with the same barcode (within the same company) is rejected, but the
   same barcode is allowed for a different company (uniqueness is per-`companyId`, not
   global).
2. On mobile, open **New sale** and tap **Scan**. Confirm the camera-permission prompt
   appears on first use, and scanning a barcode/QR code that matches a product's `barcode`
   adds it to the cart the same as tapping it in the product list. Scanning an unmatched
   code shows an inline error instead of crashing.
3. On mobile, open **Stock** → **Stock count**, pick a branch, and tap **Scan** repeatedly
   on the same code — confirm the counted quantity for that product increments by one per
   scan rather than resetting. Confirm typing a count directly in the input works the same
   way and shows the delta (green for over, red for under) against the branch's system
   quantity.
4. Tap **Save count** with at least one changed row. Confirm the confirmation dialog states
   how many products will be adjusted, and after confirming: the branch's `StockLevel`
   matches what was counted (verify in `psql`), a `StockMovement` row exists per adjusted
   product with reason `ADJUSTMENT`, and an audit log entry (`stock.adjusted`) was written.
   Confirm rows with no change (delta `0`) are not sent to the adjust endpoint at all.
5. Confirm a staff member without `branches.manage` can still open **Stock count** and build
   a tally, but sees a message instead of the **Save count** button — matching the
   read-only-vs-adjust split used elsewhere in the app.

### 18. Two-factor authentication (2FA) for Owners and platform staff

Mandatory for the company Owner role and for platform staff (`SUPER_ADMIN`/`SUPPORT_AGENT`);
optional — but available — for everyone else. Built on Better Auth's `two-factor` plugin
(TOTP + backup codes only; the email/SMS "otp" method is left unconfigured, same situation as
`sendResetPassword`, so the UI never offers it).

1. Sign up a new company. As the Owner, confirm the dashboard shows a red "two-factor
   authentication is required" banner, and visiting any gated page (`/products`, `/staff`,
   `/transfers`, etc.) redirects to `/settings/security` instead of the page itself.
   `/dashboard` and every `/settings/*` page stay reachable throughout — same "always leave
   the fix-it page open" pattern as the billing-required gate.
2. On `/settings/security`, confirm your password, then confirm the QR code renders, a
   manual-entry key is shown, and 10 backup codes are listed. Scan the QR (or add the
   manual key) in an authenticator app (Google Authenticator, Authy, 1Password, etc.), check
   "I've saved these backup codes", and enter the 6-digit code. Confirm the page flips to
   "Two-factor authentication is on" and gated pages are reachable again immediately (no
   re-login needed).
3. Confirm the **Disable two-factor authentication** button is absent for the Owner — the
   copy explains it's required for your role. Sign out and sign back in: confirm you land on
   `/two-factor` instead of `/dashboard`, entering a wrong code shows an error and keeps you
   there, and the correct code (or a backup code, via "Use a backup code instead") completes
   sign-in. Confirm a used backup code can't be reused.
4. Invite a non-Owner staff member (e.g. Cashier). Confirm their dashboard shows no 2FA
   banner and they are never redirected away from gated pages regardless of whether they've
   set up 2FA — it's the same optional toggle, on the same `/settings/security` page, minus
   the "required" copy and with a working **Disable** button once enabled.
5. As a `SUPER_ADMIN` or `SUPPORT_AGENT` (`scripts/create-platform-admin.ts` to bootstrap
   one), confirm every `/admin/*` page (companies list, support, audit log, team) redirects
   to `/admin/security` until 2FA is set up, and that `/admin/security` itself always stays
   reachable (it's what every other admin page redirects to, so it can never be part of the
   loop). Confirm the same enroll/verify/backup-code flow works there too.
6. Try **Regenerate backup codes** (password required) and confirm the old codes stop
   working while the new ones don't.

### 19. CSV data export (products, customers, sales)

Web-only — accounting/tax use, so it's a plain file download rather than anything in the
mobile app. Every export streams straight from the database (no caching), is scoped to the
signed-in company like everything else, and is gated by the same permission its underlying
list page already uses (`products.view`, `customers.view`, `reports.view` for sales) — a
staff member who can't see the page can't hit the export URL directly either.

1. On **Products**, click **Export CSV**. Confirm the download opens cleanly in Excel/Sheets
   (the file needs its UTF-8 BOM to avoid mojibake on special characters) with one row per
   product: SKU, barcode, name, description, unit price, cost price, total stock across every
   branch/warehouse, stock value at cost, and active/inactive status.
2. On **Customers**, click **Export CSV**. Confirm one row per customer: name, phone, email,
   address, credit limit, outstanding balance, open/overdue sale counts, and status — the
   same balance figures shown on the Customers page itself.
3. On **Sales**, leave the From/To date fields blank and click **Export CSV** — confirm it
   downloads every sale ever recorded (including voided ones, so an accountant sees the full
   picture rather than a silently filtered one), with invoice number, date, branch, customer,
   status, subtotal/discount/tax/grand total/amount paid, credited amount, outstanding balance,
   and who recorded the sale. Then pick a From and/or To date and confirm the export only
   includes sales within that range — this is the tax-period export a small business actually
   asks for at filing time.
4. Confirm every money column comes out as a plain two-decimal number (`2500.00`), never a
   currency-formatted string (`₦2,500.00`) or a value with trailing zeros stripped
   (`2500`) — accounting software needs consistent, symbol-free numbers to import correctly.
5. As a Cashier (no `reports.view` by default), confirm the **Sales** page has no export
   form at all, and that hitting `/api/exports/sales` directly still 403s — but Products and
   Customers export normally, since Cashiers do have `products.view`/`customers.view`.
6. Confirm hitting any `/api/exports/*` URL while signed out redirects/rejects rather than
   downloading anything.

### 20. Warehouse-level batch tracking

Batches used to be branch-only — a perishable delivery that landed in a warehouse before
reaching a branch had no expiry tracking at all until it was transferred out. Warehouses now
track batches exactly the same way branches do; see §15 for the base perishable-tracking
walkthrough, which this extends.

1. Mark a product **"Perishable / tracked by batch"**, then go to `/transfers/new-external`
   and pick **A warehouse** as the receiving location (the picker only appears when you have
   both a warehouse and a branch to choose from; otherwise it defaults to whichever exists).
   Confirm batch number and expiry are required here exactly like a branch delivery, and that
   `/batches` lists the new batch with its location shown as the warehouse name plus a small
   "warehouse" badge (the "Location" column shows either a branch or a warehouse now).
2. Confirm that batch counts toward `/dashboard`'s "Expiring soon"/"Low stock" cards the same
   as a branch batch would, if its expiry falls within the 14-day window.
3. Request an internal transfer sourced from **that warehouse** to a branch
   (`/transfers/new`), for less than the full quantity delivered. Approve (as a different
   staff member), dispatch, and receive it. Confirm:
   - The receive form does **not** ask for manual batch details — the batch identity (same
     batch number and expiry) carries over automatically, the same as a branch-sourced
     transfer already did.
   - `/batches` now shows the batch at the **receiving branch** with the transferred
     quantity, and the **warehouse's** row still shows the correct remaining quantity (what
     was delivered minus what was just transferred out) — not zeroed out.
4. Confirm a manual warehouse stock adjustment (`/stock`, negative delta) on a batch-tracked
   product also consumes FEFO from the warehouse's batches, the same as a branch adjustment
   already does — check `/batches` before and after.
5. Try (via direct API manipulation, or just trust the schema-level guarantee) creating a
   batch or a transfer with both a branch and a warehouse destination set, or neither —
   confirm the database rejects it (a CHECK constraint backs the app-level logic here, the
   same defense-in-depth pattern used elsewhere in this schema).

### 21. Purchase orders and suppliers

Formalizes buying from a supplier as a real commitment record, checked against actual
receipt — the natural next link in this app's stock-accountability chain alongside stock
transfers. Today, `receiveExternalStock` (§15/§20) records a delivery *after the fact*;
a purchase order lets you say "I ordered 50 units at ₦2,000 each" up front, then
reconcile what actually arrives against it, one line item at a time.

1. Go to **Purchase orders** in the left nav → **Manage suppliers** → **New supplier**.
   Create a supplier (name required; phone/email/address/notes optional). Confirm it
   appears in the `/suppliers` list, and that a role without `purchase_orders.manage`
   (e.g. Cashier) can't see "New supplier" and gets a permission message if they visit
   `/suppliers/new` directly.
2. From `/purchase-orders`, click **New purchase order**. Pick the supplier, a
   destination (a warehouse or a branch — the picker only appears when you have both;
   otherwise it defaults to whichever exists), and add two line items: one ordinary
   product and one **batch-tracked** product ("Perishable / tracked by batch"), each
   with a quantity and a unit cost. Confirm the running total updates as you edit rows,
   and that submitting creates the PO in **DRAFT** status with a sequential `PO-000001`-
   style number, then lands you on its detail page.
3. On the detail page, confirm **DRAFT** POs have no receive forms — only **"Mark as
   ordered"** and **"Cancel purchase order"** (cancel is available from DRAFT or
   ORDERED, as long as nothing's been received yet). Click **Cancel**, confirm it moves
   to **CANCELLED** and both actions disappear. Create a second PO the same way to
   continue.
4. Click **"Mark as ordered"** — status moves to **ORDERED**, and a per-line **Receive**
   form now appears for each line item still outstanding.
5. Receive the ordinary product's line **in full**. Confirm: the line shows "Fully
   received" and its Receive form disappears; the PO status becomes
   **PARTIALLY_RECEIVED** (the batch-tracked line is still outstanding);
   `/stock` shows the destination's quantity incremented by the received amount.
6. Receive the batch-tracked product's line **partially** (less than ordered). Confirm
   the Receive form requires a batch number and expiry date (same as an external
   delivery), that the PO stays **PARTIALLY_RECEIVED**, and that `/batches?tab=all`
   shows the new batch at the destination with the received quantity.
7. Try to receive **more than the remaining quantity** on that same line — confirm it's
   rejected (not silently capped) with a clear "Cannot receive more than N unit(s) still
   outstanding" error.
8. Receive the rest of the batch-tracked line, with a **different batch number**
   (e.g. a second delivery). Confirm: the PO status becomes **RECEIVED**; `/batches`
   now shows **two distinct batch rows** for that product at the destination (not one
   row overwritten); the line's Receive form is gone since nothing's outstanding.
9. Confirm a role with only `purchase_orders.view` + `purchase_orders.receive`
   (Warehouse Manager's default) can open a PO and receive against it, but sees no
   "New purchase order", "Mark as ordered", or "Cancel" controls — those require
   `purchase_orders.manage` (Branch Manager gets all three by default, mirroring its
   existing `transfers.receive_external` asymmetry with Warehouse Manager). Confirm a
   Cashier (no purchase-order permissions at all) is blocked from `/purchase-orders`,
   `/purchase-orders/[id]`, and `/suppliers` entirely.
10. Confirm every step above wrote an audit-log entry (`purchase_order.created`,
    `.ordered`, `.cancelled`, `.line_item_received`, `supplier.created`) visible at
    `/audit-log`, and that the underlying `StockMovement` rows use reason
    `PURCHASE_RECEIPT` with `referenceType: "PurchaseOrder"`.

## Mobile app

```bash
cd mobile
npm install
```

Set `expo.extra.apiBaseUrl` in `mobile/app.json` to point at your running backend — use
your machine's LAN IP (not `localhost`) if testing on a **physical** device, since
`localhost` on the phone means the phone itself.

**Two ways to run it**, depending on what you're testing:

- `npm start` (plain Expo Go, scan the QR code) — works for every screen **except**
  Bluetooth printing, which is a native module Expo Go can't load.
- `npm run android` / `npm run ios` (`expo run:android`/`expo run:ios`, a Development
  Build) — needed once you touch printing; this generates a native project on first run
  via the `react-native-ble-plx` config plugin, builds it, and installs it on a
  device/emulator/simulator.

Sign in with an account from an already-onboarded company (mobile doesn't do company
sign-up/onboarding — that's web-only). Walk through: dashboard, recording a sale (confirm
the branch picker is skipped entirely for a single-branch company, shown for multiple),
recording a payment, viewing/creating customers, issuing/voiding a credit note, and
printing (needs the Development Build + a real Bluetooth thermal printer — see the caveat
below).

2FA enrollment/management is web-only (`/settings/security`), but signing in from mobile
with an account that already has 2FA enabled (set it up on web first) should land on the
app's own `two-factor` screen instead of the dashboard — confirm entering the correct code
(or a backup code, via "Use a backup code instead") completes sign-in, and a wrong code
shows an error without navigating away.

### Testing the mobile API directly with curl

Useful for isolating "is this a backend bug or a UI bug" without touching the app at all:

```bash
EMAIL="you@example.com"        # an already-onboarded account
PASSWORD="..."

TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl http://localhost:3000/api/mobile/v1/me -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/api/mobile/v1/dashboard -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/api/mobile/v1/sales -H "Authorization: Bearer $TOKEN"
```

`/me` and `/dashboard` should stay reachable (`200`) even with an inactive subscription;
every other `/api/mobile/v1/*` route should `402` in that case — confirm this by
temporarily setting `Subscription.status = 'CANCELLED'` for the test company in `psql`.

### Bluetooth printer testing — needs real hardware

This cannot be verified without a physical 58mm/80mm BLE thermal receipt printer and a
real device with Bluetooth. What can be checked without hardware:

```bash
cd mobile
npx expo prebuild --platform android --no-install
grep -A1 BLUETOOTH android/app/src/main/AndroidManifest.xml   # confirm scan/connect permissions landed
rm -rf android                                                  # clean up — this is a managed-workflow app
```

Beyond that, pair a real printer via the app's Settings tab and confirm a test print
actually comes out. If it doesn't, check the printer uses BLE (not classic Bluetooth
SPP — iOS can't talk to that at all from a third-party app) and that
`mobile/lib/bluetooth-printer.ts`'s "first writable characteristic" heuristic actually
found the right one for your printer's chipset.

### Barcode scanning — needs a real camera

Same limitation as the printer: nothing in a CI or sandboxed environment has a camera, so
`BarcodeScannerModal`'s permission prompt, live viewfinder, and actual scan detection can
only be exercised on a real device or simulator with camera access — a Development Build
is not required for this one (`expo-camera`'s `CameraView` works fine in Expo Go). Print a
few barcodes/QR codes for products you've set a `barcode` value on and test against those.

## Writing your own smoke tests

Every feature in this guide was actually exercised with disposable Playwright scripts
during development — not committed, written fresh, run, then deleted. That's the pattern
worth reusing:

```js
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const password = "supersecurepassword123";
const email = `test+${Date.now()}@example.com`;

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("OK: " + msg);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();

await page.goto(`${BASE}/sign-up`);
await page.fill('form input:not([type])', "Test Owner");
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForSelector('input[name="companyName"]', { timeout: 15000 });
await page.fill('input[name="companyName"]', "Test Co");
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 15000 });

// ... your assertions here ...

await browser.close();
```

Pitfalls that actually cost time while building this app — worth knowing before you hit
them yourself:

- **Use `page.locator("body").innerText()`, not `page.textContent("body")`.**
  `textContent()` includes the literal text of `<script>` tags, and Next.js embeds its
  streaming-SSR hydration payload as inline scripts that linger in the DOM after a Server
  Action updates the visible page — so a *correctly* updated page can still contain stale
  JSON text from a moment earlier, making `textContent()` assertions flaky in a way that
  has nothing to do with app correctness. `innerText()` only reflects rendered text.
  Relatedly: `innerText()` also reflects CSS `text-transform: uppercase`, so a label
  written as `Branches` in JSX may come back as `BRANCHES`.
- **Scope form-field locators when multiple forms share field names on one page.** A sale
  detail page can have `RecordPaymentForm`, `VoidSaleForm`, and `IssueCreditNoteForm` all
  using `input[name="amount"]`/`input[name="reason"]` — an unscoped `page.fill()` silently
  fills the wrong form's field. Scope to the specific form first:
  `page.locator("form", { has: page.locator('button:has-text("...")') })`.
- **`:has-text()` does substring matching.** `button:has-text("Void")` matches both "Void
  sale" and "Void" — use `page.getByRole("button", { name: "Void", exact: true })` when
  button labels overlap.
- **A rejected mutation doesn't consume a sequential number.** If you're testing that
  `CN-000002`/`INV-000002`-style numbering is correct, remember a validation failure (e.g.
  an over-credit attempt) never increments the counter — the next successful one still
  gets the next number, not one further along.
- Always `rm` your scratch script when done — nothing in this repo's history should be a
  leftover one-off test file.

## Troubleshooting

- **`Can't reach database server at localhost:5432`** — Postgres isn't running.
  `pg_lsclusters` to check; `pg_ctlcluster 16 main start` (adjust the version to match
  what's installed) to bring it up.
- **Playwright can't find a browser** — this repo doesn't bundle one; point
  `chromium.launch({ executablePath: ... })` at whatever Chromium/Chrome is actually
  installed in your environment.
- **A migration "was modified after it was applied"** — you edited an already-applied
  migration file. Don't do this on a real database; on a disposable local dev database
  only, `npx prisma migrate reset --force` starts clean (destroys all local data — never
  run this against anything you care about).
- **Mobile: "Unable to resolve module react-native-ble-plx"** in Expo Go — expected. That
  module needs a Development Build (`expo run:android`/`ios`), not Expo Go.

## What this guide can't verify for you

- **Real Paystack checkout** (a live redirect through Paystack's hosted checkout page) —
  the webhook-signing approach above verifies the receiving end, not the actual checkout
  UX. Needs a real Paystack test-mode account.
- **Real Termii SMS delivery** — the cron/manual-trigger flow above verifies the app finds
  the right candidates and calls out correctly, but confirming an SMS actually arrives
  needs a real Termii account and a real phone number.
- **Bluetooth printer pairing and printing** — needs real hardware, as noted above; nothing
  in a CI or sandboxed environment can substitute for an actual print coming out of an
  actual printer.
- **True concurrency races** (two people recording a sale on the very last unit of stock at
  the exact same instant) — the atomic-`UPDATE`-based guards are correct by inspection and
  by the database transaction guarantees they rely on, but reproducing an actual race
  needs concurrent load, not sequential clicking.
