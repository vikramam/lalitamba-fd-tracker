# Family FD Tracker — Architecture & Implementation Plan

This document is the design for a family Fixed Deposit (FD) receipt manager. It is the review artifact for the first phase: **no application code has been implemented yet**.

**Scope lock:** one institution only — Shri Lalitamba Pattina Souharda Sahakari Ltd, Gadag. Receipts almost always use the same printed FD certificate. See [`docs/SAMPLE_RECEIPT.md`](docs/SAMPLE_RECEIPT.md) for the annotated sample (`01FD40599`). We do **not** build a multi-bank product or a bank directory in v1.

---

## A. Recommended Architecture

A single Vite/React frontend talks only to Supabase (Auth, Postgres, Storage). The one privileged hop is a Supabase Edge Function that calls the OCR/document model. API keys never leave the server.

```
┌─────────────────────────────────────────────────────────────┐
│  Vite + React + TypeScript  (Vercel)                        │
│  Login · Dashboard · Members · FDs · Add FD · Verify · Admin│
└──────────────┬──────────────────────────────▲───────────────┘
               │  anon key + user JWT          │ JSON / signed URLs
               ▼                               │
┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                    │
│  ├─ Auth (email/password; later magic link if needed)        │
│  ├─ PostgreSQL + Row Level Security                          │
│  ├─ Storage (private `fd-receipts` bucket)                   │
│  └─ Edge Function: `extract-fd-receipt`                      │
│         │                                                    │
│         │  service role only inside the function             │
│         ▼                                                    │
│     Gemini 2.5 Flash (vision + structured JSON)              │
│         + Lalitamba field mapper (interest line, dates)      │
└──────────────────────────────────────────────────────────────┘
```

### Why this shape

1. **Security first.** Receipts and FD amounts are family financial data. RLS on Postgres and Storage is the real access control. The UI only hides what the database already refuses to return.
2. **One backend, not three.** Auth, database, file storage, and a secrets-safe function already live in Supabase. Adding Cloudflare R2 or a separate API server would add cost and moving parts without helping a family app.
3. **OCR is a backend job.** The browser uploads the image to Storage, then asks the Edge Function to extract fields. The Gemini key never reaches the client.
4. **Confirm-before-save.** OCR output is a draft. A confirmed FD row is written only after the user reviews and edits the form.
5. **Extensible without being rigid.** `extra jsonb` and later tables cover renewals, TDS, and notifications. We are not designing for many banks.

### Request flow: Add FD

1. User taps **Add FD**, picks a family member, and uploads / captures a receipt photo.
2. Client uploads the file to the private Storage bucket at  
   `{family_id}/{user_id}/{draft_id}/{filename}`.
3. Client calls `extract-fd-receipt` with the storage path (user JWT).
4. Edge Function:
   - validates the JWT
   - checks the user may access that `family_id`
   - downloads the object with the service role
   - sends the image to Gemini with a strict JSON schema
   - writes an `ocr_runs` row (raw response, extracted fields, confidence)
   - returns structured fields to the client
5. UI opens the verification form, prefilled, fully editable.
6. User corrects values and taps **Confirm**.
7. Client inserts `fixed_deposits` + `fd_receipts` and updates `ocr_runs.fd_id` plus per-field review flags.
8. Dashboard reads confirmed FDs only.

If OCR fails, the user can still fill the form manually. The receipt is still stored.

---

## B. Technology Decisions

### Frontend — Vite + React + TypeScript + Tailwind + shadcn/ui

| Choice | Why |
| --- | --- |
| Vite + React + TS | Requested stack. Fast local/dev preview, typed forms, easy Vercel deploy. |
| **PWA** (`vite-plugin-pwa`) | Install on the phone (and desktop) from the browser. Manifest + service worker. Mobile is the main client. |
| Tailwind + shadcn/ui | Mobile-first primitives, restyled to a **modern, elegant, minimal** look (see `docs/DESIGN.md`). |
| React Router | Small app; file-based Next.js routing is unnecessary. |
| TanStack Query | Cache FD lists/dashboard after mutations; handle loading/error states cleanly. |
| React Hook Form + Zod | Verification form validation (amounts, dates, rates) before save. |

**Not chosen:** Next.js. The request specified Vite. There is no SEO or server-rendered public site. Vercel hosts a Vite SPA without issue.

### Backend — Supabase only

| Piece | Role |
| --- | --- |
| Supabase Auth | Email/password login. `profiles` row created by trigger on signup. |
| Postgres | Source of truth for families, members, FDs, OCR audit. |
| Edge Functions (Deno) | OCR proxy. Only place that holds `GEMINI_API_KEY`. |
| Supabase JS client | Browser uses anon key + user session. Never the service role. |

**Not chosen:** a separate Express/FastAPI server. It would duplicate Auth and RLS for no gain at this scale.

### Database — Supabase PostgreSQL

