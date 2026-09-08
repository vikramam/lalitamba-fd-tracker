-- Optional seed. Create these Auth users first in the Supabase dashboard,
-- then run this file. Replace emails if you used different ones.
--
--   admin@family.test     → app admin (sees every family)
--   vikram@family.test    → Mulgund family admin
--   other@family.test     → a second family (must not see Mulgund FDs)

do $$
declare
  admin_id uuid;
  vikram_id uuid;
  other_id uuid;
  mulgund_id uuid := '11111111-1111-4111-8111-111111111111';
  other_fam_id uuid := '22222222-2222-4222-8222-222222222222';
  vikram_member_id uuid := '11111111-1111-4111-8111-111111111201';
  other_member_id uuid := '22222222-2222-4222-8222-222222222201';
begin
  select id into admin_id from public.profiles where email = 'admin@family.test';
  select id into vikram_id from public.profiles where email = 'vikram@family.test';
  select id into other_id from public.profiles where email = 'other@family.test';

  if admin_id is not null then
    update public.profiles
    set is_app_admin = true, is_super_admin = true, approval_status = 'approved'
    where id = admin_id;
  end if;
  update public.profiles
  set approval_status = 'approved'
  where email in ('vikram@family.test', 'other@family.test');

  insert into public.families (id, name, created_by)
  values (mulgund_id, 'Mulgund family', vikram_id)
  on conflict (id) do update set name = excluded.name;

  insert into public.families (id, name, created_by)
  values (other_fam_id, 'Other family', other_id)
  on conflict (id) do update set name = excluded.name;

  if vikram_id is not null then
    insert into public.family_memberships (family_id, user_id, role)
    values (mulgund_id, vikram_id, 'family_admin')
    on conflict (family_id, user_id) do update set role = excluded.role;
  end if;

  if other_id is not null then
    insert into public.family_memberships (family_id, user_id, role)
    values (other_fam_id, other_id, 'family_admin')
    on conflict (family_id, user_id) do update set role = excluded.role;
  end if;

  insert into public.family_members (id, family_id, full_name, bank_customer_id, linked_user_id)
  values (vikram_member_id, mulgund_id, 'Vikram A Mulgund', '1700', vikram_id)
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.family_members (id, family_id, full_name, bank_customer_id)
  values (other_member_id, other_fam_id, 'Other Holder', '9999')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.fixed_deposits (
    id, family_id, family_member_id, fd_account_no, bank_customer_id,
    holder_name, holder_address, principal_amount, principal_amount_words,
    interest_rate_pct, tenure_years, tenure_label, interest_mode,
    monthly_interest_amount, interest_credit_account, maturity_value,
    fd_date, transaction_date, maturity_date, nominee_name, nominee_relationship, status
  ) values
    (
      '11111111-1111-4111-8111-111111111301',
      mulgund_id, vikram_member_id, '01FD40599', '1700',
      'VIKRAM A MULGUND', 'Mulgund Complex Station Road Gadag',
      150000, 'One Lakh Fifty Thousands Rupees Only',
      11, 3, '3 Years', 'monthly',
      1375, '01003MS001396', 150000,
      '2025-05-26', '2025-05-26', '2028-05-25',
      'AMRUTMATI VIKRAM MULGUND', 'wife', 'active'
    ),
    (
      '11111111-1111-4111-8111-111111111302',
      mulgund_id, vikram_member_id, '01FD32450', '1700',
      'VIKRAM A MULGUND', 'Mulgund Complex Station Road Gadag',
      450000, 'Four Lakh Fifty Thousands Rupees Only',
      11, 5, '5 Years', 'on_maturity',
      null, null, 697500,
      '2023-10-25', '2023-10-25', '2028-10-23',
      'SHAKUNTALA A MULGUND', 'Mother', 'active'
    ),
    (
      '22222222-2222-4222-8222-222222222301',
      other_fam_id, other_member_id, '01FD00001', '9999',
      'OTHER HOLDER', null,
      100000, 'One Lakh Rupees Only',
      10, 1, '1 Year', 'monthly',
      833.33, null, 100000,
      '2026-01-01', '2026-01-01', '2027-01-01',
      null, null, 'active'
    )
  on conflict (id) do nothing;
end $$;
