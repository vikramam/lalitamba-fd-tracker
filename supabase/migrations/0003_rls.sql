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
