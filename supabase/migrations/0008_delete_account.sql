-- Allow admins to delete approved accounts that created families or FDs.
-- The old delete failed on foreign keys (created_by / uploaded_by).

create or replace function public.delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not allowed';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account.';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and is_super_admin
  ) then
    raise exception 'Cannot delete a super admin';
  end if;

  update public.families set created_by = null where created_by = p_user_id;
  update public.fixed_deposits set created_by = null where created_by = p_user_id;
  update public.fd_renewals set created_by = null where created_by = p_user_id;
  update public.fd_closures set created_by = null where created_by = p_user_id;
  update public.fd_receipts set uploaded_by = null where uploaded_by = p_user_id;
  update public.ocr_runs set created_by = null where created_by = p_user_id;
  update public.family_members set linked_user_id = null where linked_user_id = p_user_id;

  delete from public.family_memberships where user_id = p_user_id;
  delete from public.member_access_grants where user_id = p_user_id;

  begin
    delete from auth.users where id = p_user_id;
  exception
    when others then
      perform set_config('lalitamba.admin_write', 'on', true);
      delete from public.profiles where id = p_user_id;
      raise exception
        'Removed their profile, but could not delete the login (%). Delete that user in Supabase Authentication if they can still sign in.',
        sqlerrm;
  end;

  if exists (select 1 from public.profiles where id = p_user_id) then
    perform set_config('lalitamba.admin_write', 'on', true);
    delete from public.profiles where id = p_user_id;
  end if;
end;
$$;

grant execute on function public.delete_account(uuid) to authenticated;
