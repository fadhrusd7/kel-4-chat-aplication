# PRD Frontend: Web Chat (Next.js)
 
Cakupan: **hanya frontend**. Backend (API, database, sesi login) dikerjakan terpisah. Frontend ini harus bisa dijalankan dan didemokan lebih dulu memakai **data tiruan (mock)**, lalu disambungkan ke backend tanpa mengubah tampilan.
 
---
 
## 1. Tujuan
 
1. Membuat antarmuka chat web yang lengkap: daftar, login, dan layar chat.
2. Semua pemanggilan data lewat **satu lapisan API** (`lib/api`) sehingga mudah diganti dari mock ke backend asli.
3. Siap menampilkan waktu pesan dari server dan memakai fungsi waktu tersinkronisasi (`getSyncedNow()`).
4. Tampilan rapi di laptop dan layak dipakai di layar ponsel.
## 2. Di luar cakupan
 
- Pembuatan API, database, dan autentikasi sungguhan.
- Algoritma sinkronisasi waktu (hanya menyediakan titik sambung).
- Layanan backup (hanya tombol dan tampilan statusnya).
- Fitur lanjutan: kirim gambar atau file, grup chat, notifikasi push, enkripsi.
## 3. Stack frontend
 
| Hal | Pilihan |
|---|---|
| Framework | Next.js (App Router) |
| Bahasa | TypeScript (JavaScript juga bisa, sesuaikan proyekmu) |
| Styling | Tailwind CSS (disarankan) atau CSS Modules |
| State | React state dan hook sendiri (tanpa library tambahan di tahap awal) |
| Update pesan | Polling tiap 2 sampai 3 detik lewat custom hook |
| Data | Mock di `lib/api`, lalu diganti `fetch` ke backend |
 
## 4. Halaman dan alur
 
### 4.1 `/login`
 
- Form: username/email dan password.
- Tombol "Masuk" dan tautan ke `/register`.
- State: awal, sedang memuat (tombol nonaktif dan indikator), error (pesan di bawah form, misalnya "Username atau password salah").
- Validasi sisi client: kolom wajib diisi.
- Berhasil login: arahkan ke `/chat`.
### 4.2 `/register`
 
- Form: username, email, password, konfirmasi password.
- Validasi: format email, panjang password minimal 8 karakter, konfirmasi harus sama.
- Berhasil daftar: arahkan ke `/login` (atau langsung login).
- Pesan error dari server ditampilkan, misalnya "Username sudah dipakai".
### 4.3 `/chat` (halaman utama)
 
Layout dua kolom pada layar lebar:
 
```
+---------------------+-----------------------------------------+
|  Header: nama saya  |  Header lawan bicara                    |
|  [Backup] [Keluar]  |-----------------------------------------|
|---------------------|                                         |
|  Cari user          |   (daftar pesan, bisa di-scroll)        |
|  - User A           |                                         |
|  - User B           |                                         |
|  - User C           |-----------------------------------------|
|                     |  [ ketik pesan...            ] [Kirim]  |
+---------------------+-----------------------------------------+
```
 
- Kolom kiri: daftar user lain, kolom pencarian, penanda user yang sedang dibuka.
- Kolom kanan: percakapan dengan user terpilih.
- Pada layar kecil: tampil satu kolom, daftar user dan percakapan bergantian (ada tombol kembali).
- Jika belum ada user dipilih: tampilan kosong dengan teks arahan ("Pilih user untuk mulai chat").
### 4.4 Proteksi halaman
 
- Jika belum login, `/chat` mengarahkan ke `/login`.
- Jika sudah login, membuka `/login` atau `/register` mengarahkan ke `/chat`.
- Pada tahap mock, status login disimpan sementara (misalnya `localStorage`) dan diganti cookie sesi saat backend siap.
## 5. Kebutuhan fungsional
 
