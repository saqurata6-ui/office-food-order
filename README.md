# MakanKantor 🍱
> Aplikasi Web Pemesanan Makan Bersama Kantor & Split-Bill Otomatis

Aplikasi ini dibuat khusus untuk mempermudah PIC dan seluruh anggota tim saat mengadakan acara makan-makan kantor:
- **Scan Menu dengan AI**: Upload foto/screenshot menu atau file PDF menu resto, AI akan otomatis mengubahnya menjadi daftar menu pilihan dengan harga.
- **Public Shareable Link**: Satu link acara bisa disebarkan ke grup WhatsApp/Slack. Anggota tim cukup buka di browser HP masing-masing tanpa perlu install aplikasi.
- **Kalkulasi Transparan**: Tiap nama otomatis dihitungkan subtotal makanan, PPN proporsional (default 10%), biaya layanan, dan pembulatan (rounding).
- **Fitur Kunci (Lock Order)**: Saat batas waktu tiba, PIC dapat mengunci pesanan agar tidak ada perubahan lagi.
- **Rekap & Ekspor**:
  - Rekap untuk Restoran (kitchen view: total porsi per menu & catatan khusus).
  - Rekap Split-Bill per nama (siapa pesan apa + status sudah bayar / belum bayar).
  - Export ke **Excel (.xlsx)**, **PDF**, dan **Print View** siap cetak.

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
# 1. Masuk ke direktori
cd office-food-order

# 2. Install dependencies (jika belum)
npm install

# 3. Jalankan server development
npm run dev
```

Buka browser di `http://localhost:3000`.

---

## 🌐 Cara Sebar Public Link (Deploy Gratis ke Vercel)

Agar teman-teman kantor bisa mengakses web ini langsung dari HP mereka di mana saja:

1. **Upload ke GitHub**:
   - Buat repositori baru di [GitHub](https://github.com/new).
   - Jalankan perintah berikut di folder proyek:
     ```bash
     git add .
     git commit -m "feat: inisialisasi web makan kantor"
     git branch -M main
     git remote add origin https://github.com/USERNAME/office-food-order.git
     git push -u origin main
     ```

2. **Deploy di Vercel (Gratis Rp 0)**:
   - Buka [Vercel](https://vercel.com) dan login dengan akun GitHub Anda.
   - Klik **"Add New..."** -> **"Project"** -> pilih repositori `office-food-order`.
   - Klik **"Deploy"**.
   - Dalam 1 menit, Anda akan mendapatkan domain publik HTTPS gratis, contoh:  
     `https://makan-kantor.vercel.app`

3. **Bagikan Link**:
   - Buka web tersebut, buat acara baru, lalu klik **"Bagikan ke WhatsApp"**!

---

## 🗄️ Di Mana Databasenya Ditaruh?

### 1. Mode Bawaan (Out-of-the-Box / Default)
Aplikasi sudah dilengkapi dengan sistem database lokal (`src/data/db.json`) yang siap pakai tanpa perlu konfigurasi akun apa pun untuk pengujian lokal maupun server internal.

### 2. Mode Cloud: Supabase (PostgreSQL Gratis)
Untuk deploy publik permanen di mana data tersimpan di cloud database:
1. Buka [Supabase](https://supabase.com) dan buat proyek gratis baru.
2. Masuk ke menu **SQL Editor**, buka file `supabase_schema.sql` dari proyek ini, lalu jalankan (Run).
3. Masuk ke menu **Project Settings -> API**, lalu salin:
   - `Project URL`
   - `anon public key`
   - `service_role secret`
4. Masukkan ke **Environment Variables** di Vercel atau file `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   ```

---

## 🤖 Mengaktifkan Fitur AI Scanner Menu (Gemini API)

Jika Anda ingin fitur scan menu dari foto screenshot / file PDF membaca secara live menggunakan AI Google Gemini:
1. Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/).
2. Masukkan ke `.env.local` atau Environment Variables di Vercel:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
*(Jika belum disetel, aplikasi tetap menyediakan parser teks pintar dan menu simulasi contoh).*
