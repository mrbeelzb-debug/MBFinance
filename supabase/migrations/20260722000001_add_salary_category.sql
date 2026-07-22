-- Jalankan migration ini setelah 20260722000000_couple_finance.sql.
-- Pemasukan utama sekarang diberi kategori "salary" agar mudah dibedakan dari pembagian uang.

alter table public.ledger_entries
  drop constraint ledger_entries_category_check;

alter table public.ledger_entries
  add constraint ledger_entries_category_check
  check (category in ('salary', 'daily', 'personal', 'shopee', 'application', 'savings', 'transfer', 'other'));

-- Menambahkan total gaji ke ringkasan tanpa mengubah kolom laporan yang sudah dipakai sebelumnya.
create or replace view public.v_monthly_cashflow
with (security_invoker = true) as
select
  date_trunc('month', entry_date)::date as month,
  coalesce(sum(amount) filter (where entry_type = 'income'), 0) as money_in,
  coalesce(sum(amount) filter (where entry_type in ('expense', 'bill')), 0) as total_usage,
  coalesce(sum(amount) filter (where category = 'daily' and entry_type in ('expense', 'bill')), 0) as daily_usage,
  coalesce(sum(amount) filter (where category = 'personal' and entry_type in ('expense', 'bill')), 0) as personal_usage,
  coalesce(sum(amount) filter (where category = 'shopee' and entry_type in ('expense', 'bill')), 0) as shopee_usage,
  coalesce(sum(amount) filter (where category = 'application' and entry_type in ('expense', 'bill')), 0) as application_usage,
  coalesce(sum(amount) filter (where entry_type = 'bill'), 0) as bills_paid,
  coalesce(sum(amount) filter (where entry_type = 'saving'), 0) as saving_added,
  coalesce(sum(amount) filter (where entry_type = 'income' and category = 'salary'), 0) as salary_income
from public.ledger_entries
group by 1;

grant select on public.v_monthly_cashflow to authenticated;
