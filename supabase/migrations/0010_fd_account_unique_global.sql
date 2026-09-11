drop index if exists public.idx_fds_account_unique;

create unique index idx_fds_account_unique
  on public.fixed_deposits (lower(btrim(fd_account_no)))
  where fd_account_no is not null and btrim(fd_account_no) <> '';
