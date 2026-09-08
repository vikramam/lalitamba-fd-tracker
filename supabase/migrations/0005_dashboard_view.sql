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
