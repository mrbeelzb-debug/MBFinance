-- Dashboard menampilkan lokasi dana, bukan konsep dana pribadi:
-- jumlah dana Maddy + jumlah dana Bryan = total uang kalian.

create or replace view public.v_shared_overview
with (security_invoker = true) as
select
  coalesce(sum(balance), 0) as total_combined_money,
  coalesce(sum(balance) filter (where is_shared), 0) as total_shared_money,
  coalesce(sum(balance) filter (where not is_shared and owner_name = 'Bryan'), 0) as bryan_personal_money,
  coalesce(sum(balance) filter (where not is_shared and owner_name = 'Maddy'), 0) as maddy_personal_money,
  coalesce(sum(balance) filter (where holder_is_custodian), 0) as total_held_by_maddy,
  coalesce(sum(balance) filter (where not coalesce(holder_is_custodian, false)), 0) as total_held_by_others,
  coalesce(sum(balance) filter (where is_shared and holder_is_custodian), 0) as shared_money_held_by_maddy,
  coalesce(sum(balance) filter (where is_shared and not coalesce(holder_is_custodian, false)), 0) as shared_money_held_by_others,
  coalesce(sum(balance) filter (where account_type = 'savings'), 0) as total_savings,
  coalesce(sum(balance) filter (where holder_name = 'Bryan'), 0) as total_held_by_bryan
from public.v_account_balances;

-- Schema awal sempat membuat dua rekening "Dana Pribadi". Sembunyikan jika masih kosong;
-- rekening tersebut tidak dihapus agar catatan lama yang mungkin sudah ada tetap aman.
update public.accounts a
set is_active = false
where a.name in ('Dana Pribadi Bryan', 'Dana Pribadi Maddy')
  and not exists (
    select 1 from public.ledger_entries l
    where l.from_account_id = a.id or l.to_account_id = a.id
  );

grant select on public.v_shared_overview to authenticated;
