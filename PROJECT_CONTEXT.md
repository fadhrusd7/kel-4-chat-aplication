# PROJECT CONTEXT — APLIKASI CHAT TERDISTRIBUSI

Kelompok 4 — Sistem Terdistribusi

Dokumen handover ini merangkum kondisi repository dan percakapan pengembangan sampai 24 November 2026. Periksa repository sebelum mengubah kode karena anggota kelompok dapat melakukan commit baru.

## 1. Informasi proyek

- Nama: Aplikasi Chat Kelompok 4
- Mata kuliah: Sistem Terdistribusi
- Repository: https://github.com/fadhrusd7/kel-4-chat-aplication
- Folder proyek Windows: `kel-4-chat-aplication`
- Framework: Next.js 16.4.6 (App Router, Turbopack)
- Bahasa: TypeScript
- Database lokal saat ini: MariaDB/MySQL Laragon
- Driver: `mysql2`
- Password hashing: `bcryptjs`
- Pengumpulan: presentasi/demo; tenggat di PDF tugas 30 November 2026

## 2. Dokumen acuan dan batasannya

- `Tugas 16 November 2026.pdf` adalah instruksi tugas utama. Sistem akhirnya memakai arsitektur client-server, server aplikasi per pengguna/perangkat, satu database cloud bersama, komunikasi HTTP, backup ke PC/desktop (bukan Google Drive), waktu database cloud sebagai acuan, login, dan perlindungan data pribadi.
- `PRD.md` adalah spesifikasi frontend web chat. Dokumen ini membantu implementasi UI dan mock awal, tetapi cakupannya lebih sempit daripada PDF tugas dan tidak menggantikan persyaratan sistem terdistribusi.
- `DESIGN.md` berisi panduan visual UI.

## 3. Target arsitektur

Untuk demo satu jaringan Wi-Fi/LAN:

1. Setiap anggota menjalankan server Next.js sendiri di laptopnya.
2. Browser pengguna membuka server yang berjalan di perangkatnya.
3. Semua server Next.js memakai satu database MySQL-compatible di cloud.
4. Server aplikasi berkomunikasi dengan database melalui koneksi MySQL protocol/TLS ke provider.
5. Satu PC Windows anggota menjadi tujuan backup. PC itu mengambil/export data database cloud dan menyimpan file ke disk lokalnya.
6. Tombol backup meminta backup melalui API server, lalu layanan backup pada PC tujuan membuat file nyata.

Hasil yang sudah dicoba sejauh ini adalah dua akun berkomunikasi melalui dua browser, tetapi pada satu server Next.js dan database lokal yang sama. Ini belum membuktikan arsitektur final multi-server/cloud.

## 4. Kondisi repository terakhir

- Branch aktif: `jeje`, tracking `origin/jeje`.
- Remote: `origin` → `https://github.com/fadhrusd7/kel-4-chat-aplication`.
- Pada pemeriksaan terakhir, working tree bersih.
- `main` lokal tertinggal 4 commit dari `origin/main`; jangan merge/rebase tanpa memeriksa kebutuhan branch.
- Dependency penting sudah ada di `package.json`: `mysql2` dan `bcryptjs`.
- `.env.local` ada di folder proyek dan tidak boleh di-commit atau dibagikan. Nilai rahasia tidak dicantumkan di dokumen ini.
- Belum ada file skema/migration SQL yang dilacak repository; tabel lokal dibuat manual lewat HeidiSQL.
- Folder proyek tidak berisi `time_client.py` atau `time_server.py` pada pemeriksaan terakhir.

## 5. Implementasi yang sudah ada

### Frontend

- Halaman `/login`, `/register`, dan `/chat`.
- UI chat monokrom, pencarian pengguna, pesan, status kirim, dan polling.
- Frontend memanggil API melalui `lib/api.ts`.
- `fetch` API memakai `credentials: "include"` dan `cache: "no-store"`.

### Database dan backend API

- `lib/db.ts` membuat MySQL connection pool dari environment `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME`; default masih `localhost`/database `chat` untuk pengembangan lokal.
- Driver memakai timezone UTC dan setiap koneksi baru mengatur sesi MySQL dengan `SET time_zone = '+00:00'` untuk mencegah timestamp bergeser 7 jam saat dibaca aplikasi.
- `GET /api/health` menguji koneksi database dan mengembalikan `UTC_TIMESTAMP(3)`.
- API tersedia untuk register, login, logout, pemeriksaan sesi, daftar pengguna, dan pesan.
- Password di-hash dengan bcrypt. Token sesi acak disimpan sebagai hash SHA-256; cookie sesi `HttpOnly`, dan sesi berlaku 7 hari.
- API daftar pengguna hanya memilih `id` dan `username`; email pengguna lain tidak dikirim.
- GET `/api/messages` mendukung `afterId`, validasi parameter, dan query pesan dua arah. Ini dipakai polling frontend.
- Pesan dibatasi maksimal 5000 karakter dan pengiriman ke diri sendiri ditolak.

### Sinkronisasi waktu

