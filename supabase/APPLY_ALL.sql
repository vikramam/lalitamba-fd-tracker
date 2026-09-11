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
-- Phase 2: core tables for families, members, FDs, receipts, OCR, renewals, closures.

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
  'draft',
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

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.family_memberships (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.family_role not null default 'member',
  created_at  timestamptz not null default now(),
  unique (family_id, user_id)
);

create table public.family_members (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  full_name          text not null,
  display_name       text,
  linked_user_id     uuid references public.profiles (id) on delete set null,
  bank_customer_id   text,
  date_of_birth      date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.member_access_grants (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  family_member_id  uuid not null references public.family_members (id) on delete cascade,
  unique (user_id, family_member_id)
);

create table public.fixed_deposits (
  id                      uuid primary key default gen_random_uuid(),
  family_id               uuid not null references public.families (id) on delete cascade,
  family_member_id        uuid not null references public.family_members (id) on delete restrict,
  fd_account_no           text,
  bank_customer_id        text,
  holder_name             text,
  holder_address          text,
  principal_amount        numeric(14,2) not null check (principal_amount > 0),
  principal_amount_words  text,
  interest_rate_pct       numeric(6,3) check (
    interest_rate_pct is null or (interest_rate_pct >= 0 and interest_rate_pct <= 30)
  ),
  tenure_years            integer not null default 0 check (tenure_years >= 0),
  tenure_months           integer not null default 0 check (tenure_months >= 0),
  tenure_days             integer not null default 0 check (tenure_days >= 0),
  tenure_label            text,
  interest_mode           public.interest_mode not null default 'unknown',
  monthly_interest_amount numeric(14,2) check (
    monthly_interest_amount is null or monthly_interest_amount >= 0
  ),
  interest_credit_account text,
  maturity_value          numeric(14,2) check (maturity_value is null or maturity_value >= 0),
  fd_date                 date,
  transaction_date        date,
  print_at                timestamptz,
  maturity_date           date,
  nominee_name            text,
  nominee_relationship    text,
  status                  public.fd_status not null default 'active',
  notes                   text,
  extra                   jsonb not null default '{}'::jsonb,
  created_by              uuid references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (
    tenure_years > 0
    or tenure_months > 0
    or tenure_days > 0
    or tenure_label is not null
    or maturity_date is not null
  )
);

create table public.fd_renewals (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  previous_fd_id  uuid not null references public.fixed_deposits (id) on delete restrict,
  new_fd_id       uuid not null references public.fixed_deposits (id) on delete restrict,
  renewed_on      date not null,
  suggested_carry numeric(14,2),
  new_principal   numeric(14,2),
  notes           text,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (previous_fd_id),
  unique (new_fd_id),
  check (previous_fd_id <> new_fd_id)
);

create table public.fd_closures (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  fd_id           uuid not null references public.fixed_deposits (id) on delete restrict,
  closed_on       date not null,
  amount_received numeric(14,2) check (amount_received is null or amount_received >= 0),
  is_premature    boolean not null,
  notes           text,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (fd_id)
);

create table public.fd_receipts (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  fd_id        uuid not null references public.fixed_deposits (id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null,
  file_size    integer check (file_size is null or file_size > 0),
  uploaded_by  uuid references public.profiles (id),
  is_current   boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.ocr_runs (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  fd_id              uuid references public.fixed_deposits (id) on delete set null,
  receipt_id         uuid references public.fd_receipts (id) on delete set null,
  storage_path       text not null,
  provider           text not null,
  status             public.ocr_status not null,
  raw_response       jsonb,
  raw_text           text,
  extracted_fields   jsonb not null default '{}'::jsonb,
  field_confidence   jsonb not null default '{}'::jsonb,
  overall_confidence numeric(4,3),
  error_message      text,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);

create table public.ocr_field_reviews (
  id              uuid primary key default gen_random_uuid(),
  ocr_run_id      uuid not null references public.ocr_runs (id) on delete cascade,
  fd_id           uuid not null references public.fixed_deposits (id) on delete cascade,
  field_name      text not null,
  extracted_value text,
  confirmed_value text,
  was_modified    boolean not null,
  confidence      numeric(4,3),
  unique (ocr_run_id, field_name)
);

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
create unique index idx_fds_account_unique
  on public.fixed_deposits (lower(btrim(fd_account_no)))
  where fd_account_no is not null and btrim(fd_account_no) <> '';
create index idx_receipts_fd on public.fd_receipts (fd_id);
create unique index idx_receipts_current
  on public.fd_receipts (fd_id)
  where is_current;
create index idx_ocr_family on public.ocr_runs (family_id);
create index idx_ocr_fd on public.ocr_runs (fd_id);
create index idx_renewals_family on public.fd_renewals (family_id);
create index idx_renewals_new on public.fd_renewals (new_fd_id);
create index idx_closures_family on public.fd_closures (family_id);
create index idx_closures_date on public.fd_closures (closed_on);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger family_members_updated_at
  before update on public.family_members
  for each row execute function public.set_updated_at();

create trigger fixed_deposits_updated_at
  before update on public.fixed_deposits
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.enforce_fd_family_match()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.family_members fm
    where fm.id = new.family_member_id
      and fm.family_id = new.family_id
  ) then
    raise exception 'fixed_deposits.family_id must match family_members.family_id';
  end if;
  return new;
end;
$$;

create trigger fixed_deposits_family_match
  before insert or update on public.fixed_deposits
  for each row execute function public.enforce_fd_family_match();

create or replace function public.enforce_renewal_family()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.fixed_deposits p
    where p.id = new.previous_fd_id and p.family_id = new.family_id
  ) or not exists (
    select 1 from public.fixed_deposits n
    where n.id = new.new_fd_id and n.family_id = new.family_id
  ) then
    raise exception 'renewal FDs must belong to the same family';
  end if;
  return new;
end;
$$;

create trigger fd_renewals_family_match
  before insert or update on public.fd_renewals
  for each row execute function public.enforce_renewal_family();

create or replace function public.enforce_closure_family()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.fixed_deposits fd
    where fd.id = new.fd_id and fd.family_id = new.family_id
  ) then
    raise exception 'closure family_id must match the FD';
  end if;
  if exists (select 1 from public.fd_renewals r where r.previous_fd_id = new.fd_id) then
    raise exception 'a renewed FD cannot be closed';
  end if;
  return new;
