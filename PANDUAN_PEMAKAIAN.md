# Panduan Lengkap Cara Pemakaian — AI Clipper Studio (Podcast AI Editor)

Studio lokal untuk mengubah video podcast panjang (MP4/MOV atau YouTube berizin) menjadi klip vertikal **9:16 (1080×1920 · 30 fps)** siap unggah ke TikTok, Reels, dan YouTube Shorts.

---

## 1. Menjalankan dan Membuka Studio

1. Buka terminal PowerShell pada folder proyek:
   ```powershell
   Set-Location C:\Mosyahizuku\codex\clip
   npm.cmd run dev
   ```
2. Buka browser ke alamat: **http://127.0.0.1:3210**
3. Gunakan bar filter di bagian atas halaman untuk memilih tampilan kerja yang paling nyaman:
   - **Semua Panel**: Menampilkan seluruh fitur dalam satu halaman.
   - **⚡ Fokus Super Auto Clipper**: Hanya menampilkan monitor video dan wizard otomatis 6-tahap.
   - **✂️ Fokus Edit & Voice Manual**: Hanya menampilkan monitor video dan pengaturan potong/gaya/suara manual.
   - **📝 Fokus Transkrip & Highlight**: Fokus pada transkripsi Whisper, koreksi subtitle, dan pencarian highlight.
   - **📖 Panduan Pemakaian**: Membuka panduan interaktif langsung di dalam aplikasi.

---

## 2. Memasukkan Video Sumber (MP4/MOV atau YouTube)

### A. Dari File Lokal (MP4 / MOV)
1. Klik tombol **＋ Impor video** di kanan atas, atau **seret file MP4/MOV** langsung ke area **Monitor video**.
2. Mendukung ukuran file hingga **4 GB** dan durasi maksimal **6 jam**.
3. Setelah diunggah, video otomatis terpilih di dropdown **Video sumber**.

### B. Dari Tautan YouTube Berizin
1. Klik panel **Impor dari YouTube** di bawah monitor.
2. Tempel URL satu video YouTube (`https://www.youtube.com/watch?v=...` atau `https://youtu.be/...`).
3. Centang kotak **Saya memiliki izin untuk mengunduh dan menggunakan video ini**.
4. Klik **Impor dari tautan** dan tunggu bar progres mencapai **100%**.

---

## 3. Cara Tercepat: ⚡ Super Auto Clipper (Pipeline 6-Tahap)

Gunakan panel **Super Auto Clipper · Pipeline End-to-End** untuk memproses video dari awal sampai menjadi beberapa klip MP4 secara otomatis maupun bertahap.

### Mode A — Full Auto (1-Klik Langsung Render)
1. Pada **Tahap 1**, ubah **Mode eksekusi** menjadi **Full Auto (Langsung Render MP4)**.
2. Pilih **Mode gaya edit** (misal *Otomatis sesuai isi transkrip*, *Viral aggressive*, *Documentary rich*, *Safe clean*).
3. Pilih **Versi per klip** (1, 2, atau 3 versi gaya berbeda untuk tiap highlight) dan **Durasi klip** (`15–30`, `30–60`, atau `60–90` detik).
4. Klik **Jalankan Full Auto (Tahap 1 → 6) → Render MP4**.
5. Sistem otomatis menjalankan transkripsi (jika belum ada), memilih highlight terbaik, memasang gaya & visual, lalu memasukkan semuanya ke **Antrean dan riwayat**.

### Mode B — Review Step-by-Step (Tinjau Tahap 1 → 6)
1. Pilih **Mode eksekusi**: **Review Step-by-Step (Tahap 2 → 6)**, lalu klik **Susun Rencana Auto Clipper (Mulai Tahap 1 → 6)**.
2. **Tahap 2 (Transkripsi)**: Periksa jumlah segmen ujaran yang terdeteksi dan baca cuplikan teks per klip, lalu klik **Lanjut ke Tahap 3**.
3. **Tahap 3 (AI Highlight)**:
   - Lihat daftar potongan terbaik beserta **Hook pembuka**, **Penutup (Punchline)**, **Skor Retensi**, dan **Emosi**.
   - Centang/hapus klip yang diinginkan, atau ubah judul serta detik **Mulai** dan **Selesai**.
   - Klik **Lanjut ke Tahap 4**.
4. **Tahap 4 (Rekomendasi Style & Multi-Versi)**:
   - Setiap klip memiliki 1–3 versi gaya berbeda (misal Versi 1: *Clipper Podcast*, Versi 2: *Clipper Quotes*).
   - Anda dapat mengganti preset gaya pada dropdown masing-masing versi, lalu klik **Lanjut ke Tahap 5**.
