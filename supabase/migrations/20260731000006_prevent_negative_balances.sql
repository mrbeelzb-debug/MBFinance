-- Saldo rekening tidak boleh menjadi negatif.
-- Pengaman ini berlaku juga bila data dikirim langsung ke Supabase, bukan hanya lewat UI.

create or replace function public.ensure_sufficient_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available_balance bigint;
  account_name text;
  existing_entry_id bigint;
begin
  -- Pemasukan tidak mempunyai rekening asal, sehingga tidak perlu diperiksa.
  if new.from_account_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    existing_entry_id := old.id;
  end if;

  -- Mengunci rekening asal agar dua transaksi bersamaan tidak dapat memakai saldo yang sama.
  select name
  into account_name
  from public.accounts
  where id = new.from_account_id
  for update;

  if account_name is null then
    raise exception 'Rekening asal tidak ditemukan.';
  end if;

  -- Saat mengubah transaksi, abaikan nilai transaksi versi lama.
  select coalesce(sum(
    case
      when l.to_account_id = new.from_account_id then l.amount
      when l.from_account_id = new.from_account_id then -l.amount
      else 0
    end
  ), 0)
  into available_balance
  from public.ledger_entries l
  where (l.from_account_id = new.from_account_id or l.to_account_id = new.from_account_id)
    and (existing_entry_id is null or l.id <> existing_entry_id);

  if available_balance < new.amount then
    raise exception 'Saldo % tidak cukup. Tersedia %, sedangkan transaksi sebesar % tidak dapat disimpan.',
      account_name,
      available_balance,
      new.amount
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_negative_account_balance on public.ledger_entries;

create trigger prevent_negative_account_balance
before insert or update of amount, from_account_id, to_account_id on public.ledger_entries
for each row
execute function public.ensure_sufficient_account_balance();
