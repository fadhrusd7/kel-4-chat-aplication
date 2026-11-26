# Obrolan: Aplikasi Chat Terdistribusi (Kelompok 4)

Tugas Sistem Terdistribusi. Aplikasi chat web: tiap user menjalankan application server (Next.js) sendiri di laptopnya, semuanya memakai satu cloud database bersama, dan ada backup ke PC terpisah. Waktu pesan mengikuti jam server database, bukan jam laptop.

## Arsitektur

```
Browser  ->  Next.js di laptop (app/api/*)  ->  Cloud database (TiDB)
                      |
                      +-- Minta backup --> mysqldump --> backup-receiver di PC backup
```

| Bagian | Peran | Lokasi |
|---|---|---|
| Client dan application server | Web chat, route `/api/*`, sinkronisasi waktu | Laptop tiap user |
| Cloud database | Menyimpan `users`, `sessions`, `messages`; acuan waktu | TiDB Cloud |
| Backup storage | Menerima file hasil dump | PC backup (`backup-receiver/`) |

## Menjalankan aplikasi

Butuh Node.js (LTS).

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

Buka http://localhost:3000. Cek koneksi database di http://localhost:3000/api/health (harus `"success": true`).

Setiap kali `.env.local` diubah, jalankan ulang `npm run dev`.

### Database

- **Cloud (dipakai kelompok):** minta `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` ke pengelola database dan isi di `.env.local`.
- **Lokal (untuk mencoba):** buat database `chat` dan user `chat` di MySQL atau MariaDB, lalu jalankan skema:
  ```bash
  mariadb -u chat -p < database/schema.sql
  ```
  Isi `.env.local` dengan `DB_HOST=localhost`, `DB_PORT=3306`, dan user serta password yang dibuat.

## Backup

1. Di PC backup: `cd backup-receiver`, siapkan `.env` berisi `BACKUP_TOKEN`, `BACKUP_RECEIVER_PORT`, dan `BACKUP_STORAGE_PATH`, lalu `node server.js` (butuh `npm install` di root agar `dotenv` terpasang).
2. Di laptop user: isi `BACKUP_RECEIVER_URL` (misalnya `http://IP-PC:4000/upload`) dan `BACKUP_TOKEN` yang sama di `.env.local`.
3. Perintah `mysqldump` harus tersedia di laptop (cek dengan `which mysqldump`).
4. Tekan "Minta backup" di aplikasi. Status berhasil atau gagal tampil di sidebar.

Pemulihan (restore) dilakukan manual dari file backup: `mysql -h HOST -u USER -p chat < backup_xxx.sql`.

## Sinkronisasi waktu (algoritma Cristian)

- Waktu pesan dibuat oleh database saat pesan disimpan (`created_at`), jadi urutan chat sama untuk semua user walau jam laptop berbeda.
- Jam "Jam server" di header memakai `getSyncedNow()` di `lib/time.ts`. Aplikasi memanggil `/api/health` tiap 30 detik, mencatat waktu database dan lama pulang-pergi, lalu menghitung offset: `waktu server ≈ Ts + RTT/2`.
- Penyimpanan dalam UTC, tampilan dalam WIB.

Demo: matikan sinkronisasi otomatis jam laptop, majukan jam beberapa menit, muat ulang halaman. Jam server di header tetap benar, dan jam pesan sama di semua laptop.

## Struktur

```
app/            halaman (login, register, chat) dan route API
components/     AuthForm, ChatApp
hooks/          useAuth
lib/            api.ts (fetch ke /api/*), db.ts, time.ts (waktu dan Cristian)
database/       schema.sql
backup-receiver/ penerima file backup untuk PC backup
```

Panduan tampilan ada di `DESIGN.md`, kebutuhan produk di `PRD.md`.