end;
$$;

create trigger fd_closures_family_match
  before insert or update on public.fd_closures
  for each row execute function public.enforce_closure_family();
-- Phase 2: helper functions and Row Level Security.

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

grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.family_memberships to authenticated;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.member_access_grants to authenticated;
grant select, insert, update, delete on public.fixed_deposits to authenticated;
grant select, insert, update, delete on public.fd_renewals to authenticated;
grant select, insert, update, delete on public.fd_closures to authenticated;
grant select, insert, update, delete on public.fd_receipts to authenticated;
grant select, insert, update, delete on public.ocr_runs to authenticated;
grant select, insert, update, delete on public.ocr_field_reviews to authenticated;

grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.has_family_access(uuid) to authenticated;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.can_access_member(uuid) to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own non-admin fields" on public.profiles;
drop policy if exists "App admins can read all profiles" on public.profiles;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_app_admin());

create policy "Users can update their own non-admin fields"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.family_members enable row level security;
alter table public.member_access_grants enable row level security;
alter table public.fixed_deposits enable row level security;
alter table public.fd_renewals enable row level security;
alter table public.fd_closures enable row level security;
alter table public.fd_receipts enable row level security;
alter table public.ocr_runs enable row level security;
alter table public.ocr_field_reviews enable row level security;

create policy "families_select"
  on public.families for select to authenticated
  using (public.has_family_access(id));

create policy "families_insert"
  on public.families for insert to authenticated
  with check (public.is_app_admin() or created_by = auth.uid());

