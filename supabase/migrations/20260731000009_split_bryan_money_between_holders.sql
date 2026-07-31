-- Dana Bryan yang totalnya Rp4.000.000 dibagi berdasarkan pemegangnya:
-- Rp3.800.000 dipegang Maddy dan Rp200.000 dipegang Bryan.
-- Keduanya tetap milik pribadi Bryan, sehingga total uang tidak berubah.

update public.accounts as account
set
  holder_id = maddy.id,
  owner_person_id = bryan.id,
  is_shared = false
from public.people as maddy
cross join public.people as bryan
where account.name = 'Uang Bryan'
  and maddy.name = 'Maddy'
  and bryan.name = 'Bryan';

insert into public.accounts (
  name,
  account_type,
  holder_id,
  owner_person_id,
  is_shared,
  is_active
)
select
  'Uang Bryan (dipegang Bryan)',
  'cash',
  bryan.id,
  bryan.id,
  false,
  true
from public.people as bryan
where bryan.name = 'Bryan'
on conflict (name) do update
set
  account_type = excluded.account_type,
  holder_id = excluded.holder_id,
  owner_person_id = excluded.owner_person_id,
  is_shared = excluded.is_shared,
  is_active = true;

insert into public.ledger_entries (
  entry_date,
  entry_type,
  category,
  amount,
  from_account_id,
  to_account_id,
  note
)
select
  current_date,
  'transfer',
  'transfer',
  200000,
  held_by_maddy.id,
  held_by_bryan.id,
  'Pembagian dana Bryan: Rp200.000 dipegang Bryan, Rp3.800.000 dipegang Maddy.'
from public.accounts as held_by_maddy
cross join public.accounts as held_by_bryan
where held_by_maddy.name = 'Uang Bryan'
  and held_by_bryan.name = 'Uang Bryan (dipegang Bryan)'
  and not exists (
    select 1
    from public.ledger_entries as entry
    where entry.note = 'Pembagian dana Bryan: Rp200.000 dipegang Bryan, Rp3.800.000 dipegang Maddy.'
  )
  and (
    select coalesce(sum(
      case
        when entry.to_account_id = held_by_maddy.id then entry.amount
        when entry.from_account_id = held_by_maddy.id then -entry.amount
        else 0
      end
    ), 0)
    from public.ledger_entries as entry
    where entry.from_account_id = held_by_maddy.id
       or entry.to_account_id = held_by_maddy.id
  ) >= 200000;
