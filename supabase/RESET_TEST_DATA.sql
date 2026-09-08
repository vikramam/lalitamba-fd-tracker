-- Wipe FD rows only. Storage files cannot be deleted here — Supabase blocks
-- DELETE on storage.objects so the real files are not left orphaned.
--
-- 1. Run this in the SQL editor.
-- 2. Then either empty the `fd-receipts` bucket in Storage, or use
--    Settings → Clear test data in the app (uses the Storage API).

begin;

delete from public.ocr_field_reviews;
delete from public.ocr_runs;
delete from public.fd_receipts;
delete from public.fd_renewals;
delete from public.fd_closures;
delete from public.fixed_deposits;

commit;

select
  (select count(*) from public.fixed_deposits) as fds,
  (select count(*) from public.fd_receipts) as receipts,
  (select count(*) from public.ocr_runs) as ocr_runs,
  (select count(*) from public.ocr_field_reviews) as reviews,
  (select count(*) from public.fd_renewals) as renewals,
  (select count(*) from public.fd_closures) as closures;

-- Optional: also wipe people and families (still keeps auth.users / profiles).
-- begin;
-- delete from public.member_access_grants;
-- delete from public.family_members;
-- delete from public.family_memberships;
-- delete from public.families;
-- commit;