create policy "families_update"
  on public.families for update to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

create policy "families_delete"
  on public.families for delete to authenticated
  using (public.is_app_admin());

create policy "memberships_select"
  on public.family_memberships for select to authenticated
  using (public.has_family_access(family_id));

create policy "memberships_write"
  on public.family_memberships for all to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

create policy "members_select"
  on public.family_members for select to authenticated
  using (public.can_access_member(id));

create policy "members_write"
  on public.family_members for all to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

create policy "grants_select"
  on public.member_access_grants for select to authenticated
  using (public.has_family_access(family_id));

create policy "grants_write"
  on public.member_access_grants for all to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

create policy "fds_select"
  on public.fixed_deposits for select to authenticated
  using (
    public.has_family_access(family_id)
    and public.can_access_member(family_member_id)
  );

create policy "fds_insert"
  on public.fixed_deposits for insert to authenticated
  with check (
    public.has_family_access(family_id)
    and public.can_access_member(family_member_id)
  );

create policy "fds_update"
  on public.fixed_deposits for update to authenticated
  using (
    public.has_family_access(family_id)
    and public.can_access_member(family_member_id)
  )
  with check (
    public.has_family_access(family_id)
    and public.can_access_member(family_member_id)
  );

create policy "fds_delete"
  on public.fixed_deposits for delete to authenticated
  using (public.is_family_admin(family_id));

create policy "renewals_select"
  on public.fd_renewals for select to authenticated
  using (public.has_family_access(family_id));

create policy "renewals_write"
  on public.fd_renewals for all to authenticated
  using (public.has_family_access(family_id))
  with check (public.has_family_access(family_id));

create policy "closures_select"
  on public.fd_closures for select to authenticated
  using (public.has_family_access(family_id));

create policy "closures_write"
  on public.fd_closures for all to authenticated
  using (public.has_family_access(family_id))
  with check (public.has_family_access(family_id));

create policy "receipts_select"
  on public.fd_receipts for select to authenticated
  using (public.has_family_access(family_id));

create policy "receipts_write"
  on public.fd_receipts for all to authenticated
  using (public.has_family_access(family_id))
  with check (public.has_family_access(family_id));

create policy "ocr_select"
  on public.ocr_runs for select to authenticated
  using (public.has_family_access(family_id));

create policy "ocr_write"
  on public.ocr_runs for all to authenticated
  using (public.has_family_access(family_id))
  with check (public.has_family_access(family_id));

create policy "ocr_reviews_select"
  on public.ocr_field_reviews for select to authenticated
  using (
    exists (
      select 1 from public.fixed_deposits fd
      where fd.id = ocr_field_reviews.fd_id
        and public.has_family_access(fd.family_id)
    )
  );

create policy "ocr_reviews_write"
  on public.ocr_field_reviews for all to authenticated
  using (
    exists (
      select 1 from public.fixed_deposits fd
      where fd.id = ocr_field_reviews.fd_id
        and public.has_family_access(fd.family_id)
    )
  )
  with check (
    exists (
      select 1 from public.fixed_deposits fd
      where fd.id = ocr_field_reviews.fd_id
        and public.has_family_access(fd.family_id)
    )
  );
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
create or replace view public.fd_dashboard_rows
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

grant select on public.fd_dashboard_rows to authenticated;
-- Lets a signed-in user start a household (membership insert would otherwise fail RLS).

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if length(trim(p_name)) = 0 then
    raise exception 'Family name is required';
  end if;

  insert into public.families (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into new_id;

  insert into public.family_memberships (family_id, user_id, role)
  values (new_id, auth.uid(), 'family_admin');

  return new_id;
end;
$$;

grant execute on function public.create_family(text) to authenticated;

-- Account approval + super admin (0007_account_approval.sql)

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

-- 0009_delete_family.sql
drop policy if exists "families_delete" on public.families;

create policy "families_delete"
  on public.families for delete to authenticated
  using (public.is_app_admin() or public.is_family_admin(id));
