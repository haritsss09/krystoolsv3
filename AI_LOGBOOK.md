# AI_LOGBOOK.md

Logbook pemanfaatan kecerdasan artifisial dalam pengembangan **KrysTools**.

- Alat AI: Qoder (asisten AI pemrograman di Qoder Desktop)
- Pengembang:	 [HARITS ABDURAHMAN ANANTO], [XI-2], [TEKNOLOGI KOMPUTER DAN JARINGAN], [SMKN 5 KOTA MADIUN]
		 [IBRA PUTRA PRASETYA], [XI-2], [TEKNOLOGI KOMPUTER DAN JARINGAN], [SMKN 5 KOTA MADIUN]
		 [FAIZ KHOIRUROZIQIN], [XI-2], [TEKNOLOGI KOMPUTER DAN JARINGAN], [SMKN 5 KOTA MADIUN]

 Tahap 1: Eksplorasi Ide & Perancangan Solusi

Tanggal[12/11/2026]
 Prompt :       "Buatkan website kumpulan tools untuk developer, keamanan, jaringan, produktivitas, gambar/berkas, data publik, dan AI dengan HTML, CSS, dan JavaScript tanpa framework." 
		Respons AI  AI mengusulkan konsep satu situs berisi banyak alat yang dikelompokkan per kategori, dengan sebagian besar alat diproses di peramban agar data pengguna tidak dikirim ke server. Alat yang butuh server (cek header HTTP dan alat AI) dipisah ke Supabase Edge Functions. 
		Validasi & Modifikasi Mandiri  Saya memilih tidak memakai framework agar kode mudah dipelajari dan tidak perlu build. Saya menambahkan sumber data lokal Indonesia (BMKG, hari libur) agar relevan untuk pengguna di Indonesia. Saya memutuskan semua alat wajib login lewat Supabase. 

Tahap 2: Penyusunan Kerangka Kode (Scaffolding)

 Tanggal[12/11/2026]
 Prompt  "Susun struktur folder dan file dasar HTML/CSS/JS untuk website ini, termasuk sidebar, pencarian, dan halaman tiap tool." 
 Respons AI :  AI membuat `index.html` sebagai kerangka aplikasi, CSS dipisah menjadi `layout.css`, `components.css`, dan `responsive.css`, serta JavaScript modular: `core/dom.js` (fungsi pembuat elemen `h()`), `core/registry.js` (daftar kategori dan alat), `core/app.js` (routing dan cek login), dan `pages/*.js` untuk tiap halaman. 
alidasi & Modifikasi Mandiri : Saya memeriksa bahwa `responsive.css` dimuat paling akhir agar aturan breakpoint menimpa aturan dasar. Saya mempertahankan video `background.mp4` dengan lapisan gelap sebagai identitas visual situs. Saya menetapkan aturan: perubahan desain hanya boleh di tampilan, tidak boleh mengubah logika login, API, atau database. 

 Tahap 3: Pemecahan Masalah & Penanganan Galat (Debugging)


 Tanggal [12/11/2026]
 Prompt : "background still same"
 Masalah :  Setelah dipublikasikan, video background tidak terlihat berubah. 
 Respons AI : AI menemukan dua penyebab: (1) lapisan gelap overlay menutupi video, dan (2) ada aturan CSS `display: none` yang menyembunyikan video jika perangkat mengaktifkan pengaturan *reduced motion*. AI menghapus aturan penyembunyi dan sempat menurunkan kegelapan overlay ke `0.3` / `0.55`. 
 Validasi & Modifikasi Mandiri : Saya menolak perubahan overlay karena mengubah suasana gelap sinematik situs. Saya memberi batasan tegas: background asli tidak boleh diubah. Overlay dikembalikan ke nilai asli `rgba(10,10,12,0.62)` / `rgba(10,10,12,0.82)`, hanya perbaikan `display: none` yang dipertahankan. Saya mengecek di situs live bahwa nilai overlay sudah kembali. 

 Masalah : Daftar alat di bagian "Browse by category" memiliki ruang kosong terlalu besar; tampilan mobile awalnya terlihat salah. 
 Respons AI : AI menemukan `margin-top: auto` pada `.cat-index__tools` sebagai penyebab ruang kosong, lalu menghapusnya. Tampilan mobile yang salah ternyata karena CSS lama tersimpan di cache peramban. 
 Validasi & Modifikasi Mandiri : Saya meminta pengujian ulang di lebar 320, 768, dan 1440 px. Hasilnya: tidak ada scroll horizontal, 8 kategori dan 71 tautan alat tetap ada, dan tombol di mobile setinggi 44 px agar mudah disentuh. 

Tahap 4: Refleksi & Penjelasan Kode


 Tanggal  [13/11/2026]
 Prompt  :"redesign browse by category and if u have recomendation u can modify anything but ask me first" 
 Respons AI : AI mengubah bagian kategori menjadi direktori dua kolom berisi nama kategori, jumlah alat, deskripsi, dan tautan langsung ke alat. Data tetap diambil dari `CATEGORIES` di `registry.js`, jadi tidak ada data yang ditulis ulang. |
 Penjelasan kode (pemahaman saya) : Fungsi `h(tag, props, ...children)` di `assets/js/core/dom.js` membuat elemen HTML dari JavaScript: `class` menjadi nama kelas, `text` menjadi isi teks, dan properti berawalan `on` menjadi event listener. Di `home.js`, `CATEGORIES.map(...)` mengulang setiap kategori dan membuat kartu beserta daftar tautannya. Fungsi `sanitizeHtml()` menyaring HTML dengan daftar tag yang diizinkan agar tidak ada skrip berbahaya (mencegah XSS). Di `responsive.css`, media query `max-width: 640px` mengubah grid menjadi satu kolom untuk ponsel.


 Ringkasan Etika Pemanfaatan AI

- AI dipakai sebagai asisten; keputusan desain dan batasan ditentukan oleh pengembang.
- Setiap saran AI diuji di peramban sebelum dipublikasikan.
- Kunci API dan rahasia tidak ditulis di kode; disimpan sebagai secret Supabase.