5. **Tahap 5 (Visual Planning & Voice-Over)**:
   - Periksa jadwal visual otomatis per detik: **`[GRAFIK]`** (bar metrik/perbandingan/linimasa), **`[MOTION]`** (langkah bernomor, pertanyaan, atau penanda **Klaim/Opini vs Data/Fakta**), **`[FOTO/ILUSTRASI]`** (Wikimedia Commons), dan **`[B-ROLL]`** (aset lokal).
   - Atur **Preset narator TTS** dan teks **Narasi voice-over** bila ingin menambahkan suara pengantar.
   - Klik **Lanjut ke Tahap 6**.
6. **Tahap 6 (Review Akhir & Render MP4)**:
   - Pilih **Render preview 360p cepat** (untuk cek cepat) atau matikan centangnya untuk **Final 1080p**.
   - Klik **Render Versi Terpilih**.

---

## 4. Cara Potong & Edit Manual + 25 Preset Gaya

Di panel kanan (**Pengaturan klip**):

1. Pilih **Video sumber**.
2. Isi waktu **Mulai** dan **Selesai** dalam format `menit:detik` (contoh `01:30`), `jam:menit:detik`, atau detik (`90`).
3. Pilih **Gaya editing**:
   - **Built-in**: `Manual` (potong bersih tanpa subtitle), `Cinematic` (pelacakan wajah & zoom halus), `Stack Pop` (kartu foto bertumpuk & subtitle blok), `Otomatis` (AI memilihkan gaya).
   - **22 Preset Clipper**: `Clipper Quotes`, `Clipper Podcast`, `Clipper Game`, `Clipper Konspirasi`, `Clipper Politik`, `Clipper Documentary`, `Clipper Motivation`, `Clipper Finance`, `Clipper Debate`, `Clipper Breaking News`, `Clipper Storytelling`, `Clipper Tutorial`, `Clipper Newsroom`, `Clipper Horror Story`, `Clipper Luxury`, `Clipper Meme Fast`, `Clipper Islamic Dakwah`, `Clipper Edu Explainer`, `Clipper Street Interview`, `Clipper Finance Market`, `Clipper Tech Review`, `Clipper True Crime`.
4. Klik langsung tombol di bawahnya:
   - **Render MP4**: Ekspor kualitas penuh **1080×1920 H.264/AAC 30 fps**.
   - **Render preview 360p**: Render cepat untuk memeriksa framing, subtitle, grafik, dan suara.
   - **Buat 3 versi preview**: Otomatis merender rentang waktu yang sama dalam 3 gaya berbeda sekaligus.
5. Untuk melihat contoh video 6 detik dan aturan tiap gaya sebelum memilih, buka menu **Pustaka gaya dan mode edit** → pilih preset di **Bandingkan preset** → klik **Pakai**.

---

## 5. 🎙️ Voice Studio Bahasa Indonesia & Kemiripan Suara (`Downloads/test.wav`)

Voice Studio menggunakan suara neural **Bahasa Indonesia asli (`id-ID-ArdiNeural` & `id-ID-GadisNeural`)** serta mesin **Kemiripan Warna Suara & Nada Lokal**.

### A. Membuat Narasi Voice-Over Bahasa Indonesia
1. Pastikan **Gaya editing** bukan `Manual`.
2. Buka menu **Voice Studio · Suara Bahasa Indonesia & Kemiripan WAV** di panel kanan.
3. Ketik kalimat Bahasa Indonesia di kotak **Teks narasi voice-over**.
4. Pilih **Preset narator Indonesia**:
   - *Natural · Bahasa Indonesia (Ardi)*
   - *Tenang · Kalem & Jelas*
   - *Energik · Cepat & Antusias*
   - *Narator Dokumenter Wibawa*
   - *Pembawa Berita Tegas*
   - *Storyteller Hangat (Gadis)*
5. Pilih **Waktu muncul suara**:
   - **Di awal video (0 dtk)**: Narasi masuk sejak frame pertama.
   - **Saat kalimat pertama mulai**: Narasi disinkronkan tepat saat pembicara mulai berbicara.
   - **Saat scene visual pertama**: Narasi masuk saat grafik/scene pertama muncul.
   - **Detik khusus**: Tentukan sendiri detik masuknya suara.
6. Atur **Kecepatan bicara**, **Volume narasi**, dan **Suara video asli saat narasi (Audio Ducking)** — volume video asli otomatis direndahkan secara halus selama narator berbicara dan kembali penuh setelah selesai.
7. Klik **🔊 Dengarkan preview suara Bahasa Indonesia** untuk memutar hasilnya langsung di browser sebelum merender video.

### B. Cara Memakai Kemiripan Suara `Downloads/test.wav` (atau WAV Lain)
Di bagian bawah Voice Studio (**Kemiripan Suara dari Sampel WAV**):
1. Isi **1. Nama pemilik suara** dan pilih **Dasar izin** (*Suara saya sendiri* atau *Pemilik suara memberi izin eksplisit tertulis*).
2. Centang kedua kotak pernyataan izin:
   - *Saya memiliki izin eksplisit pemilik suara untuk memakai sampel WAV ini.*
   - *Saya menyatakan tidak meniru suara orang lain tanpa izin.*
