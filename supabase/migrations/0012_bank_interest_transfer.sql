-- Optional transfer of monthly/quarterly FD interest from the member passbook to a bank account.
-- Do not name the new enum value in this same script: Postgres requires it to be committed first.

alter table public.family_members
  add column if not exists interest_credit_bank_account text,
  add column if not exists bank_name text;

alter table public.fixed_deposits
  add column if not exists credit_interest_to_bank boolean not null default false,
  add column if not exists credit_interest_to_bank_enabled_at timestamptz;

alter type public.passbook_source add value if not exists 'fd_interest_bank';

alter table public.passbook_transactions
  drop constraint if exists passbook_transactions_check;

alter table public.passbook_transactions
  drop constraint if exists passbook_transactions_source_check;

alter table public.passbook_transactions
  add constraint passbook_transactions_source_check check (
    (
      source_type <> 'manual'
      and interest_period_date is not null
      and source_fd_id is not null
    )
    or (
      source_type = 'manual'
      and interest_period_date is null
      and source_fd_id is null
    )
  );

create unique index if not exists idx_passbook_interest_bank_unique
  on public.passbook_transactions (source_fd_id, interest_period_date)
  where source_type <> 'manual'
    and source_type <> 'fd_interest'
    and source_fd_id is not null;