### Autentikasi (P0)
- FE-1: Form login dan register dengan validasi dan pesan error yang jelas.
- FE-2: Tombol "Keluar" mengakhiri sesi dan kembali ke `/login`.
- FE-3: Pengalihan halaman sesuai status login (bagian 4.4).
### Daftar user (P0)
- FE-4: Menampilkan semua user lain (tidak menampilkan diri sendiri).
- FE-5: Pencarian user berdasarkan username (filter di sisi client).
- FE-6: Klik user membuka percakapan.
### Percakapan (P0)
- FE-7: Menampilkan pesan berurutan, pesan sendiri di kanan dan pesan lawan di kiri.
- FE-8: Setiap pesan menampilkan jam (format `HH:mm`) dan pemisah tanggal bila berganti hari.
- FE-9: Input pesan: Enter mengirim, Shift+Enter baris baru, tombol "Kirim" nonaktif jika kosong.
- FE-10: Pesan yang baru dikirim muncul langsung (optimistic) dengan status "mengirim", lalu menjadi terkirim, atau "gagal" dengan opsi kirim ulang.
- FE-11: Polling pesan baru dari lawan bicara tanpa reload dan tanpa mengacak scroll.
- FE-12: Auto-scroll ke bawah saat pesan baru masuk jika user sedang di dasar; jika user sedang membaca ke atas, tampilkan tombol "Pesan baru".
### Backup (P1)
- FE-13: Tombol "Minta backup" di header.
- FE-14: Menampilkan status: sedang diproses, berhasil (disertai waktu), atau gagal.
### Waktu (P1)
- FE-15: Semua waktu tampil lewat satu fungsi `formatTime()` yang memakai zona WIB.
- FE-16: Titik sambung `getSyncedNow()` dipakai untuk label seperti "baru saja" atau "hari ini"; awalnya mengembalikan jam laptop.
## 6. Komponen UI
 
| Komponen | Fungsi |
|---|---|
| `AuthForm` | Form login dan register yang dipakai bersama |
| `Sidebar` | Header diri sendiri, pencarian, daftar user |
| `UserListItem` | Satu baris user (avatar inisial, nama, penanda aktif) |
| `ChatHeader` | Nama lawan bicara dan tombol kembali (mobile) |
| `MessageList` | Daftar pesan, scroll, pemisah tanggal |
| `MessageBubble` | Satu pesan (isi, jam, status kirim) |
| `MessageInput` | Kotak teks dan tombol kirim |
| `BackupButton` | Tombol backup dan status |
| `EmptyState`, `Spinner`, `ErrorBanner` | Tampilan kosong, memuat, dan error |
 
## 7. Lapisan data (kunci agar mudah disambung ke backend)
 
Semua komponen **tidak boleh** memanggil `fetch` atau mock secara langsung. Mereka hanya memanggil fungsi di `lib/api`.
 
```ts
// lib/types.ts
export type User = { id: number; username: string };
 
export type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  createdAt: string;          // ISO 8601, dari server
  status?: "sending" | "sent" | "failed"; // hanya untuk pesan lokal
};
```
 
```ts
// lib/api.ts  (daftar fungsi yang harus tersedia)
register(data): Promise<void>
login(data): Promise<User>
logout(): Promise<void>
getMe(): Promise<User | null>
getUsers(): Promise<User[]>
getMessages(withUserId: number, afterId?: number): Promise<Message[]>
sendMessage(receiverId: number, body: string): Promise<Message>
requestBackup(): Promise<{ status: "ok" | "error"; finishedAt?: string }>
```
 
Pada tahap awal, `lib/api.ts` berisi data tiruan (array di memori dengan jeda buatan 300 sampai 600 ms agar loading terlihat). Saat backend siap, hanya isi fungsi-fungsi ini yang diganti dengan `fetch` ke `/api/...`; komponen tidak berubah.
 
### Kontrak API yang diharapkan dari backend
 
| Method | Path | Body atau query | Respons |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, email, password }` | 201 |
| POST | `/api/auth/login` | `{ identifier, password }` | `User` |
| POST | `/api/auth/logout` | none | 204 |
| GET | `/api/me` | none | `User` atau 401 |
| GET | `/api/users` | none | `User[]` |
| GET | `/api/messages` | `?with={id}&after={id}` | `Message[]` |
| POST | `/api/messages` | `{ receiverId, body }` | `Message` |
| POST | `/api/backup` | none | `{ status, finishedAt }` |
 
Aturan: `senderId` tidak pernah dikirim dari frontend; backend mengambilnya dari sesi.
 
## 8. Hook dan utilitas
 
- `useAuth()`: status login, `login`, `logout`, `user`.
- `usePollingMessages(userId)`: memanggil `getMessages` berkala dengan `afterId`, menggabungkan hasil ke state, berhenti saat komponen dilepas atau tab tidak aktif.
- `lib/time.ts`: `formatTime(iso)`, `formatDateLabel(iso)`, dan `getSyncedNow()` (placeholder jam laptop).
## 9. Struktur folder yang disarankan
 
```
app/
  (auth)/login/page.tsx
  (auth)/register/page.tsx
  chat/page.tsx
  layout.tsx
