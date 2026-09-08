-- Account approval + super admin.
-- New sign-ups wait until an app admin approves them.
-- Only a super admin can grant or remove app admin.

alter table public.profiles
  add column if not exists approval_status text not null default 'pending',
  add column if not exists is_super_admin boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_approval_status_check;

alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

update public.profiles
set approval_status = 'approved'
where approval_status = 'pending';

update public.profiles
set is_super_admin = true
where is_app_admin = true;

update public.profiles
set
  is_super_admin = true,
  is_app_admin = true,
  approval_status = 'approved'
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where is_super_admin);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_app_admin
      from public.profiles p
      where p.id = auth.uid()
        and p.approval_status = 'approved'
    ),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_super_admin
      from public.profiles p
      where p.id = auth.uid()
        and p.approval_status = 'approved'
    ),
    false
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

create or replace function public.prevent_self_grant_admin()
returns trigger
language plpgsql
as $$
begin
  if current_setting('lalitamba.admin_write', true) = 'on' then
    return new;
  end if;
  if auth.uid() is not null
     and (
       new.is_app_admin is distinct from old.is_app_admin
       or new.is_super_admin is distinct from old.is_super_admin
       or new.approval_status is distinct from old.approval_status
     ) then
    raise exception 'These fields can only be changed by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_admin on public.profiles;
create trigger profiles_lock_admin
  before update on public.profiles
  for each row execute function public.prevent_self_grant_admin();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_super boolean;
begin
  select exists(select 1 from public.profiles where is_super_admin) into has_super;
  insert into public.profiles (
    id,
    email,
    full_name,
    approval_status,
    is_app_admin,
    is_super_admin
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when not has_super then 'approved' else 'pending' end,
    not has_super,
    not has_super
  );
  return new;
end;
$$;

create or replace function public.set_account_approval(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid status';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own approval.';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and is_super_admin
  ) then
    raise exception 'Cannot change a super admin account';
  end if;

  perform set_config('lalitamba.admin_write', 'on', true);
  update public.profiles
  set
    approval_status = p_status,
    is_app_admin = case
      when p_status = 'approved' then is_app_admin
      else false
    end
  where id = p_user_id;
end;
$$;

create or replace function public.set_app_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can change admin access.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own admin access.';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and is_super_admin
  ) then
    raise exception 'Cannot change a super admin';
  end if;

  perform set_config('lalitamba.admin_write', 'on', true);
  update public.profiles
  set
    is_app_admin = p_is_admin,
    approval_status = case when p_is_admin then 'approved' else approval_status end
  where id = p_user_id;
end;
$$;

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

grant execute on function public.set_account_approval(uuid, text) to authenticated;
grant execute on function public.set_app_admin(uuid, boolean) to authenticated;
grant execute on function public.delete_account(uuid) to authenticated;
