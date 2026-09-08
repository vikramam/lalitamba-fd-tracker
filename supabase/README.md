# Supabase

If you already ran the first five migrations, run **`migrations/0006_create_family.sql`** once so a signed-in user can start a family.

New projects: run **`APPLY_ALL.sql`** (all six files concatenated).

Or apply them in order:

1. `migrations/0001_profiles.sql`
2. `migrations/0002_schema.sql`
3. `migrations/0003_rls.sql`
4. `migrations/0004_storage.sql`
5. `migrations/0005_dashboard_view.sql`
6. `migrations/0006_create_family.sql`

Then create Auth users (or use **Create account** in the app) and run `seed.sql`.

To wipe deposits, OCR rows, and receipt files for a clean test (keeps login, family, and members), use **Settings → Clear test data** in the app. That uses the Storage API. `RESET_TEST_DATA.sql` only deletes table rows — do not `DELETE` from `storage.objects`.

Never expose the service-role key to the Vite app. The browser only uses the anon key plus the user JWT. RLS is the access control.

## RLS check

As `other@family.test`:

```sql
select fd_account_no from public.fixed_deposits;
-- must not include 01FD40599 or 01FD32450
```

As `admin@family.test` the same query returns every family.

Receipt photos live in the private Storage bucket `fd-receipts`. A public object URL must not work:

```
GET {SUPABASE_URL}/storage/v1/object/public/fd-receipts/{family_id}/…
# 400 / 401 / 403 / 404
```

Signed URLs are created only for a user who already has family access. Another family cannot mint one for your path.

## OCR function

Deploy `functions/extract-fd-receipt` and set the Gemini secret on the function — never in Vite:

```
supabase functions deploy extract-fd-receipt
supabase secrets set GEMINI_API_KEY=...
```

Set `APP_ORIGIN` to the live site if it is not a `*.vercel.app` URL (comma-separated if you have more than one):

```
supabase secrets set APP_ORIGIN=https://your-app.vercel.app
```

`*.vercel.app` and localhost are allowed without that secret. The Gemini key never goes in Vercel `VITE_*` variables.

If the key is missing, the function writes `ocr_runs.status = skipped` and the form stays manual. The browser bundle must not contain `GEMINI_API_KEY`.