Native types (`numeric`, `date`, enums), constraints, indexes, and RLS. Generated columns / SQL views for dashboard aggregates so the client does not reimplement interest math.

### Authentication — Supabase Auth

- Email + password for v1.
- `profiles.is_app_admin` is the platform Admin flag (set manually in SQL for the first household admin).
- Family role lives on `family_memberships.role` (`family_admin` | `member`).
- Optional later: magic link, invite emails.

### Storage — Supabase Storage (recommended)

See comparison below. For a private family archive of receipt photos, **Supabase Storage is the simplest correct choice**.

### OCR — Gemini 2.5 Flash + Lalitamba mapper (recommended)

Vision in, structured JSON out, then a small parser for this society’s labels (`CID`, `FD-A/c No`, `Interest Rs. … Monthly CR To MS A/c`). The watermark and the stamp on the interest line are why we still use a vision model instead of Tesseract + regex alone.

### Hosting — Vercel (frontend) + Supabase (backend)

Matches the requested deploy target. Frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only.

### Local / mock fallback

Until Supabase and Gemini keys exist, the app can run with:

- a checked-in SQL schema the user applies in the Supabase SQL editor
- a **manual-entry path** that skips OCR
- an Edge Function mock that returns fixture JSON for development

The product must remain usable without OCR so a missing API key never blocks adding an FD.

---

### Storage comparison

| | **Supabase Storage** | Cloudflare R2 | Vercel Blob |
| --- | --- | --- | --- |
| Free tier | 1 GB files, 5 GB egress (shared with the project) | 10 GB, **$0 egress** | Hobby inclusion; ecosystem-locked |
| Private files + auth | Bucket RLS + signed URLs, same JWT as the DB | You build auth yourself | Token-based; not family-RLS aware |
| Signed URLs | Built in | Presigned S3-style via Workers | Yes, Vercel SDK |
| Integration | Same project as Auth/RLS | Extra account, extra IAM | Extra product; Vite works but no shared auth |
| Backup | Pro: DB backups; files are not point-in-time with Free | Versioning optional | Limited |
| Family-app fit | **Best** | Better later if egress explodes | Weakest fit |

**Recommendation: Supabase Storage, private bucket `fd-receipts`.**

A few hundred phone photos of receipts will stay well under 1 GB. Users open one receipt at a time via a short-lived signed URL (5–15 minutes). Egress will be tiny.

Move to R2 only if the archive grows large *and* people download receipts constantly. Do not start there.

**Operational notes**

- Max upload 50 MB on Free (receipt photos should be compressed client-side to ~2–4 MB).
- Free projects pause after a week of inactivity — acceptable for a family app; Pro (~$25/mo) if that becomes annoying.
- Free has no automatic file backup. Keep a periodic `supabase storage` download or export script as a later ops task; do not block v1 on it.
- Path convention: `{family_id}/{uploader_id}/{fd_or_draft_id}/{original-name}` so Storage RLS can match `family_id`.

---

### OCR comparison (single known form)

We now have a real Lalitamba certificate. It is a labeled key-value form, not a random bank mix. The remaining problems are the Kannada watermark and the purple stamp that often sits on the interest line — not unknown layouts.

| Approach | Fit for this receipt | Cost | Verdict |
| --- | --- | --- | --- |
| **Tesseract + regex** | Labels are stable, but watermark/stamp will eat characters (`1375`, MS A/c) | Free | Useful later as a fallback, not primary |
| Cloud Vision / Textract / Azure / Document AI | Extra accounts and cost for a household volume | Paid per page | Not worth it |
| **Gemini 2.5 Flash + Lalitamba mapper** | Reads through watermark; we then split the interest line into amount, mode, MS account | Free tier / fractions of a cent | **Recommended** |

The prompt will name this form explicitly (`CID`, `FD-A/c No`, `The Sum of Rs.`, `Interest Rs. … Monthly CR To MS A/c`). A small TypeScript mapper normalizes dates (`26-05-2025`, `26-May-2025 16:12:32`) and the interest line. We do not build SBI/HDFC parsers.

Field reliability for the sample is in [`docs/SAMPLE_RECEIPT.md`](docs/SAMPLE_RECEIPT.md). OCR is **never** auto-committed.

---

## C. Database Design

UUIDs for all primary keys. `family_id` is denormalized onto child tables so RLS policies stay simple and indexable.

### Entity relationship (v1)

```
auth.users
    │ 1:1
    ▼
profiles ──────────┐
                   │
families ◄──────── family_memberships
    │
    ├── family_members (people who hold FDs; optional bank CID)
    │         │
    │         └── fixed_deposits   -- Lalitamba: monthly MS credit or on-maturity
    │                   ├── fd_receipts
    │                   ├── ocr_runs
    │                   ├── ocr_field_reviews
    │                   ├── fd_renewals (previous_fd → new_fd)
    │                   └── fd_closures (premature or at maturity)
    │
    └── (future) interest_payments, notifications
```

