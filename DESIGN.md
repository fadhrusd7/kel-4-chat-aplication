# design.md: Sistem Desain "Obrolan" (Monokrom)
 
Panduan tampilan untuk frontend web chat (Next.js). Acuan visual: kanvas desain "Desain Web Chat Monokrom" (layar chat desktop, login, dan chat di ponsel).
 
---
 
## 1. Prinsip
 
1. **Hitam, putih, abu-abu saja.** Tidak ada warna aksen. Perbedaan makna dibuat lewat isi warna (terisi atau berbingkai), gaya garis (solid atau putus-putus), dan teks, bukan hue.
2. **Datar dan tegas.** Tanpa gradien, tanpa bayangan, tanpa blur, tanpa sudut membulat (`border-radius: 0`). Struktur dibentuk garis 1 px.
3. **Teks adalah isinya.** Tidak ada ikon dekoratif, emoji, atau ilustrasi. Ikon hanya bila fungsional (misalnya panah kembali), digambar garis tipis.
4. **Mono untuk metadata.** Jam, tanggal, status, dan label teknis memakai font monospace agar terasa seperti log sistem.
5. **Aksesibel sejak awal.** Kontras cukup, target sentuh minimal 44 px, elemen interaktif memakai elemen HTML yang benar.
## 2. Token warna
 
| Token | Hex | Pemakaian |
|---|---|---|
| `ink` | `#0A0A0A` | Teks utama, garis tegas, blok pesan sendiri, tombol utama |
| `paper` | `#FFFFFF` | Latar halaman, bubble lawan bicara, input |
| `wash` | `#F4F4F4` | Latar area pesan |
| `line-soft` | `#D4D4D4` | Garis pemisah tipis antar-baris daftar |
| `line-date` | `#C8C8C8` | Garis pemisah tanggal |
| `mute` | `#6B6B6B` | Teks sekunder (jam, preview, label) |
| `mute-on-ink` | `#D4D4D4` | Teks sekunder di atas latar hitam |
| `sending` | `#4A4A4A` | Latar bubble "Mengirim" |
| `faint-on-ink` | `#A3A3A3` | Teks redup di panel hitam (halaman login) |
 
Pasangan kontras yang sudah dipakai:
 
- `ink` di atas `paper`: sangat tinggi.
- `mute` di atas `paper`: sekitar 5,3:1 (lolos teks kecil).
- `mute` di atas `wash`: sekitar 4,8:1 (lolos teks kecil).
- `paper` di atas `ink` dan `sending`: lolos.
- Jangan memakai abu yang lebih terang dari `mute` untuk teks di latar putih atau `wash`.
## 3. Tipografi
 
Font (Google Fonts):
 
- **IBM Plex Sans** 400, 500, 600: semua teks antarmuka.
- **IBM Plex Mono** 400, 500: jam, tanggal, status, label teknis.
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```
 
| Peran | Font | Ukuran | Berat | Catatan |
|---|---|---|---|---|
| Wordmark (login) | Sans | 72 px | 600 | letter-spacing -0.04em, line-height 0.95 |
| Wordmark (sidebar) | Sans | 24 px | 600 | letter-spacing -0.02em |
| Judul halaman (`Masuk`) | Sans | 36 px | 600 | letter-spacing -0.02em |
| Nama lawan bicara (header) | Sans | 18 px | 600 | letter-spacing -0.01em |
| Teks pesan | Sans | 15 px | 400 | line-height 1.5 |
| Nama di daftar user | Sans | 15 px | 500 | |
| Preview di daftar | Sans | 13 px | 400 | satu baris, terpotong dengan elipsis |
| Label form | Sans | 13 px | 500 | |
| Tombol | Sans | 14 sampai 15 px | 500 | |
| Metadata (jam, status, tanggal) | Mono | 11 sampai 12 px | 400 atau 500 | |
 
Aturan: dua berat utama saja untuk teks (400 dan 500), 600 hanya untuk judul dan wordmark. Kalimat memakai huruf kapital biasa (sentence case), tidak ALL CAPS.
 
## 4. Bentuk, garis, dan jarak
 
- Sudut: `0` di mana-mana.
- Garis tegas: `1px solid #0A0A0A` (bingkai input, tombol, bubble lawan, pemisah panel besar).
- Garis lembut: `1px solid #D4D4D4` (pemisah baris daftar user).
- Garis putus-putus: `1px dashed #0A0A0A`, khusus pesan gagal terkirim.
- Skala jarak (px): 4, 6, 8, 12, 14, 16, 20, 24, 48. Padding panel besar 20 sampai 24, padding halaman login 48.
- Tinggi baku: input 44 atau 48, tombol 44 atau 48, header 72 (desktop) atau 64 (ponsel), avatar 40 (daftar dan header desktop) atau 36 (header ponsel).
## 5. Komponen
 
### 5.1 Avatar
 
Kotak persegi berisi inisial (huruf pertama username, 15 sampai 16 px, berat 600). Tidak ada foto.
 
