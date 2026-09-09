-- Family admins can delete a family they manage (app admins already could).
-- The app still refuses delete when people or FDs remain.

drop policy if exists "families_delete" on public.families;

create policy "families_delete"
  on public.families for delete to authenticated
  using (public.is_app_admin() or public.is_family_admin(id));
