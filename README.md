# Podcast AI Editor

Studio lokal untuk mengubah MP4/MOV atau video YouTube berizin menjadi klip vertikal. Sumber, transkrip, antrean SQLite, model dan hasil render berada di komputer ini.

> **Panduan Lengkap:** Baca [PANDUAN_PEMAKAIAN.md](PANDUAN_PEMAKAIAN.md) atau klik tombol **📖 Panduan Pemakaian** di bagian atas halaman studio untuk panduan langkah demi langkah (Super Auto Clipper 6-Tahap, Edit Manual 25 Gaya, Voice Studio Bahasa Indonesia & kemiripan suara `Downloads/test.wav`, Riset Visual Grafik/Motion/Wikimedia, serta pengelolaan antrean).

## Membuka studio

Di komputer ini dependensi sudah terpasang. Buka **http://127.0.0.1:3210**. Untuk menjalankan kembali setelah server berhenti, gunakan PowerShell dari folder proyek.

```powershell
Set-Location C:\Mosyahizuku\codex\clip
npm.cmd run dev
```

Jalankan satu server per folder data. Tekan Ctrl+C di terminal server untuk menghentikannya. Mode produksi tersedia melalui `npm.cmd run build` lalu `npm.cmd start` setelah server pengembangan dihentikan.

Untuk memperbarui studio produksi yang sedang dipakai, jalankan `npm.cmd run build` di terminal kedua. Studio tetap melayani versi aktif selama build. Setelah build berhasil dan antrean serta impor selesai, mulai ulang server dengan `npm.cmd start` untuk memakai versi baru.

## Dari podcast ke MP4

1. Klik **Impor video** atau seret file ke monitor. Batas unggahan 4 GiB dan 6 jam. Untuk sumber YouTube, buka **Impor dari YouTube**, masukkan URL satu video dan konfirmasikan izin. Unduhan memerlukan internet dan akses terhadap video tersebut.
2. Untuk memotong langsung, isi **Mulai** dan **Selesai** dalam format menit:detik (contoh 12:30) atau detik. Pilih **Manual**, lalu **Render MP4**. Sumber tanpa audio mendapat kanal AAC hening. Codec sumber yang tidak didukung pemutar browser tetap dapat diproses melalui **Render preview 360p**.
3. Untuk subtitle dan rekomendasi, pilih bahasa lalu **Transkripsikan**. Model multibahasa faster-whisper berjalan di CPU dengan INT8. Buka **Koreksi subtitle**, ubah teks segmen, lalu **Simpan**. Koreksi membagi ulang waktu kata di dalam segmen. Transkrip JSON dan SRT berada di `data`. SRT juga dapat diunduh dari studio.
4. Pilih **Seluruh video** atau **Rentang waktu pilihan** untuk membatasi pencarian pada bagian tertentu. Pilih durasi klip dan jumlah 3–10, lalu **Cari highlight**. Mode lokal memberi skor berdasarkan kelengkapan kalimat, isi dan durasi. Saat transkrip pendek atau repetitif, jumlah hasil bisa lebih sedikit. Periksa hook, alasan dan timestamp. **Buka di editor** mengisi rentang manual. Centang beberapa rekomendasi untuk **Render pilihan** sekaligus menggunakan pengaturan editor.
5. **Cinematic** menggunakan pelacakan wajah, zoom, penekanan kata dan transisi singkat. **Stack Pop** menambahkan animasi spring, kartu bertumpuk dan mosaic. Kartu muncul jika Anda memilih foto JPEG/PNG, maksimal tiga foto. Atur font, aksen, posisi, subtitle dan intensitas. Klik **Render preview 360p** untuk memeriksa hasil sebelum render final.
6. **Antrean dan riwayat** menampilkan status render, progres dari encoder, putar, ulangi ketika gagal, dan unduh MP4. **Unduh ZIP sumber** mengemas semua hasil yang sudah selesai untuk sumber terpilih, termasuk versi preview. Ekspor final memakai H.264 dan AAC, 1080×1920 pada 30 fps.

