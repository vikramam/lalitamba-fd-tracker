# Lalitamba FD Gadag

A private PWA for one family’s Fixed Deposits at **Shri Lalitamba Pattina Souharda Sahakari Ltd, Gadag**.

Photograph a certificate, confirm the extracted fields, store the receipt, and track maturity, monthly interest, renewals, and closures.

## Current slice (Phases 1–9)

Sign in, manage the household, photograph a certificate, confirm the extracted fields, then track the deposit through maturity, renewal, or close.

**Take photo** or **From gallery**, then the app reads the slip. Extracted fields show **From receipt**, **Corrected**, or **Check this**. Saving writes `ocr_field_reviews`. The dashboard counts **active** FDs only: principal, monthly income, maturity total, locked interest, due-in-90-days, and totals by member. **Renew** photographs a new certificate and links `fd_renewals`. **Close** records the payout and whether it was premature.

OCR runs in the `extract-fd-receipt` Edge Function with Gemini 2.5 Flash first (then Flash-Lite, then 3.6 if needed) — the Gemini key never enters `VITE_*`. Without Gemini, type the fields; demo mode can fill from the sample filenames `01FD40599` and `01FD32450`.

Amount `0` and rate `80` are rejected. Another family cannot open your deposits or receipts. Renewed and closed rows stay in history and drop out of outstanding totals.

To start a test over, use **Settings → Clear test data** (type `DELETE`). That removes FDs, OCR rows, and files through the Storage API. Or run `supabase/RESET_TEST_DATA.sql` for the rows only, then empty the `fd-receipts` bucket in Storage. Login and members stay.

Without Supabase keys the app runs in **demo mode** (access rules are simulated):

| Email | Sees |
| --- | --- |
| `vikram@family.test` | Mulgund family FDs only (₹6 L) |
| `other@family.test` | Other family only (₹1 L) |
| `admin@family.test` | Both families |

Password: any 6+ characters.

The local app is pointed at the family Supabase project. **You still need to run the schema once:**

1. Open [Supabase SQL editor](https://supabase.com/dashboard/project/fhcfgamxsvbiodhiapit/sql)
2. Paste and run `supabase/APPLY_ALL.sql`
3. In Authentication → Providers, keep Email enabled. For a family app you can turn **off** “Confirm email” so you can sign in immediately.
4. In the app, use **Create account** with your email, then sign in.
5. Optional: create `vikram@family.test`, `other@family.test`, `admin@family.test` and run `supabase/seed.sql`. To make someone an app admin, run  
   `update public.profiles set is_app_admin = true where email = 'you@yourdomain';`

## Run locally

```bash
npm install
cp .env.example .env
# Optional — add real keys for Supabase Auth:
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
npm run dev
```

Dev server: `http://127.0.0.1:43187`

Never put the service-role key or a Gemini key in `VITE_*` variables.

## Stack

- Vite, React, TypeScript, Tailwind, shadcn/ui, PWA
- Supabase Auth (or local demo fallback)
- Host on Vercel when you are ready

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design
- [docs/DESIGN.md](./docs/DESIGN.md) — how MIG tokens land in this app
- [docs/design-system.md](./docs/design-system.md) — portable MIG style guide
- [docs/SAMPLE_RECEIPT.md](./docs/SAMPLE_RECEIPT.md) — Lalitamba receipt fields
