-- MBFinance no-login mode.
-- WARNING: setelah migration ini dijalankan, siapa pun yang punya URL app dapat
-- membaca dan mengubah data keuangan melalui publishable Supabase key.

grant usage on schema public to anon;

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

grant select on public.people, public.accounts to anon;

grant select, insert, update, delete on
  public.ledger_entries,
  public.recurring_bills,
  public.bill_instances,
  public.savings_goals,
  public.savings_contributions,
  public.savings_withdrawals
to anon;

grant usage, select on sequence
  public.ledger_entries_id_seq,
  public.recurring_bills_id_seq,
  public.bill_instances_id_seq,
  public.savings_goals_id_seq,
  public.savings_contributions_id_seq,
  public.savings_withdrawals_id_seq
to anon;

grant select on
  public.v_account_balances,
  public.v_shared_overview,
  public.v_person_monthly_usage,
  public.v_monthly_cashflow,
  public.v_monthly_bill_summary,
  public.v_savings_goal_progress,
  public.v_daily_cashflow
to anon;

grant execute on function public.create_bill_instances(date) to anon;

drop policy if exists "Anon can read people" on public.people;
create policy "Anon can read people"
  on public.people for select to anon
  using (true);

drop policy if exists "Anon can read accounts" on public.accounts;
create policy "Anon can read accounts"
  on public.accounts for select to anon
  using (true);

drop policy if exists "Anon can manage ledger" on public.ledger_entries;
create policy "Anon can manage ledger"
  on public.ledger_entries for all to anon
  using (true) with check (true);

drop policy if exists "Anon can manage recurring bills" on public.recurring_bills;
create policy "Anon can manage recurring bills"
  on public.recurring_bills for all to anon
  using (true) with check (true);

drop policy if exists "Anon can manage bill instances" on public.bill_instances;
create policy "Anon can manage bill instances"
  on public.bill_instances for all to anon
  using (true) with check (true);

drop policy if exists "Anon can manage savings goals" on public.savings_goals;
create policy "Anon can manage savings goals"
  on public.savings_goals for all to anon
  using (true) with check (true);

drop policy if exists "Anon can manage savings contributions" on public.savings_contributions;
create policy "Anon can manage savings contributions"
  on public.savings_contributions for all to anon
  using (true) with check (true);

drop policy if exists "Anon can manage savings withdrawals" on public.savings_withdrawals;
create policy "Anon can manage savings withdrawals"
  on public.savings_withdrawals for all to anon
  using (true) with check (true);
