-- Phase 1: profile row for each Auth user.
-- Apply in the Supabase SQL editor, or via the Supabase CLI.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         text,
  is_app_admin  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own non-admin fields"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.prevent_self_grant_admin()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.is_app_admin is distinct from old.is_app_admin then
    raise exception 'is_app_admin can only be changed in the SQL editor';
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
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