### Enums

```sql
create type public.family_role as enum ('family_admin', 'member');

create type public.interest_mode as enum (
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'cumulative',
  'on_maturity',
  'unknown'
);

create type public.fd_status as enum (
  'draft',      -- created only if we persist a draft; v1 can skip and insert on confirm
  'active',
  'matured',
  'closed',
  'renewed'
);

create type public.ocr_status as enum (
  'pending',
  'succeeded',
  'failed',
  'skipped'
);
```

### Tables

```sql
-- App user profile (1:1 with auth.users)
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         text,
  is_app_admin  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- Who may log in and see a family
create table public.family_memberships (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.family_role not null default 'member',
  created_at  timestamptz not null default now(),
  unique (family_id, user_id)
);

-- People who own FDs (not all of them have logins)
create table public.family_members (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  full_name       text not null,
  display_name    text,
  linked_user_id     uuid references public.profiles (id) on delete set null,
  bank_customer_id   text,          -- CID printed on the receipt, e.g. 1700
  date_of_birth      date,
  notes              text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Optional finer-grained grants (v1: unused means “whole family”)
create table public.member_access_grants (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  family_member_id  uuid not null references public.family_members (id) on delete cascade,
  unique (user_id, family_member_id)
);

create table public.fixed_deposits (
  id                        uuid primary key default gen_random_uuid(),
  family_id                 uuid not null references public.families (id) on delete cascade,
  family_member_id          uuid not null references public.family_members (id) on delete restrict,
  fd_account_no             text,                         -- FD-A/c No, e.g. 01FD40599
  bank_customer_id          text,                         -- CID as printed, may match family_members
  holder_name               text,                         -- as printed (Sri/Smt stripped)
  holder_address            text,
  principal_amount          numeric(14,2) not null check (principal_amount > 0),
  principal_amount_words    text,
  interest_rate_pct         numeric(6,3) check (interest_rate_pct is null or (interest_rate_pct >= 0 and interest_rate_pct <= 30)),
  tenure_years              integer not null default 0 check (tenure_years >= 0),
  tenure_months             integer not null default 0 check (tenure_months >= 0),
  tenure_days               integer not null default 0 check (tenure_days >= 0),
  tenure_label              text,                         -- e.g. "3 Years"
  interest_mode             public.interest_mode not null default 'unknown',
  monthly_interest_amount   numeric(14,2) check (monthly_interest_amount is null or monthly_interest_amount >= 0),
  interest_credit_account   text,                         -- MS A/c, e.g. 01003MS001396
  maturity_value            numeric(14,2) check (maturity_value is null or maturity_value >= 0),
  fd_date                   date,                         -- "FD Date" on the certificate
  transaction_date          date,
  print_at                  timestamptz,                  -- "Print Date: 26-May-2025 16:12:32"
  maturity_date             date,
  nominee_name              text,
  nominee_relationship      text,
  status                    public.fd_status not null default 'active',
  notes                     text,
  extra                     jsonb not null default '{}'::jsonb,
  created_by                uuid references public.profiles (id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (family_id, fd_account_no),
  check (
    tenure_years > 0 or tenure_months > 0 or tenure_days > 0
    or tenure_label is not null
    or maturity_date is not null
  )
);

-- One old FD → at most one new FD. New receipt is stored on the new row.
create table public.fd_renewals (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families (id) on delete cascade,
  previous_fd_id       uuid not null references public.fixed_deposits (id) on delete restrict,
  new_fd_id            uuid not null references public.fixed_deposits (id) on delete restrict,
  renewed_on           date not null,
  suggested_carry      numeric(14,2),  -- old maturity (on-maturity) or old principal (monthly)
  new_principal        numeric(14,2),  -- snapshot of new FD principal at confirm
  notes                text,
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  unique (previous_fd_id),
  unique (new_fd_id),
  check (previous_fd_id <> new_fd_id)
);

-- Taken out at or before maturity. One closure row per FD.
create table public.fd_closures (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  fd_id             uuid not null references public.fixed_deposits (id) on delete restrict,
  closed_on         date not null,
  amount_received   numeric(14,2) check (amount_received is null or amount_received >= 0),
  is_premature      boolean not null,
  notes             text,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  unique (fd_id)
);

create table public.fd_receipts (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  fd_id         uuid not null references public.fixed_deposits (id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text not null,
  file_size     integer check (file_size is null or file_size > 0),
  uploaded_by   uuid references public.profiles (id),
  is_current    boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.ocr_runs (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families (id) on delete cascade,
  fd_id               uuid references public.fixed_deposits (id) on delete set null,
  receipt_id          uuid references public.fd_receipts (id) on delete set null,
  storage_path        text not null,
  provider            text not null,          -- 'gemini-3.6-flash'
  status              public.ocr_status not null,
  raw_response        jsonb,                  -- full model payload
  raw_text            text,                   -- concatenated text if provided
  extracted_fields    jsonb not null default '{}'::jsonb,
  field_confidence    jsonb not null default '{}'::jsonb,  -- { "principal_amount": 0.86 }
  overall_confidence  numeric(4,3),
  error_message       text,
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now()
);

create table public.ocr_field_reviews (
  id                uuid primary key default gen_random_uuid(),
  ocr_run_id        uuid not null references public.ocr_runs (id) on delete cascade,
  fd_id             uuid not null references public.fixed_deposits (id) on delete cascade,
  field_name        text not null,
  extracted_value   text,
  confirmed_value   text,
  was_modified      boolean not null,
  confidence        numeric(4,3),
  unique (ocr_run_id, field_name)
);
```