## Konfigurasi

Salin `.env.example` menjadi `.env` jika ingin mengganti port, folder data, lokasi executable atau model Whisper. Mulai ulang server setelah mengubah konfigurasi.

Provider LLM bersifat opsional. Isi `LLM_BASE_URL` (endpoint kompatibel OpenAI hingga `/v1`), `LLM_MODEL`, dan jika diperlukan `LLM_API_KEY`. Studio menggunakan provider hanya ketika pengguna memilih **Kirim teks ke provider LLM**. Yang dikirim ialah teks kandidat. Mode seleksi lokal tersedia tanpa kredensial. Model default Whisper `base` ada di `.cache/models/base`. Model baru memerlukan unduhan awal.

## Pemasangan ulang di Windows

Lingkungan pengujian memakai Windows 11 x64, Node.js 22.16, npm 11 dan Python 3.11. Dependensi Node dan Python dipasang di proyek. FFmpeg dan ffprobe tersedia melalui npm. Skrip opsional `scripts/ffmpeg.ps1` memasang build Windows Essentials di `.cache/ffmpeg` dan memverifikasi SHA-256. Aplikasi memprioritaskan build tersebut jika tersedia.

```powershell
$env:npm_config_cache = "$PWD\.cache\npm"
New-Item -ItemType Directory -Force .cache | Out-Null
$env:TEMP = "$PWD\.cache"
$env:TMP = $env:TEMP
$env:PIP_CACHE_DIR = "$PWD\.cache\pip"
npm.cmd ci
& 'C:\Mosyahizuku\Python\python311\python.exe' -B -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\node_modules\.bin\remotion.cmd browser ensure
npm.cmd run dev
```

## Pengujian

```powershell
npm.cmd test
npm.cmd run build
# Dengan server studio berjalan
node tests/mvp.mjs
node tests/ui.mjs
# Pada checkout baru, siapkan sampel ujaran lalu jalankan integrasi
.\.venv\Scripts\python.exe -B tests/fixtures.py
node tests/studio.mjs
```

Tes UI memakai Microsoft Edge di Windows dan menerima `BROWSER_PATH` untuk lokasi Chromium lain. Tes integrasi membuat sumber serta riwayat uji nyata. Bukti lokal ada di `data/bukti`. Tes render tidak mengukur mutu editorial podcast multi-pembicara. Kondisi pengujian dan keterbatasan tercatat di TASKS.md.

## Komponen dan sumber