- Frontend meminta waktu `UTC_TIMESTAMP(3)` lewat `/api/health`.
- `getServerTime()` mencatat waktu mulai dan waktu respons; `setSyncedServerTime()` memakai titik tengah request/response untuk memperkirakan offset server, lalu memperbarui sinkronisasi setiap 30 detik.
- Tampilan UI diformat menjadi WIB.
- Ini implementasi sinkronisasi berbasis HTTP yang menyerupai pendekatan Cristian (timestamp server + setengah RTT). Perlu diuji lagi setelah database cloud digunakan dan dijelaskan saat presentasi.
- Selisih 7 jam sebelumnya berasal dari sesi MySQL Laragon yang dibaca sebagai UTC; konfigurasi pool UTC sudah ditambahkan. Konfirmasi ulang tampilan setelah restart server.

## 6. Database lokal

- Laragon/MySQL lokal berhasil digunakan.
- Database bernama `chat` sudah dibuat.
- Tabel `users`, `sessions`, dan `messages` sudah tersedia.
- Registrasi/login dan komunikasi antar-user melalui dua browser pada server lokal sudah dicoba dan berhasil.
- Kredensial koneksi lokal hanya tersimpan di `.env.local`; jangan menyalin nilainya ke GitHub atau chat.

Untuk menjalankan lokal, buka terminal di folder yang berisi `package.json`:

```powershell
npm install
npm run dev
```

Buka `http://localhost:3000`. Cek koneksi database di `http://localhost:3000/api/health`.

## 7. Pekerjaan berikutnya

### Prioritas 1 — Buat database cloud bersama

- Pengguna yang melanjutkan (Jejelita) memilih untuk menjadi pengelola/pembuat database cloud.
- Demo direncanakan satu Wi-Fi/LAN.
- Provider belum dibuat/dipilih. Rekomendasi awal yang pernah diberikan: TiDB Cloud Starter, mode MySQL-compatible; perhatikan kuota gratis dan syarat TLS. Jangan anggap layanan sudah dibuat.
- Buat database `chat` dan tabel `users`, `sessions`, `messages` di cloud.
- Tambahkan contoh konfigurasi tanpa rahasia, misalnya `.env.example`; pertahankan `.env.local` hanya lokal.
- Ubah `lib/db.ts` agar konfigurasi cloud memakai TLS dan connection username/host persis seperti halaman Connect provider.
- Pastikan akses provider dibatasi ke IP jaringan demo yang diperlukan; jangan membuka akses semua IP.
- Semua laptop anggota nantinya memakai endpoint database cloud yang sama.

### Prioritas 2 — Uji server di tiap perangkat

- Jalankan satu Next.js server pada tiap laptop anggota.
- Buat server dapat dijangkau dalam LAN dan catat alamat LAN masing-masing.
- Pastikan firewall Windows hanya mengizinkan port aplikasi yang dibutuhkan pada jaringan privat.
- Uji akun dari server A mengirim pesan ke akun di server B, dengan kedua server mengakses database cloud yang sama.
- Jangan menganggap tes dua browser pada satu server sebagai tes multi-server.

### Prioritas 3 — Backup nyata ke PC Windows teman

- PC backup sudah ditentukan: PC teman dengan Windows.
- Folder tujuan belum dipilih. Folder berarti direktori di disk lokal PC tersebut, misalnya `D:\chat-backups` bila drive D tersedia, atau `C:\chat-backups`.
- `requestBackup()` di `lib/api.ts` saat ini sengaja melempar error “Fitur backup belum tersedia di backend.” Tombol UI belum membuat file nyata.
- Rancangan yang disarankan: server aplikasi menerima permintaan pengguna yang terautentikasi lalu memanggil layanan backup privat di PC teman; layanan PC membaca database cloud dan menyimpan file bertanggal seperti `chat_YYYYMMDD_HHmmss.sql` ke folder lokal.
- Tambahkan autentikasi antarlayanan, pembatasan akses jaringan, retensi file, status sukses/gagal yang benar, dan dokumentasi restore.
- Uji file backup dengan memulihkannya ke database uji; jangan menguji restore langsung ke database utama.
- Backup otomatis bawaan provider tidak menggantikan salinan yang harus disimpan di PC sesuai tugas.

### Prioritas 4 — Konsistensi keamanan dan waktu

- Validasi semua API yang memerlukan sesi.
- Pastikan query hanya memberi pemilik sesi akses yang benar terhadap data.
- Waktu kedaluwarsa sesi login saat ini dibuat dengan `Date.now()` aplikasi, sementara validasi sesi memakai `UTC_TIMESTAMP(3)` database; ubah pembuatan waktu kedaluwarsa agar bersumber dari database cloud.
- Setelah cloud disiapkan, verifikasi pesan, jam UI, tanggal, dan waktu backup memakai UTC konsisten lalu ditampilkan dalam WIB.

### Prioritas 5 — Dokumentasi dan presentasi

- Catat arsitektur, alamat server (tanpa rahasia), diagram alur pesan dan backup, cara menjalankan tiap server, konfigurasi environment, skenario pengujian, dan prosedur restore.
- Demo: login di dua perangkat/server, kirim pesan, tunjukkan polling, jam cloud, minta backup, tunjukkan file di PC, lalu jelaskan restore.

## 8. Catatan kerja

- Periksa file dan status Git sebelum mengubah kode; perubahan bisa dibuat anggota lain.
- Instruksi terminal untuk pengguna Windows menggunakan PowerShell.
- Jangan commit `.env.local`, password, token, private key, atau data akun nyata.
- Jangan menampilkan status backup sukses jika file backup tidak benar-benar dibuat.
- Setelah perubahan, jelaskan file yang diubah dan cara menguji manual. Jalankan pemeriksaan TypeScript/build hanya bila diminta pengguna.