### Indexes

```sql
create index idx_memberships_user on public.family_memberships (user_id);
create index idx_memberships_family on public.family_memberships (family_id);
create index idx_members_family on public.family_members (family_id);
create index idx_members_linked_user on public.family_members (linked_user_id);
create index idx_members_cid on public.family_members (family_id, bank_customer_id);
create index idx_grants_user on public.member_access_grants (user_id);
create index idx_fds_family on public.fixed_deposits (family_id);
create index idx_fds_member on public.fixed_deposits (family_member_id);
create index idx_fds_maturity on public.fixed_deposits (maturity_date);
create index idx_fds_status on public.fixed_deposits (status);
create index idx_fds_account on public.fixed_deposits (family_id, fd_account_no);
create index idx_receipts_fd on public.fd_receipts (fd_id);
create index idx_ocr_family on public.ocr_runs (family_id);
create index idx_ocr_fd on public.ocr_runs (fd_id);
create index idx_renewals_family on public.fd_renewals (family_id);
create index idx_renewals_new on public.fd_renewals (new_fd_id);
create index idx_closures_family on public.fd_closures (family_id);
create index idx_closures_date on public.fd_closures (closed_on);
```

### Constraints and triggers

- `fixed_deposits.family_id` must match `family_members.family_id` (trigger or `check` via constraint trigger).
- `fd_renewals.family_id` and both FD ids must belong to that family (constraint trigger).
- `fd_closures.family_id` must match the FD’s family. An FD cannot be both `renewed` and `closed`.
- An FD may be the `previous_fd_id` of at most one renewal; a new FD has at most one predecessor.
- Only one `fd_receipts.is_current = true` per `fd_id` (partial unique index) — ready for later receipt replacement.
- `updated_at` maintained by a small trigger.
- On `auth.users` insert → create `profiles`.
- Do **not** allow clients to set `profiles.is_app_admin` (revoke update on that column via trigger or `security invoker` view).

### Dashboard views (read through RLS)

```sql
create view public.fd_dashboard_rows
with (security_invoker = true) as
select
  fd.*,
  fm.full_name as member_name,
  coalesce(
    fd.monthly_interest_amount,
    case
      when fd.interest_mode = 'monthly' and fd.interest_rate_pct is not null
        then round(fd.principal_amount * fd.interest_rate_pct / 100 / 12, 2)
    end
  ) as monthly_interest,
  coalesce(
    fd.monthly_interest_amount,
    case
      when fd.interest_mode = 'monthly' and fd.interest_rate_pct is not null
        then round(fd.principal_amount * fd.interest_rate_pct / 100 / 12, 2)
    end
  ) * greatest(0, (
      extract(year from age(
        least(coalesce(fd.maturity_date, current_date), current_date),
        coalesce(fd.fd_date, fd.transaction_date)
      )) * 12
      + extract(month from age(
        least(coalesce(fd.maturity_date, current_date), current_date),
        coalesce(fd.fd_date, fd.transaction_date)
      ))
    ))::int
    as estimated_interest_to_date,
  (fd.maturity_date is not null and fd.maturity_date < current_date
     and fd.status = 'active') as is_past_due
from public.fixed_deposits fd
join public.family_members fm on fm.id = fd.family_member_id;
```

`security_invoker = true` means the view inherits `fixed_deposits` RLS. Never use `security definer` views for user data.

### Renewals and closures (v1)

When an FD matures, the society issues a **new** certificate with a new `FD-A/c No`. That is a new `fixed_deposits` row (new receipt, new OCR run), linked to the old one. We do **not** overwrite the old record.

If the family **breaks** the FD (or withdraws at maturity without rolling over), that is a **Close**, not a renewal.

```
active / matured  --[Renew + new photo]-->  old becomes renewed
                                          new is active
                                          fd_renewals links them

active / matured  --[Close]-------------->  status = closed
                                          fd_closures stores date + amount received
```

**Status rules**

| Status | Meaning | In dashboard totals? |
| --- | --- | --- |
| `active` | Current deposit | Yes |
| `matured` | Term ended, not yet renewed or closed | Principal no; show in “already matured” |
| `renewed` | Replaced by a new FD | No (follow the new row) |
| `closed` | Taken out (mid-term or at maturity), not renewed | No |

