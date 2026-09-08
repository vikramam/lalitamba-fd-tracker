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
  on public.fixed_deposits (family_id, fd_account_no)
  where fd_account_no is not null;
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
