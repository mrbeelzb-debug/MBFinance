-- Koreksi pencatatan kepemilikan dan pemegang dana.
-- Saldo pada rekening "Uang Bryan" tetap sama, tetapi dana tersebut milik Bryan
-- dan saat ini secara fisik dipegang oleh Maddy.
--
-- Tidak ada ledger entry baru karena ini bukan pemasukan, pengeluaran, atau
-- perpindahan uang; hanya pembetulan metadata rekening.
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