Allow **Renew** or **Close** from `active` or `matured`. Block both if the FD is already `renewed` or `closed`. An FD is never both renewed and closed.

**Close (including mid-term)**

Same action for “broke it early” and “took the money at maturity”. `is_premature` is computed: `closed_on < maturity_date` (true if there is no maturity date and they close while `active`).

On confirm:

1. Collect `closed_on` (default today), `amount_received` (what the bank actually paid), optional notes.
2. If `closed_on` is before `maturity_date`, show a **Premature closure** warning. Suggested received amount is still the principal; premature payouts are often less — the user types the real figure.
3. Insert `fd_closures`, set FD `status = closed`.
4. Original receipt stays on the FD. No new certificate is required (the society may only give a credit advice). Optional photo later can use `fd_receipts` if they have one; not required in v1.

Amount check (informational):

- Premature: received vs principal — “₹X less than principal” is common (penalty / interest reversal).
- At or after maturity, monthly FD: received vs principal.
- At or after maturity, on-maturity FD: received vs `maturity_value`.

Closing does **not** create a new FD. A later fresh deposit is **Add FD**. v1 does not let you renew a closed FD.

**On renew confirm**

1. Insert the new FD from the verified form (`status = active`).
2. Insert `fd_renewals` (`renewed_on` = new `fd_date` if present, else today).
3. Set `suggested_carry` = old `maturity_value` when old mode is `on_maturity`, else old `principal_amount`.
4. Store `new_principal` from the new receipt.
5. Set the old FD to `renewed`.
6. Keep the old receipt on the old FD; the new photo belongs only to the new FD.

**Carry vs new principal** (informational, not blocking)

- If new principal ≈ suggested carry → “rolled over in full”.
- If new > carry → “₹X added”.
- If new < carry → “₹X taken out”.

The two sample receipts are **not** a renewal pair (they overlap in time). Use them only as form fixtures.

**Chain view:** walk `fd_renewals` in both directions so a detail page can show `01FD10000 → 01FD20000 → 01FD30000`.

Dashboard queries use `status = 'active'` for outstanding principal, monthly income, and upcoming maturities. Renewed and closed rows stay in history. Premature closures can later feed a simple “broken early” list; not a v1 dashboard card.

### Intentionally deferred tables (schema-ready, not built now)

| Future feature | Likely table |
| --- | --- |
| Interest payment tracking | `interest_payments (fd_id, paid_on, amount, tds_amount)` |
| Notifications | `notification_preferences`, `notification_log` |
| Audit history | `audit_events` or Supabase audit |
| Multiple nominees | `fd_nominees` (v1 keeps two columns on `fixed_deposits`) |
| Receipt versioning | already supported by `fd_receipts.is_current` |
| Partial / split renewals | not in v1 — one old FD → one new FD |

`extra jsonb` on `fixed_deposits` absorbs one-off fields (scheme code, branch IFSC) without migrations until they become first-class.

---

## D. Security (RLS)

**Rule:** every query from the browser uses the user’s JWT. The service role is used only in Edge Functions and never shipped to Vite.

### Roles

| Role | Who | Access |
| --- | --- | --- |
| **App Admin** | `profiles.is_app_admin = true` | All families, members, FDs, receipts, OCR rows. Manages members across families. |
| **Family Admin** | `family_memberships.role = 'family_admin'` | All members and FDs **in that family only**. |
| **Family Member** | `family_memberships.role = 'member'` | v1: same family-scoped read/write as family admin for FDs they create, plus read of family members. If `member_access_grants` rows exist for that user, restrict to those members. |

v1 recommendation: **family-level isolation is the hard security boundary**. Member-level grants are in the schema so we can tighten later without a rewrite. Enable grants in RLS from day one so the policy is already correct:

- If the user is app admin → allow.
- Else user must have a `family_memberships` row for `family_id`.
- If the user has **any** `member_access_grants` for that family, they may only see those `family_member_id`s.
- If they have **no** grants, they see the whole family (typical household).

That matches “authorized to see” without forcing grant setup for a single family that trusts all logins.

### Helper functions (`security definer`, `stable`, locked `search_path`)

```sql
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_app_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.has_family_access(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin()
      or exists (
        select 1
        from public.family_memberships m
        where m.family_id = p_family_id
          and m.user_id = auth.uid()
      );
$$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin()
      or exists (
        select 1
        from public.family_memberships m
        where m.family_id = p_family_id
          and m.user_id = auth.uid()
          and m.role = 'family_admin'
      );
$$;

create or replace function public.can_access_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.id = p_member_id
      and public.has_family_access(fm.family_id)
      and (
        public.is_app_admin()
        or public.is_family_admin(fm.family_id)
        or not exists (
          select 1 from public.member_access_grants g
          where g.user_id = auth.uid() and g.family_id = fm.family_id
        )
        or exists (
          select 1 from public.member_access_grants g
          where g.user_id = auth.uid() and g.family_member_id = fm.id
        )
      )
  );
$$;
```