components/
  AuthForm.tsx
  Sidebar.tsx
  UserListItem.tsx
  ChatHeader.tsx
  MessageList.tsx
  MessageBubble.tsx
  MessageInput.tsx
  BackupButton.tsx
  ui/ (Spinner, EmptyState, ErrorBanner)
hooks/
  useAuth.ts
  usePollingMessages.ts
lib/
  api.ts
  types.ts
  time.ts
```
 
## 10. Kebutuhan non-fungsional
 
- Responsif: nyaman di lebar 360 px sampai layar laptop.
- Aksesibilitas: label pada input, fokus keyboard terlihat, kontras warna cukup, tombol memakai elemen `button`.
- Kinerja: polling hanya meminta pesan baru (`after`), dihentikan saat tab tersembunyi.
- Keamanan sisi client: tidak menyimpan password; teks pesan ditampilkan sebagai teks biasa (tidak lewat `dangerouslySetInnerHTML`) untuk mencegah XSS.
- Konfigurasi: alamat backend dibaca dari `NEXT_PUBLIC_API_BASE_URL` di `.env`.
## 11. Data mock untuk pengembangan
 
- 3 user contoh (`andi`, `budi`, `citra`) dengan satu user yang dianggap sedang login.
- Beberapa pesan awal berbeda hari agar pemisah tanggal bisa diuji.
- Mock `sendMessage` yang kadang gagal (opsional) untuk menguji status "gagal" dan kirim ulang.
- Mock lawan bicara yang membalas otomatis setelah beberapa detik agar polling terlihat bekerja.
## 12. Kriteria penerimaan
 
- [ ] Halaman login dan register tampil, validasi dan pesan error berfungsi.
- [ ] `/chat` terlindungi, dialihkan ke `/login` bila belum login.
- [ ] Daftar user tampil, bisa dicari dan dipilih.
- [ ] Pesan tampil dengan benar (kiri/kanan, jam, pemisah tanggal).
- [ ] Mengirim pesan: tampil langsung, berstatus mengirim, lalu terkirim atau gagal dengan kirim ulang.
- [ ] Pesan baru muncul otomatis tanpa reload (polling) dan scroll tidak mengganggu.
- [ ] Tombol backup menampilkan status berhasil atau gagal.
- [ ] Tampilan layak di layar ponsel dan laptop.
- [ ] Tidak ada komponen yang memanggil `fetch` langsung (semua lewat `lib/api`).
## 13. Urutan pengerjaan
 
1. Siapkan `lib/types.ts`, `lib/api.ts` (mock), dan `lib/time.ts`.
2. Halaman login dan register beserta `useAuth` dan proteksi halaman.
3. Layout `/chat`: `Sidebar` dan daftar user.
4. `MessageList`, `MessageBubble`, dan `MessageInput` dengan data mock.
5. Kirim pesan (optimistic) dan status gagal.
6. `usePollingMessages` dan perilaku scroll.
7. Tombol backup dan responsif mobile.
8. Rapikan tampilan, uji semua kriteria penerimaan.
9. Saat backend siap: ganti isi `lib/api.ts` dengan `fetch`, ganti proteksi halaman ke cookie sesi.
## 14. Risiko
 
| Risiko | Mitigasi |
|---|---|
| Format respons backend berbeda dari mock | Sepakati kontrak API (bagian 7) dengan pengerja backend sejak awal |
| Komponen memanggil data langsung sehingga sulit diganti | Aturan: semua lewat `lib/api` |
| Polling membuat scroll melompat | Gabungkan pesan berdasarkan `id` dan atur auto-scroll bersyarat (FE-12) |
| Perbedaan tampilan antar-laptop (Linux/Windows) | Seragamkan versi Node.js dan jalankan `npm install` dari `package-lock.json` yang sama |
 