- Avatar diri sendiri: latar `ink`, huruf `paper`.
- Avatar lawan bicara: latar `paper`, bingkai 1 px `ink`, huruf `ink`.
- Avatar di baris aktif (latar hitam): latar `paper`, huruf `ink`.
### 5.2 Tombol
 
| Varian | Tampilan | Pemakaian |
|---|---|---|
| Utama | Latar `ink`, teks `paper`, bingkai 1 px `ink` | Kirim, Masuk |
| Sekunder | Latar `paper`, teks `ink`, bingkai 1 px `ink` | Minta backup, Keluar |
| Tautan teks | Tanpa latar, teks `ink`, garis bawah | Kirim ulang, Daftar |
 
Tinggi minimal 44 px (48 px untuk tombol utama). Tidak ada efek bayangan. Status hover disarankan dengan membalik warna atau menggeser abu (misalnya `ink` ke `#4A4A4A`), tanpa animasi besar. Status fokus: outline 2 px `ink` dengan offset 2 px (jangan dihilangkan).
 
### 5.3 Input teks
 
- Tinggi 44 (pencarian) atau 48 (pesan, form).
- Bingkai 1 px `ink`, sudut 0, latar `paper`, padding horizontal 12 sampai 14, teks 14 sampai 15 px.
- Selalu ada `<label>` (boleh disembunyikan secara visual untuk pencarian dan pesan, tetap terbaca screen reader).
- Placeholder memakai warna bawaan abu yang cukup kontras.
### 5.4 Bubble pesan
 
Maksimal lebar 62% (desktop) atau 80% (ponsel). Padding `10px 14px`. Teks 15 px, line-height 1.5. Di bawah bubble ada metadata mono 11 px warna `mute`.
 
| Jenis | Tampilan | Metadata |
|---|---|---|
| Lawan bicara | Latar `paper`, bingkai 1 px `ink`, teks `ink`, rata kiri | `HH:mm` |
| Terkirim (sendiri) | Latar `ink`, teks `paper`, rata kanan | `HH:mm · Terkirim` |
| Mengirim | Latar `sending` (`#4A4A4A`), teks `paper`, rata kanan | `HH:mm · Mengirim…` |
| Gagal | Latar `paper`, bingkai putus-putus `ink`, teks `ink`, rata kanan | `HH:mm · Gagal terkirim` + tombol teks "Kirim ulang" |
 
Jarak antar-pesan: 14 px (desktop) atau 12 px (ponsel).
 
### 5.5 Pemisah tanggal
 
Satu baris: garis tipis (`line-date`), label mono 12 px warna `mute` di tengah ("Kemarin", "Hari ini"), garis tipis lagi. Muncul saat tanggal berganti.
 
### 5.6 Baris daftar user
 
Tombol selebar penuh, padding `14px 20px`, isi: avatar, nama (kiri), jam terakhir (kanan, mono 11 px), dan preview pesan terakhir (satu baris, elipsis).
 
- Tidak aktif: latar `paper`, garis bawah `line-soft`, preview `mute`.
- Aktif (percakapan terbuka): latar `ink`, teks `paper`, preview dan jam `mute-on-ink`. Cukup dibaca sebagai "baris yang dibalik warnanya".
### 5.7 Pesan error (banner)
 
Kotak dengan bingkai 1 px `ink`, padding `12px 14px`, teks 14 px: bagian pertama tebal ("Gagal masuk."), diikuti penjelasan. Tidak memakai warna merah.
 
### 5.8 Footer sidebar (status backup)
 
Garis atas 1 px `ink`, padding `16px 20px`, teks mono 12 px. Baris pertama label (`mute`), baris kedua status: "Berhasil · 24 Nov, 14:02 WIB" (atau "Memproses…" dan "Gagal" untuk kondisi lain, ditulis dengan kata, bukan warna).
 
## 6. Layout layar
 
### 6.1 Chat (desktop)
 
- Dua kolom. Sidebar kiri lebar 300 sampai 340 px dengan garis kanan 1 px `ink`. Kolom kanan mengisi sisa lebar.
- Sidebar dari atas: wordmark, identitas diri (avatar dan "masuk sebagai"), tombol Minta backup dan Keluar, kolom pencarian, daftar user, dan di dasar footer status backup.
- Kolom kanan dari atas: header 72 px (avatar dan nama lawan di kiri, "Jam server" dan jam WIB di kanan), area pesan latar `wash` (padding 24), composer (input dan tombol Kirim, di bawahnya petunjuk mono "Enter kirim · Shift+Enter baris baru").
- Jam di header: label "Jam server" (mono, `mute`), nilai `HH:mm WIB`. Nilainya dari `getSyncedNow()`.
### 6.2 Login
 