### Policy pattern (every user table)

Enable RLS on all of the above. Example for `fixed_deposits`:

- **SELECT:** `has_family_access(family_id) AND can_access_member(family_member_id)`
- **INSERT:** same, plus `family_id` matches the member’s family (enforced by trigger).
- **UPDATE / DELETE:** `is_family_admin(family_id) OR created_by = auth.uid() OR is_app_admin()` — or simply family-scoped write for all members in v1 if the household prefers it.

`profiles`: users can read/update **their own** row except `is_app_admin`. App admins can read all profiles.

`family_memberships`: readable by family members; writable by family admin / app admin.

`ocr_runs` / `fd_receipts` / `fd_renewals` / `fd_closures`: same family + member checks via joined `family_id`.

### Storage RLS

Bucket `fd-receipts`, **not public**.

- Path: `{family_id}/...`
- `storage.objects` policies: authenticated users may `insert/select/update/delete` only when `has_family_access((storage.foldername(name))[1]::uuid)`.
- Client never uses a public URL. Viewer requests `createSignedUrl(path, 600)`.

### Edge Function auth

1. Require `Authorization: Bearer <user access token>`.
2. Create a user-scoped Supabase client to verify the path’s `family_id`.
3. Use the service role **only** to download the object and insert `ocr_runs` after the check passes.
4. Rate-limit by `user_id` (e.g. 20 OCR calls / hour) to protect the Gemini quota.

### Other rules

- No service-role key, Gemini key, or webhook secrets in `VITE_*` env vars.
- Zod-validate OCR JSON on the server before returning it.
- Check amounts/dates again on FD insert (DB constraints + client schema).
- CORS on the Edge Function: app origin only.

---

## E. OCR Design

### Pipeline

```
Photo (client compress ≤ 1600px / JPEG ~0.8)
        │
        ▼
Private Storage upload
        │
        ▼
Edge Function extract-fd-receipt
        │
        ├─ authorize
        ├─ download bytes
        ├─ Gemini 2.5 Flash (prompt describes THIS Lalitamba form)
        │     responseMimeType: application/json
        │     responseSchema: LalitambaFdExtraction
        ├─ Lalitamba mapper (interest line, DD-MM-YYYY, 150000/-)
        ├─ persist ocr_runs
        └─ return { fields, confidence, ocrRunId, warnings[] }
        │
        ▼
Verification form (all fields editable)
        │
        ▼
Confirm → fixed_deposits + fd_receipts + ocr_field_reviews
```

### Extracted JSON contract

```ts
type FdExtraction = {
  holder_name: string | null
  holder_address: string | null
  bank_customer_id: string | null          // CID
  fd_account_no: string | null             // FD-A/c No
  principal_amount: number | null
  principal_amount_words: string | null
  interest_rate_pct: number | null
  tenure_years: number | null
  tenure_months: number | null
  tenure_days: number | null
  tenure_label: string | null
  interest_mode: InterestMode | null
  monthly_interest_amount: number | null
  interest_credit_account: string | null   // MS A/c
  maturity_value: number | null
  fd_date: string | null                   // YYYY-MM-DD
  transaction_date: string | null
  print_at: string | null                  // ISO timestamp
  maturity_date: string | null
  nominee_name: string | null
  nominee_relationship: string | null
}
```

Each field also has optional confidence `0–1` (present + parseable ≈ 0.8).

### Lalitamba mapper (not a multi-bank plugin)

```ts
function parseInterestLine(line: string): {
  monthly_interest_amount: number | null
  interest_mode: InterestMode | null
  interest_credit_account: string | null
}
// "Rs. 1375/- Monthly CR To MS A/c :01003MS001396"
```

Gemini is asked for both the raw interest line and the split fields. The mapper is the source of truth for splitting. The extractor interface stays so we can swap Gemini for a fixture in tests.

### Normalization rules (this form)

- Amounts: `150000/-` → `150000`; ignore Indian grouping if present.
- Rate: `11.00 %` → `11`.
- Dates: `26-05-2025` and `26-May-2025 16:12:32` (Asia/Kolkata).
- Tenure: `3 Years` → `tenure_years = 3`, `tenure_label = "3 Years"`.
- Name: strip `Sri/Smt` / `Sri` / `Smt`.
- Interest line as above. If the stamp hides the amount, leave it null and warn.
- Interest line: `Monthly CR To MS A/c` → monthly + amount + account; `Interest Mode : On Maturity` → `on_maturity` and null payout fields.
- If `interest_mode = monthly` and maturity value equals principal, that is **correct**.
- If `interest_mode = on_maturity`, expected maturity is **simple interest**: `principal + principal × rate% × years` (sample: 450000 + 450000 × 0.11 × 5 = 697500). Do not use compound interest.
- Accept the printed typo `Maturtiy Value`.
- Client converts HEIF (iPhone) to JPEG before upload.

