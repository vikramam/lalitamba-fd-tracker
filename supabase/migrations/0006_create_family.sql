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