3. Klik tombol **⚡ 2. Pakai Langsung Downloads/test.wav** (atau pilih file `.wav` lain melalui pemilih file).
4. Sistem akan menganalisis profil akustik `Downloads/test.wav` (misal: `Nada Dasar: 150.9 Hz · Karakter: Tenor / Natural · Durasi: 21.13 dtk`) dan otomatis mencentang **3. Aktifkan kemiripan suara sampel ini pada narasi TTS**.
5. Klik **🔊 Dengarkan preview suara (Kemiripan WAV Aktif)** untuk mendengar suara Bahasa Indonesia yang nada dasar (pitch F0) dan warna suaranya (timbre/EQ) telah disesuaikan dengan `Downloads/test.wav`.
6. Untuk menghapus sampel kapan saja, klik **Hapus sampel & cabut izin**.

---

## 6. Transkripsi Manual, Koreksi Subtitle & Pencarian Highlight

Pada panel **Transkrip dan highlight**:
1. Pilih **Bahasa ujaran** (*Bahasa Indonesia*, *Deteksi otomatis*, atau *Bahasa Inggris*), lalu klik **Transkripsikan**.
2. Setelah status selesai, buka **Koreksi subtitle** jika ada ejaan kata yang ingin diperbaiki, ubah teks pada segmen terkait, lalu klik **Simpan** (waktu per kata otomatis dibagi ulang secara proporsional). Klik **Unduh SRT ↓** bila membutuhkan file subtitle terpisah.
3. Pilih cakupan pencarian (**Seluruh video** atau **Rentang waktu pilihan**), tentukan **Durasi** (`15–30`, `30–60`, `60–90` detik) dan **Jumlah klip** (`3–10`), lalu klik **Cari highlight**.
4. Pada setiap kandidat highlight yang muncul:
   - Klik **Buka di editor** untuk memindahkan waktu mulai/selesai ke editor manual.
   - Klik **Buka & pakai gaya** untuk memindahkan waktu sekaligus mengaktifkan preset gaya yang direkomendasikan AI.
   - Atau centang beberapa kandidat lalu klik **Render pilihan** untuk memproses semuanya sekaligus.

---

## 7. Ilustrasi Visual, B-Roll Lokal & Watermark

1. **Tampilan dan gerak**:
   - Centang **Cari ilustrasi dokumenter dari topik transkrip** agar sistem otomatis menyematkan grafik data, motion graphics, atau foto berlisensi terbuka dari Wikimedia Commons (`Public domain`, `CC0`, `CC BY`, `CC BY-SA` lengkap dengan atribusi kreator & lisensi).
   - Unggah hingga 3 **Foto b-roll berizin** (atau impor satu folder foto lokal) agar diprioritaskan sebagai visual cutaway atau kartu *Stack Pop*.
2. **Persetujuan ilustrasi eksternal**:
   - Buka menu ini dan centang **Hanya pakai sumber yang saya setujui** lalu klik **Cari referensi untuk rentang ini** jika Anda ingin memilih sendiri foto Wikimedia mana yang boleh tampil.
3. **Kredit sumber dan watermark**:
   - Isi **Sumber video** (misal nama podcast/kanal) dan **Watermark teks** (misal `@namakanal`), pilih posisi (6 sudut/tengah), font, gaya (*Klasik*, *Label*, *Editorial*), serta opasitas.

---

## 8. Mengelola Antrean Render & Mengunduh Hasil

Pada panel **Antrean dan riwayat** di bagian bawah:
- **Jeda / Lanjutkan / Batalkan**: Mengontrol proses render yang sedang berjalan atau menunggu.
- **Putar**: Memutar video MP4 hasil render langsung di **Monitor video** atas.
- **Unduh MP4 ↓**: Mengunduh file klip vertikal (`klip-xxxxxxxx.mp4`).
- **Sumber ilustrasi ↓**: Mengunduh file JSON berisi daftar lengkap sumber foto, kreator, lisensi, dan grafik yang terpasang pada klip tersebut.
- **Unduh ZIP sumber ↓**: Mengemas seluruh klip yang sudah selesai untuk video sumber aktif ke dalam satu file `klip-podcast.zip`.

---

## 7. Fitur Baru: AI Clipper Ultimate Studio (Upgrade 6)