- `pages`, `components`, `styles` memuat UI Next.js, TypeScript dan Tailwind. Custom server Express menjalankan API serta Next pada satu origin loopback agar unggahan panjang bisa ditulis langsung ke disk.
- `server` menangani validasi, SQLite, transkrip, pemilihan highlight, antrean dan penyajian media. `workers` menjalankan Whisper, deteksi wajah OpenCV dan bundling terpisah. `composition` berisi animasi Remotion.
- Sembilan bacaan Indonesia milik Google FLEURS digabung dengan pola video sintetis untuk pengujian. File rujukan ada di `data/bukti/fleurs-rujukan.txt`. [Dataset dan lisensi CC BY 4.0](https://huggingface.co/datasets/google/fleurs)
- Sampel pidato JFK untuk tes bahasa Inggris berasal dari [whisper.cpp](https://github.com/ggml-org/whisper.cpp/tree/master/samples). Foto astronaut NASA dari koleksi scikit-image diberi padding untuk uji framing. [Keterangan foto](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut)
- Uji impor memakai *Big Buck Bunny*, © 2008 Blender Foundation, www.bigbuckbunny.org, CC BY 3.0. [Atribusi dan ketentuan](https://peach.blender.org/about/)
- Dokumentasi teknis yang digunakan mencakup [Next.js](https://nextjs.org/docs), [FFmpeg](https://ffmpeg.org/ffmpeg-filters.html), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Remotion](https://www.remotion.dev/docs/renderer/render-media), [Remotion Agent Skills](https://www.remotion.dev/docs/ai/skills), dan [yt-dlp](https://github.com/yt-dlp/yt-dlp).


 
## Kredit, watermark, dan ilustrasi per topik

Buka **Kredit sumber dan watermark** di pengaturan klip. Isi nama kanal atau judul podcast dan teks watermark, lalu pilih sisi serta opasitas watermark. Kosongkan kolom untuk menyembunyikannya. Pengaturan ikut disimpan dalam antrean, berlaku untuk render tunggal dan batch.

Preset awal Cinematic memecah subtitle mengikuti jeda, tanda baca, dan panjang frasa. Pemrosesan audio menggunakan loudnorm dengan target −16 LUFS dan batas true peak −1,5 dB. Pemilihan highlight lokal juga mempertimbangkan awal kalimat, pertanyaan pembuka, akhir kalimat menggantung, dan promosi.

Pada preset Cinematic dan Stack Pop, **Cari ilustrasi dokumenter dari topik transkrip** aktif secara default. Transkripsikan sumber lebih dahulu. Aplikasi memakai kata dari rentang klip untuk mencari topik konkret dan artikel Wikipedia Indonesia bergambar, lalu mencari foto Wikimedia Commons. Hanya JPEG dengan metadata Public domain atau CC0 yang lolos pemeriksaan. Pencarian mengirim istilah topik ke Wikimedia dan memerlukan internet. Matikan opsi untuk render offline sepenuhnya.

Foto muncul sekitar empat detik ketika topik disebut, dengan label Ilustrasi. Bila pencarian gagal atau hasilnya tidak cocok, video pembicara tetap tampil. Periksa render preview untuk mengevaluasi kecocokan konteks. Pada riwayat hasil, **Sumber ilustrasi** mengunduh daftar topik, waktu relatif terhadap awal klip, halaman asal dan lisensi. Foto yang berhasil dipilih disimpan dalam cache proyek.

## Jeda dan pembatalan render

Tombol **Jeda**, **Lanjutkan** dan **Batalkan** tersedia per klip di antrean. Pekerjaan yang dijeda sebelum mulai dilewati sampai dilanjutkan. Pada Windows, menjeda render aktif membekukan worker beserta proses encoder dan renderer anaknya. Posisi render dipertahankan selama proses studio hidup. Antrean menunggu worker aktif itu dilanjutkan atau dibatalkan. Membatalkan render menghentikan worker dan membuang keluaran parsial. Dependensi kontrol proses termasuk dalam requirements.txt.

Posisi watermark tersedia di kiri, tengah, atau kanan pada baris atas maupun bawah. Pilih font terpisah dari subtitle dan gaya Klasik, Label, atau Editorial. Riwayat render menampilkan jumlah ilustrasi yang benar-benar disematkan. Pilihan preset di editor berlaku saat membuat render berikutnya.

Cinematic dan Stack Pop kini memakai satu gerakan zoom perlahan serta toleransi gerak wajah agar framing stabil. Penutup kembali ke pembicara, mempertahankan keterbacaan frasa terakhir dan memperhalus ujung audio. Untuk pemilihan highlight otomatis, skor mengutamakan akhir jawaban sebelum jeda atau pergantian topik.


## Membandingkan gaya

Buka **Pustaka gaya dan mode edit**, pilih **Bandingkan preset**, lalu putar contoh enam detik. **Aturan editing** menampilkan perilaku subtitle, gerak, tipografi, tempo, kepadatan adegan, overlay, aset, transisi, ritme cutaway dan saran suara. Klik **Pakai** untuk menerapkan gaya, kemudian **Render preview 360p** untuk memeriksanya pada video sendiri. Saran suara adalah catatan editorial. Contoh bawaan memakai latar sintetis dan dapat diputar offline.

Profil editorial ada di `server/style-profiles.mjs`. Setelah mengubah profil atau komposisi, jalankan `node scripts/render-style-previews.mjs` untuk memperbarui semua contoh. Tambahkan ID gaya untuk membatasi ekspor, misalnya `node scripts/render-style-previews.mjs newsroom market`. File MP4 dan poster berada di `public/style-previews`.