- Dua panel. Kiri hitam (`ink`, teks `paper`): label mono atas, wordmark 72 px dengan satu kalimat penjelas, label mono bawah. Kanan putih: form di tengah, lebar maksimal 380 px.
- Form: judul "Masuk", banner error (bila ada), label dan input username/email, label dan input password, tombol utama "Masuk", tautan ke "Daftar".
- Halaman register memakai pola yang sama dengan kolom tambahan email dan konfirmasi password.
### 6.3 Chat (ponsel, lebar 390 px)
 
- Satu kolom penuh. Daftar user dan percakapan bergantian (bukan berdampingan).
- Header 64 px: tombol kembali (44 x 44, panah garis 2 px), avatar 36, nama, jam server di kanan.
- Area pesan `wash` (padding 16), bubble maks 80%.
- Composer di dasar dengan input 48 px dan tombol Kirim.
- Tidak ada status bar palsu.
## 7. Responsif
 
| Lebar | Perilaku |
|---|---|
| 1024 px ke atas | Sidebar dan percakapan berdampingan |
| 640 sampai 1023 px | Sidebar menyempit (min 280 px), tetap berdampingan bila muat |
| di bawah 640 px | Satu kolom: daftar user, lalu percakapan setelah memilih; tombol kembali di header |
 
Login: dua panel menumpuk pada layar sempit (panel hitam di atas dengan tinggi ringkas, form di bawah).
 
## 8. Aksesibilitas
 
- Semua elemen interaktif memakai `<button>`, `<a href>`, `<input>`; tidak ada `div` yang diberi `onClick`.
- Setiap input punya `<label>` (visible atau `sr-only`).
- Tombol ikon saja (kembali) wajib `aria-label`.
- Fokus keyboard terlihat jelas (outline 2 px `ink`, offset 2 px).
- Target sentuh minimal 44 x 44 px, termasuk tombol teks "Kirim ulang".
- Teks kecil 11 sampai 12 px hanya untuk metadata mono dan tetap memenuhi kontras 4,5:1.
- Perbedaan status (terkirim, mengirim, gagal) selalu ada **teks**-nya, bukan hanya gaya visual.
- Hormati `prefers-reduced-motion`; hindari animasi selain transisi singkat (sekitar 100 ms).
## 9. Konten dan nada
 
- Bahasa Indonesia, singkat dan lugas.
- Label tombol berupa kata kerja: "Masuk", "Kirim", "Minta backup", "Keluar", "Kirim ulang".
- Format waktu: `HH:mm` (24 jam) dengan titik dua, zona WIB. Tanggal pemisah: "Hari ini", "Kemarin", lalu "24 Nov" dan seterusnya.
- Tidak ada teks dummy "lorem ipsum" di versi akhir; data contoh hanya untuk mock.
## 10. Implementasi Tailwind (opsional)
 
```js
// tailwind.config.js (potongan)
module.exports = {
  theme: {
    borderRadius: { none: "0", DEFAULT: "0" },
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#FFFFFF",
        wash: "#F4F4F4",
        mute: "#6B6B6B",
        "line-soft": "#D4D4D4",
        "line-date": "#C8C8C8",
        sending: "#4A4A4A",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: { none: "none" },
    },
  },
};
```
 
Contoh kelas untuk bubble:
 
```tsx
// lawan bicara
<div className="border border-ink bg-paper px-3.5 py-2.5 text-[15px] leading-normal">...</div>
// sendiri, terkirim
<div className="border border-ink bg-ink px-3.5 py-2.5 text-[15px] leading-normal text-paper">...</div>
// mengirim
<div className="border border-sending bg-sending px-3.5 py-2.5 text-[15px] leading-normal text-paper">...</div>
// gagal
<div className="border border-dashed border-ink bg-paper px-3.5 py-2.5 text-[15px] leading-normal">...</div>
// metadata
<div className="font-mono text-[11px] text-mute">14:21 · Terkirim</div>
```
 
Fokus global (di `globals.css`):
 
```css
:focus-visible { outline: 2px solid #0A0A0A; outline-offset: 2px; }
```
 
## 11. Yang dihindari
 
- Warna selain skala abu (termasuk merah untuk error dan hijau untuk sukses).
- Sudut membulat, bayangan, gradien, blur, glassmorphism.
- Garis tepi kiri tebal sebagai aksen kartu.
- Emoji dan ikon dekoratif.
- Animasi yang berlebihan atau efek "mengambang".
- Teks abu terang di latar putih (kontras kurang).
## 12. Pemetaan ke komponen frontend (PRD)
 
| Komponen PRD | Bagian desain |
|---|---|
| `AuthForm` | 5.2, 5.3, 5.7, 6.2 |
| `Sidebar` | 5.1, 5.2, 5.3, 5.6, 5.8, 6.1 |
| `UserListItem` | 5.1, 5.6 |
| `ChatHeader` | 5.1, 6.1, 6.3 |
| `MessageList` | 5.5, 6.1 |
| `MessageBubble` | 5.4 |
| `MessageInput` | 5.2, 5.3 |
| `BackupButton` | 5.2, 5.8 |
| `ErrorBanner` | 5.7 |
 