### A. Simple Mode (1-Klik Cepat) vs Advanced Mode
- Klik tab **`✨ Simple Mode (1-Klik Cepat)`** di bar navigasi atas bila ingin membuat klip dalam 6 langkah ringkas tanpa membuka puluhan pengaturan:
  1. Unggah video atau tempel URL YouTube.
  2. Pilih tujuan konten (**Viral**, **Informative**, **Cinematic**, **Documentary**, **Gaming**, **Quotes**, atau **Auto**).
  3. Tentukan jumlah dan durasi klip.
  4. Klik **Generate**.
  5. Tonton preview hasil render langsung di kartu hasil.
  6. Klik **Download MP4**.
- Klik **`🎛️ Advanced Mode (Semua Panel)`** untuk membuka kontrol studio penuh.

### B. AI Video Director Engine & Edit Decision List (EDL)
- Di panel **Strategi klip**, klik **`🎬 Lihat Edit Decision List (EDL)`** untuk melihat keputusan sutradara AI per beat waktu:
  - Fase naratif (`HOOK`, `BUILD-UP`, `CLIMAX`, `PAYOFF`).
  - Deteksi pergantian topik & pembicara.
  - Momen **`Hening / Tanpa Efek (Restraint)`** ketika ekspresi pembicara lebih kuat tampil murni tanpa distraksi overlay.
  - Kata kunci sorotan (`emphasisKeywords`), rekomendasi b-roll/grafik, gerak kamera, dan cue audio/SFX.

### C. Advanced Editing Controls & Pratinjau Kanvas 9:16 Instan
- Di bagian **Pengaturan Editing Lanjutan & Safe Area**, Anda dapat memilih 7 preset cepat (**Clean**, **Balanced**, **Cinematic**, **Highly Visual**, **Viral Dynamic**, **Documentary Rich**, **Maximum Motion**).
- Tersedia pengatur Substyle, Intensitas Animasi, Kepadatan Visual, Gaya Animasi Subtitle, Ukuran Huruf, Kecepatan Transisi, Frekuensi B-Roll, Intensitas Kolase, Kepadatan Motion Graphics, Volume BGM, Intensitas SFX, Kualitas Ekspor (**360p**, **720p**, **1080p**), dan Safe Area (**Universal**, **TikTok**, **Reels**, **Shorts**).
- Kotak **Pratinjau Instan Kanvas 9:16** menampilkan posisi subtitle, batas safe area, dan kepadatan visual secara real-time sebelum render.

### D. Automatic Video Quality Control (QC 12 Aspek)
- Setiap video yang selesai dirender diperiksa secara otomatis pada 12 aspek teknis & editorial (format/FPS/resolusi, frame blank/freeze, level audio & auto-repair normalisasi, safe area subtitle, sinkronisasi kata, framing wajah, tabrakan overlay-wajah, kecepatan transisi, kepadatan animasi, relevansi b-roll, keutuhan kalimat, dan kejujuran klaim faktual).
- Klik badge **`QC: Passed` / `QC: Needs Review` / `QC: Failed`** atau tombol **`🔍 Detail`** di riwayat untuk melihat rincian 12 pemeriksaan atau menjalankan **`🔄 Cek Ulang QC`**.

### E. Smart Revision Engine & Perbandingan Before / After
- Pada pekerjaan yang sudah selesai, klik **`🔍 Detail`** → bagian **`✨ Smart Revision Engine (Revisi Cepat Tanpa Transkrip Ulang)`**.
- Klik chip cepat atau ketik perintah bahasa alami seperti:
  - *"Perbesar subtitle"* / *"Kurangi zoom"*
  - *"Tambahkan visual yang relevan"* / *"Buat lebih cinematic"*
  - *"Kurangi sound effect"* / *"Ubah style menjadi documentary"*
  - *"Perbaiki subtitle pada 0:06 menjadi ..."*
- Sistem akan merender versi baru (`Rev 2`, `Rev 3`, dst.) **tanpa mentranskripsi ulang podcast** dan menyediakan pemutar video **Before vs After** berdampingan.

### F. Manajemen Riwayat & Pembersihan Penyimpanan (Mode A / B / C)
- Panel **Manajemen Riwayat & Penyimpanan** menyediakan pencarian, filter status/sumber/tanggal, ukuran file per job, pilih banyak (*multi-select*), **Hapus Terpilih**, **Hapus Semua Riwayat**, dan **Bersihkan File Sementara**.
- Saat menghapus, tersedia 3 pilihan aman dengan estimasi ruang penyimpanan yang akan dibebaskan:
  - **Opsi A**: Hapus catatan riwayat saja di database (file MP4 tetap disimpan).
  - **Opsi B**: Hapus riwayat beserta file hasil render MP4, laporan QC, dan cache khusus pekerjaan tersebut.
  - **Opsi C**: Hapus seluruh data pekerjaan termasuk salinan video sumber di dalam penyimpanan aplikasi (dengan konfirmasi khusus, hanya bila sumber tidak dipakai pekerjaan lain, dan **tidak pernah menghapus file asli Anda di luar folder aplikasi**).
