-- Ringkasan untuk dashboard beranda. Setiap baris mewakili satu hari.

create or replace view public.v_daily_cashflow
with (security_invoker = true) as
select
  entry_date as day,
  coalesce(sum(amount) filter (where entry_type = 'income'), 0) as money_in,
  coalesce(sum(amount) filter (where entry_type in ('expense', 'bill')), 0) as total_usage,
  coalesce(sum(amount) filter (where category = 'daily' and entry_type in ('expense', 'bill')), 0) as daily_usage,
  coalesce(sum(amount) filter (where category = 'personal' and entry_type in ('expense', 'bill')), 0) as personal_usage,
  coalesce(sum(amount) filter (where category = 'shopee' and entry_type in ('expense', 'bill')), 0) as shopee_usage,
  coalesce(sum(amount) filter (where category = 'application' and entry_type in ('expense', 'bill')), 0) as application_usage,
  coalesce(sum(amount) filter (where entry_type = 'bill'), 0) as bills_paid,
  coalesce(sum(amount) filter (where entry_type = 'saving'), 0) as saving_added,
  coalesce(sum(amount) filter (where entry_type = 'income' and category = 'salary'), 0) as salary_income,
  coalesce(sum(amount) filter (where entry_type = 'saving_withdrawal'), 0) as saving_withdrawn
from public.ledger_entries
group by entry_date;

grant select on public.v_daily_cashflow to authenticated;
