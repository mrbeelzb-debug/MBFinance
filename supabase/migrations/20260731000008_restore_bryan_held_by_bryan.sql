-- Mengembalikan pencatatan awal: Uang Bryan dipegang oleh Bryan sendiri.
-- Saldo tidak berubah; hanya metadata pemegang dan status kepemilikan rekening
-- yang dikembalikan ke kondisi awal.
update public.accounts as account
set
  holder_id = bryan.id,
  owner_person_id = null,
  is_shared = true
from public.people as bryan
where account.name = 'Uang Bryan'
  and bryan.name = 'Bryan';
