# MB Finance

Mobile-first PWA sederhana untuk keuangan Bryan dan Maddy. UI terhubung langsung ke schema Supabase di `supabase/migrations`.

## Menjalankan

1. Jalankan migration SQL pada Supabase.
2. `config.js` sudah berisi Project URL dan publishable key Supabase. Jika menggunakan project lain, salin `config.example.js` sebagai `config.js` lalu ganti nilainya dari Supabase Dashboard → Project Settings → API.
3. Buat akun Auth untuk Bryan dan Maddy, lalu petakan email mereka dengan query yang sudah ada di bagian bawah migration SQL.
4. Sajikan folder ini memakai static host (misalnya Netlify, Vercel, GitHub Pages, atau VS Code Live Server). Jangan membuka `index.html` langsung dari file explorer karena PWA dan Supabase lebih andal lewat HTTP(S).

`config.js` hanya boleh berisi publishable/anon key yang memang aman digunakan di browser. Jangan pernah memasukkan `service_role` atau `sb_secret` key ke file ini.

## Cara pakai

- **Pemasukan**: pilih rekening tujuan dan catat nominalnya.
- **Pengeluaran**: pilih rekening asal, siapa yang memakai, dan kategori harian/pribadi/Shopee/aplikasi.
- **Ke Bryan**: memindahkan alokasi dana ke rekening Uang Bryan. Rekening ini dapat tetap dipegang Maddy bila uangnya masih berada padanya; perpindahan ini tidak mengurangi total uang kalian.
- **Tagihan**: tambah tagihan berulang sekali, lalu tekan buat daftar tagihan di awal bulan dan bayar dari daftar tersebut.
- **Tabungan**: buat target, lalu setor dari rekening ke Tabungan Bersama.

Di ponsel, buka situsnya melalui Chrome atau Safari lalu pilih **Add to Home Screen** untuk menjadikannya aplikasi layar penuh.