### Verification metadata

On confirm, write one `ocr_field_reviews` row per mapped field:

- `extracted_value` vs `confirmed_value`
- `was_modified` if they differ (normalized compare)
- stored confidence

This is the dataset for tightening the Lalitamba prompt and mapper.

### If Gemini is unavailable

- Status `failed` or `skipped`
- Form opens empty (or last successful run)
- User enters data by hand
- Receipt still saved

---

## F. UI/UX

Mobile-first. Primary action on a phone: photograph a receipt and confirm fields. Bottom nav on small screens; side nav on desktop.

| Screen | Purpose |
| --- | --- |
| **Login** | Email/password. Error and loading states. No public marketing page. |
| **Dashboard** | Total FDs, principal outstanding, **total maturity value** (higher when some FDs are on-maturity), monthly income from monthly FDs only, interest locked until maturity (`maturity − principal` on those). Maturing ≤30d / ≤90d. By member, not by bank. |
| **Family Members** | List people. Show CID when known. Admin: add/edit. Each row: FD count + principal. |
| **FD List** | Search name / FD-A/c / CID. Filters: member, status, maturing window. |
| **Add FD** | 1) Choose member 2) **Take photo** (rear camera) **or Upload from gallery** 3) Progress: uploading → reading receipt 4) On failure, continue manually. Optional: “This renews an existing FD”. |
| **Renew FD** | From an active / matured FD: **Renew**. Same capture + OCR as Add FD, old FD locked as predecessor. Banner: “Renewing 01FD32450 · ₹4,50,000”. |
| **Close FD** | From an active / matured FD: **Close**. Sheet: close date, amount received, notes. If the date is before maturity, label **Premature closure** and warn that the bank may pay less than principal / maturity value. No new receipt required. |
| **OCR Verification** | Editable Lalitamba form. CID → member. Mode-specific warnings. If a renewal: show carry vs new principal (“rolled over” / “₹X added” / “₹X taken out”). |
| **FD Details** | Certificate fields, mode, receipt. **Renew** and **Close** when allowed. Chain for renewals. Closed FDs show closed-on, amount received, premature badge. |
| **Receipt Viewer** | Full-screen image via signed URL. Pinch-zoom on mobile. |
| **Settings / Admin** | App admin: list families, grant `is_app_admin` (or document SQL for v1), manage memberships. Regular user: name, family, sign out. |

### PWA

Most use is on a phone; desktop is supported in the same app.

- Web app manifest (name **Lalitamba FD Gadag**, standalone display, icons).
- Service worker caches the app shell so a second open is fast. **Not** a full offline ledger: login, OCR, and new uploads still need the network. Already-loaded lists can linger briefly via TanStack Query.
- **Add to Home Screen:** Android Chrome install prompt; iPhone Safari Share → Add to Home Screen. Desktop Chrome/Edge can install too.
- `display: standalone` so it looks like an app (no browser chrome).
- Camera and gallery both work in the installed PWA (they are normal file inputs).
- HTTPS via Vercel (required for install + camera).

This is not a native iOS/Android store app.

### Photo: camera or gallery

Add FD and Renew always offer **both**:

1. **Take photo** — `capture="environment"` so the phone opens the rear camera (receipts on a table).
2. **Upload from gallery** — same `accept` without capture, so the user picks an existing image (or a HEIF from iCloud).

Also accept PDF if they scanned a slip. Convert HEIF → JPEG in the browser, then compress, then upload.

On desktop, “Take photo” uses a webcam if present; “Upload” is the usual file picker. Same two buttons, no separate desktop flow.

### Mobile details

- Large tap targets; sticky **Confirm** on the verification screen.
- Dashboard cards stack to one column; tables become stacked definition lists under ~640px.

### Empty / loading / error

- Empty lists: short explanation + Add action.
- OCR in progress: skeleton form + “Reading receipt…”.
- OCR error: toast + manual form.
- Forbidden (RLS): generic “You don’t have access”.

---

## G. Development Plan

Implementation waits until this design is accepted. Then small phases, each testable.

### Phase 1 — Project setup + authentication — done

**Build:** Vite/React/TS app, Tailwind, shadcn, React Router, `vite-plugin-pwa` (manifest + icons), Supabase client, login/logout, protected routes, `profiles` trigger. Demo-mode fallback when Supabase env vars are missing.

**Test:** Sign up / sign in / sign out. Unauthenticated users cannot open `/dashboard`. Env vars documented. No secrets in the client bundle.

### Phase 2 — Database + RLS — done

**Build:** Migrations for enums, tables, indexes, helpers, RLS, private `fd-receipts` bucket, dashboard view, and seed. The app loads household data through RLS (or a local simulation in demo mode).

**Test:** `other@family.test` cannot see Mulgund FDs. `admin@family.test` sees both families. Clients cannot set `is_app_admin`.

