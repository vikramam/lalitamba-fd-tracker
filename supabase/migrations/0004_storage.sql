-- Private receipt bucket. Path: {family_id}/{uploader_id}/{fd_or_draft_id}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fd-receipts',
  'fd-receipts',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_storage_select" on storage.objects;
drop policy if exists "receipts_storage_insert" on storage.objects;
drop policy if exists "receipts_storage_update" on storage.objects;
drop policy if exists "receipts_storage_delete" on storage.objects;

create policy "receipts_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fd-receipts'
    and public.has_family_access(((storage.foldername(name))[1])::uuid)
  );

create policy "receipts_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fd-receipts'
    and public.has_family_access(((storage.foldername(name))[1])::uuid)
  );

create policy "receipts_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fd-receipts'
    and public.has_family_access(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'fd-receipts'
    and public.has_family_access(((storage.foldername(name))[1])::uuid)
  );

create policy "receipts_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fd-receipts'
    and public.has_family_access(((storage.foldername(name))[1])::uuid)
  );
