-- Passbook: one book per member, ledger transactions, no historical backfill on create.

alter table public.family_members
  add column if not exists account_number text;

create index if not exists idx_members_account
  on public.family_members (family_id, account_number);

create type public.passbook_txn_type as enum ('credit', 'debit');
create type public.passbook_source as enum ('manual', 'fd_interest');

create table public.member_passbooks (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  family_member_id   uuid not null unique references public.family_members (id) on delete cascade,
  created_on         date not null default (timezone('utc', now()))::date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.passbook_transactions (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid not null references public.families (id) on delete cascade,
  passbook_id           uuid not null references public.member_passbooks (id) on delete cascade,
  public_id             text not null,
  txn_date              date not null,
  txn_type              public.passbook_txn_type not null,
  amount                numeric(14,2) not null check (amount > 0),
  balance_after         numeric(14,2) not null,
  reference             text,
  remarks               text,
  source_type           public.passbook_source not null default 'manual',
  source_fd_id          uuid references public.fixed_deposits (id) on delete set null,
  interest_period_date  date,
  created_by            uuid references public.profiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (public_id),
  check (
    (source_type = 'fd_interest' and interest_period_date is not null)
    or (source_type = 'manual' and interest_period_date is null and source_fd_id is null)
  )
);

create unique index idx_passbook_interest_unique
  on public.passbook_transactions (source_fd_id, interest_period_date)
  where source_type = 'fd_interest' and source_fd_id is not null;

create index idx_passbooks_family on public.member_passbooks (family_id);
create index idx_passbook_tx_passbook on public.passbook_transactions (passbook_id, txn_date, created_at);
create index idx_passbook_tx_family on public.passbook_transactions (family_id);
create index idx_passbook_tx_public on public.passbook_transactions (public_id);

create trigger member_passbooks_updated_at
  before update on public.member_passbooks
  for each row execute function public.set_updated_at();

create trigger passbook_transactions_updated_at
  before update on public.passbook_transactions
  for each row execute function public.set_updated_at();

create or replace function public.enforce_passbook_family_match()
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
    raise exception 'member_passbooks.family_id must match family_members.family_id';
  end if;
  return new;
end;
$$;

create trigger member_passbooks_family_match
  before insert or update on public.member_passbooks
  for each row execute function public.enforce_passbook_family_match();

create or replace function public.enforce_passbook_tx_family()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.member_passbooks pb
    where pb.id = new.passbook_id
      and pb.family_id = new.family_id
  ) then
    raise exception 'passbook_transactions.family_id must match the passbook';
  end if;
  return new;
end;
$$;

create trigger passbook_transactions_family_match
  before insert or update on public.passbook_transactions
  for each row execute function public.enforce_passbook_tx_family();

create or replace function public.create_member_passbook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_passbooks (family_id, family_member_id, created_on)
  values (new.family_id, new.id, (timezone('utc', now()))::date)
  on conflict (family_member_id) do nothing;
  return new;
end;
$$;

create trigger family_members_create_passbook
  after insert on public.family_members
  for each row execute function public.create_member_passbook();

grant select, insert, update, delete on public.member_passbooks to authenticated;
grant select, insert, update, delete on public.passbook_transactions to authenticated;

alter table public.member_passbooks enable row level security;
alter table public.passbook_transactions enable row level security;

create policy "passbooks_select"
  on public.member_passbooks for select to authenticated
  using (public.can_access_member(family_member_id));

create policy "passbooks_insert"
  on public.member_passbooks for insert to authenticated
  with check (public.has_family_access(family_id) or public.is_app_admin());

create policy "passbooks_update"
  on public.member_passbooks for update to authenticated
  using (public.is_family_admin(family_id) or public.is_app_admin())
  with check (public.is_family_admin(family_id) or public.is_app_admin());

create policy "passbooks_delete"
  on public.member_passbooks for delete to authenticated
  using (public.is_family_admin(family_id) or public.is_app_admin());

create policy "passbook_tx_select"
  on public.passbook_transactions for select to authenticated
  using (
    public.has_family_access(family_id)
    and exists (
      select 1 from public.member_passbooks pb
      where pb.id = passbook_id
        and public.can_access_member(pb.family_member_id)
    )
  );

create policy "passbook_tx_insert"
  on public.passbook_transactions for insert to authenticated
  with check (
    public.has_family_access(family_id)
    and exists (
      select 1 from public.member_passbooks pb
      where pb.id = passbook_id
        and pb.family_id = family_id
        and public.can_access_member(pb.family_member_id)
    )
  );

create policy "passbook_tx_update"
  on public.passbook_transactions for update to authenticated
  using (public.has_family_access(family_id))
  with check (public.has_family_access(family_id));

create policy "passbook_tx_delete"
  on public.passbook_transactions for delete to authenticated
  using (public.is_family_admin(family_id) or public.is_app_admin());