### Phase 3 — Family / member management — done

**Build:** Members list, add/edit (name, CID, notes). First-time users can create a family via `create_family`. Bottom nav: Home, Members, FDs, Settings.

**Test:** Family admin adds a member. Other family cannot see them. Empty name is rejected.

### Phase 4 — FD CRUD (manual, no OCR) — done

**Build:** Add FD form (certificate fields), list, detail, edit, soft status (`draft` / `active` / `matured`). Associate with a member. Mode-specific sanity checks (monthly payout vs on-maturity simple interest).

**Test:** Constraints reject amount `0`, rate `80`. Other family cannot open a Mulgund FD URL.

### Phase 5 — Receipt storage — done

**Build:** Upload on add/edit: **Take photo** and **Upload from gallery**, HEIF→JPEG, compress, private bucket, signed URL viewer, `fd_receipts` row. Replacing a file marks the previous row `is_current = false`.

**Test:** Direct public URL 400/403. Other family signed URL denied. Replace file later still has `is_current`.

### Phase 6 — OCR integration — done

**Build:** Edge Function `extract-fd-receipt` + Gemini 2.5 Flash + Lalitamba mapper + `ocr_runs`. Fixture expected JSON in `samples/receipts/`. The Add FD form prefills from extraction and still requires Save. Gemini key stays off `VITE_*`.

**Test:** Both fixtures. Monthly slip → mode monthly, ₹1,375, MS A/c, maturity = principal. On-maturity slip → mode `on_maturity`, no MS A/c, maturity ₹6,97,500. Accept `Maturtiy Value`. Gemini key absent from the bundle.

### Phase 7 — OCR verification — done

**Build:** Prefill the Lalitamba form, CID → member suggestion, badges, warnings, `ocr_field_reviews`. Never save FD on extract alone.

**Test:** Monthly: 1375 vs formula = no warning; maturity = principal = no warning. On-maturity: 697500 vs simple-interest formula = no warning; maturity = principal **does** warn. Edit rate → `was_modified`.

### Phase 8 — Dashboard — done

**Build:** Principal, total maturity value, monthly income (monthly FDs only), locked interest (on-maturity), maturity buckets, by-member totals.

**Test:** Seed both samples (₹1.5L monthly + ₹4.5L on-maturity). Monthly income ₹1,375. Maturity total ₹1,50,000 + ₹6,97,500. Spreadsheet match. RLS holds.

### Phase 9 — FD renewal — done

**Build:** Renew and Close on FD detail. Renew reuses Add FD + OCR and writes `fd_renewals`. Close writes `fd_closures` (date, amount received, `is_premature`). Dashboard stays on `active` only.

**Test:** Renew a matured fixture with a second photo — no double-count. Close an active FD before maturity — `is_premature` true, dropped from totals, original receipt still visible. Cannot close a renewed FD or renew a closed FD. Second close rejected.

### Phase 10 — Testing / security pass

**Build:** RLS SQL tests, a few component tests, checklist (keys, bucket public flag, admin column).

**Test:** Two browsers, two users. Storage path traversal (`../other-family-id`) denied. Rate-limit OCR.

### Phase 11 — Deployment

**Build:** Vercel project, production Supabase, Edge Function secrets, README with setup. First household admin set via SQL.

**Test:** Production login, install PWA on a phone, take a photo *and* pick from gallery, confirm, dashboard. Pause/backup notes in README.

---

## Sample receipts

Two real certificates (monthly and on-maturity) are in `samples/receipts/` and annotated in [`docs/SAMPLE_RECEIPT.md`](docs/SAMPLE_RECEIPT.md). Extra modes (quarterly, etc.) would help later but are not required for Phases 1–5.

---

## What we will not build in v1

Multi-bank directory, SBI/HDFC parsers, notification emails/push, actual interest payment ledger, TDS, multiple nominees, split renewals, Excel/PDF export, native store apps, full offline mode, audit log UI, receipt version browser beyond `is_current`.

---

## Decision summary

| Topic | Decision |
| --- | --- |
| Institution | Shri Lalitamba Pattina Souharda Sahakari Ltd, Gadag only |
| Frontend | Vite, React, TypeScript, Tailwind, shadcn/ui, PWA, Vercel |
| Backend | Supabase Auth + Postgres + Edge Functions |
| Storage | Private Supabase Storage bucket + signed URLs |
| OCR | Gemini 2.5 Flash + Lalitamba interest-line mapper |
| Authz | App admin + family membership + optional member grants; RLS on every table |
| Correctness | OCR is a draft; user confirm writes the FD |
| Interest | Two modes on the same form: monthly → MS A/c, or on-maturity simple interest |
| Renewal | New FD + new receipt, linked via `fd_renewals`; old status becomes `renewed` |
| Closure | Close mid-term or at maturity; `fd_closures` stores date + amount received |
| Cost | Free tiers are enough for a household |
