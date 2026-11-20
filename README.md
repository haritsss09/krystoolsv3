 KrysTools

 1. Judul & Deskripsi

KrysTools adalah situs web kumpulan 71 alat (tools) yang berjalan langsung di peramban, dikelompokkan ke dalam 8 kategori: developer, keamanan, jaringan, produktivitas, gambar/berkas, data publik, dan AI.

Latar belakang masalah: alat-alat kecil seperti format JSON, cek DNS, konversi gambar, atau data cuaca BMKG biasanya tersebar di banyak situs berbeda, sering penuh iklan, dan sebagian mengirim data pengguna ke server. KrysTools menyatukannya dalam satu tempat, dengan sebagian besar alat diproses di peramban sehingga data tidak keluar dari perangkat.

Target pengguna: pelajar, mahasiswa, dan pengembang pemula yang membutuhkan alat bantu cepat untuk belajar pemrograman, jaringan, dan pengolahan data.

 2. Teknologi yang Digunakan

 Bahasa : HTML, CSS, JavaScript (ES Modules), TypeScript (Edge Functions) 
 Pustaka/modul : Tanpa framework dan tanpa build step; modul JavaScript buatan sendiri (`assets/js/core`) 
 Backend : Supabase (autentikasi, database, Edge Functions `net-inspect`, `ai`, `admin`) 
 API publik : BMKG, Google Public DNS, RDAP, kurs mata uang, hari libur 
 Server lokal : Node.js (`server/dev-server.mjs`) 
 Platform publikasi : Qoder Sites 

3. Pemanfaatan AI (AI Usage Disclosure)

Alat AI yang digunakan: Qoder (asisten AI pemrograman di Qoder Desktop).

Contoh perintah (prompt) utama:

- "Buatkan website kumpulan tools untuk developer, keamanan, jaringan, dan produktivitas dengan HTML, CSS, dan JavaScript tanpa framework."
- "Gunakan Api publik untuk tambahan Tools"
- "publish"
- "background still same"
- "CRITICAL DESIGN CONSTRAINT: preserve original background. Jangan ubah background, boleh redesign navigasi, hero, tipografi, search, dan tool cards."
- "redesign browse by category and if u have recomendation u can modify anything but ask me first"

Penyesuaian/perbaikan mandiri terhadap saran AI:

- AI sempat menurunkan kegelapan lapisan background (overlay) agar video terlihat. Saya menolak perubahan itu karena mengubah identitas visual, lalu meminta overlay dikembalikan ke nilai asli (`0.62` / `0.82`).
- Saya membatasi AI agar hanya mengubah tampilan (UI), tidak menyentuh logika autentikasi, API, dan database.
- Saya mewajibkan AI meminta izin sebelum menerapkan rekomendasi di luar bagian yang saya minta.

Rincian lengkap ada di [AI_LOGBOOK.md](AI_LOGBOOK.md).

4. Panduan Penggunaan

Situs aktif: https://krystools-24dro0x67tp.qoder.website

Cara memakai:

1. Buka tautan di atas dan masuk/daftar akun.
2. Ketik nama alat di kolom pencarian (contoh: `json`), atau pilih kategori di bagian **Browse by category**.
3. Klik alat yang diinginkan, isi input, dan hasil muncul langsung.

Menjalankan di komputer sendiri (butuh Node.js):


node server/dev-server.mjs


Lalu buka http://localhost:5173. Atur `LOCAL_FUNCTIONS=1` di `.env` untuk memakai salinan lokal Edge Functions.

Deploy Edge Functions:


supabase secrets set ALLOWED_ORIGINS=https://your-site.example
supabase secrets set AI_PROVIDER=openai AI_MODEL=... OPENAI_API_KEY=...
supabase functions deploy net-inspect
supabase functions deploy ai


Keterbatasan: rate limit disimpan di memori per instance fungsi; hasil cek header memakai request HEAD sehingga bisa berbeda dari GET.

5. Identitas Pengembang

	 	[HARITS ABDURAHMAN ANANTO], [XI-2], [TEKNOLOGI KOMPUTER DAN JARINGAN], [SMKN 5 KOTA MADIUN]
		[IBRA PUTRA PRASETYA], [XI-2], [TEKNOLOGI KOMPUTER DAN JARINGAN], [SMKN 5 KOTA MADIUN]
		[FAIZ KHOIRUROZIQIN], [XI-2], [TEKNOLOGI KOMPUTER DAN JARINGAN], [SMKN 5 KOTA MADIUN]
