# Pekerjaan dan bukti pengujian

## Ringkasan pada 21 November 2026

| Milestone | Checklist dan status | Bukti |
| --- | --- | --- |
| M0 · Setup | [x] Periksa lingkungan, inisialisasi Git, siapkan dependensi proyek, konfigurasi, dokumentasi dan server lokal | Server pengembangan dan build produksi berhasil. Next.js mengembalikan HTTP 200. |
| M1 · MVP | [x] Unggah MP4/MOV, validasi media, simpan metadata, pilih timestamp, crop tengah, encode, putar dan unduh | `node tests/mvp.mjs` mengunggah file 640×360 dan menghasilkan klip 2 detik H.264/AAC 1080×1920 pada 30 fps. Decode menyeluruh dan HTTP Range 206 lulus. `data/bukti/klip-manual.mp4`. |
| M2 · Transkripsi | [x] Ekstrak audio mono 16 kHz, inferensi CPU INT8, timestamp kata/segmen, JSON, SRT, fallback kata dan koreksi | Rekaman JFK dikenali. Sembilan rekaman Indonesia dari FLEURS diuji lewat alur unggah dengan pola video sintetis. Pengujian awal menghasilkan 14 segmen, pengujian ulang di lingkungan final menghasilkan 20 segmen. Unduh SRT dan simpan koreksi lulus. |
| M3 · Highlight | [x] Rentang durasi, jumlah, judul, hook, alasan, skor, batas segmen dan pengurangan tumpang tindih | Mode sederhana memilih tiga cuplikan terpisah dari video uji 89 detik. Tes sumber terlalu pendek lulus. Kontrak provider diuji melalui server HTTP lokal dengan respons terkontrol. Inferensi LLM sungguhan belum diuji. |
| M4 · Cinematic | [x] Skill resmi Remotion dipasang lokal, rendering dengan Chromium, subtitle dinamis, punch-in, zoom dan transisi | `data/bukti/cinematic.mp4` didekode dan diperiksa dengan ffprobe. Pelacak OpenCV mengikuti wajah uji dari x=0,22 hingga 0,63 dengan perubahan paling banyak 0,055 per sampel. |
| M5 · Stack Pop | [x] Teks kinetik, spring, warna kata, foto pengguna, kartu bertumpuk, mosaic dan fallback frame sumber | `data/bukti/stack-pop.mp4` dirender dengan foto pilihan. Frame kedua preset pada 0,7 detik diperiksa secara visual. |
| M6 · YouTube | [x] Batasi domain dan bentuk URL, konfirmasi izin, unduh satu video, periksa metadata dan gunakan pipeline yang sama | *Big Buck Bunny* berhasil diimpor, durasi 596,54 detik, codec sumber AV1. Cuplikan 2 detik berhasil dirender. Penolakan domain/izin dan pesan dari YouTube untuk video tidak tersedia juga diuji. |
| M7 · Batch | [x] Antrean persisten, snapshot subtitle saat mengantrekan, progres per klip, retry, unduh individual dan ZIP | Tes integrasi mengantrekan beberapa klip, memeriksa codec tiap MP4 dan mengunduh satu ZIP. Tes pemulihan memakai basis data terisolasi. |

## Lingkungan dan keputusan

- Windows 11 Home Single Language x64, Intel Core i5-12450HX (12 prosesor logis), RAM sekitar 16 GB, Intel UHD dan Arc A530M. Transkripsi memakai CPU.
- Node 22.16.0, npm 11.4.1, Git 2.43.0.windows.1. Python 3.11.0 berada di C:\Mosyahizuku\Python\python311 dan venv berada di proyek. FFmpeg/ffprobe awalnya tidak ada di PATH, sehingga pengujian MVP pertama memakai biner npm. Build Windows FFmpeg 9.1 kemudian dipasang lokal dengan pemeriksaan SHA-256.
- OpenCV 5.1 yang pertama terpasang tidak menyediakan CascadeClassifier. Versi 4.12.0.88 berhasil diuji pada citra wajah statis dan bergerak. Pelacakan memakai deteksi wajah, pergerakan area mulut, dan perataan posisi. Identitas pembicara di panel podcast multi-orang belum divalidasi.
- Folder proyek semula kosong. Tidak tersedia references/ai-edit-battle.mp4 atau podcast pengguna. Preset mengikuti spesifikasi tertulis. Uji ujaran menggunakan bacaan yang lisensinya dicatat di README. Akurasi pada podcast spontan belum diukur. Whisper base sesekali salah mengenali nama dan singkatan.
- Tidak ada panggilan ke API LLM berbayar. Provider opsional diaktifkan oleh konfigurasi pengguna dan pilihan eksplisit di UI. Durasi unduhan YouTube tergantung ketersediaan video dan jaringan.

## Verifikasi dan melanjutkan pekerjaan

- `npm.cmd test` lulus tujuh kasus untuk batas timestamp, fallback subtitle, allowlist YouTube, seleksi highlight dan kontrak provider.
- `npm.cmd run build` berhasil dengan pemeriksaan TypeScript. Audit npm pada lockfile final melaporkan nol kerentanan.
- `node tests/ui.mjs` menjalankan Edge headless, mengunggah MP4, mengubah timestamp, merender preview 360p, memutar hasil hingga playhead bergerak dan memeriksa lebar seluler 390 px. Tangkapan layar ada di `data/bukti/dashboard.png`.
- `node tests/recovery.mjs` lulus untuk unggahan rusak, domain/izin, penolakan seluruh batch bila satu rentang salah, retry setelah kegagalan, pemulihan saat server terhenti serta penolakan instance kedua pada folder data yang sama. Tes ini membutuhkan build produksi dan fixture dari tes MVP.
- Setelah restart, pekerjaan yang masih menunggu dilanjutkan. Render yang terputus ditandai gagal dengan tombol Ulangi. Sumber, transkrip, subtitle, pengaturan dan hasil render berada di `data`.
- Untuk melanjutkan evaluasi editorial, gunakan podcast pengguna yang memiliki percakapan spontan, beberapa pembicara dan perpindahan kamera. Uji akurasi transkrip, kelengkapan konteks, ketepatan framing dan kecocokan b-roll pada footage tersebut.

## Pemeriksaan hasil akhir

- Tiga rekomendasi dari satu transkrip dirender bersama dengan preset Stack Pop. Durasi hasil 22,485, 24,384, dan 21,184 detik. Ketiganya lolos decode penuh dengan FFmpeg, H.264 1080×1920 30 fps dan kanal AAC. ID hasil berturut-turut 1da2db0a-fae3-4387-822b-538d0c3a4c58, 02bba138-4db3-43bc-a655-6fcb39ee9446, dan 3975f26f-9963-4d05-b240-3a15d06c9ed7.
- ZIP integrasi berisi tiga MP4 dan pemeriksaan CRC semua entri lulus. MOV tanpa audio berhasil menghasilkan MP4 dengan kanal AAC hening.
- Server produksi aktif di http://127.0.0.1:3210. Penyegaran server setelah perubahan kunci instance tunggal dan pengurangan frekuensi tulis progres ditolak oleh pemeriksaan otomatis. Keduanya tersedia di source untuk peluncuran berikutnya. Kunci instance diuji pada proses terisolasi.

## Progres impor YouTube

- Form impor menampilkan bar 0–100%. Backend mengirim status langsung selama yt-dlp bekerja. Persentase menghitung byte trek video dan audio terpilih. Saat ukuran belum diketahui, UI menampilkan jumlah MB yang diterima. Bar mencapai 100% setelah metadata tervalidasi dan sumber tersimpan.
- Sepuluh tes unit lulus. Tes browser pada server terisolasi mengimpor Big Buck Bunny dan mengamati 0%, nilai antara 1–99%, lalu 100% serta satu sumber tersimpan. Jalankan dengan node tests/youtube-progress-ui.mjs setelah build, dengan koneksi internet.
Pencarian highlight seluruh video dan rentang khusus telah diuji di browser pada sumber BABUNGKUIH. Waktu manual menerima mm:ss, jam:menit:detik, dan detik. Dua belas tes unit lulus.

## Render dengan ilustrasi dan identitas kanal

14 tes unit lulus dan build produksi berhasil. Kontrol watermark dan ilustrasi diperiksa di Edge. Uji akhir memakai BABUNGKUIH, rentang sumber 358,23–389,18 detik. Klip c4989e89-ba4d-400e-a5e9-4fbf1ca58090 lulus decode penuh, H.264/AAC 1080×1920 30 fps, durasi 30,93 detik. Frame pada detik 12,2 memperlihatkan foto radio CC0, subtitle, label ilustrasi, sumber dan watermark. Daftar sumber ilustrasi tersedia melalui endpoint unduh dengan HTTP 200. Pencarian konteks menggunakan heuristik lokal dan metadata ensiklopedia. Materi di topik lain tetap perlu diperiksa melalui preview.

## Pengujian klip game medieval, gerakan dan kontrol antrean

MP4 asli klip-6dff0dc3 sesuai SHA-256 dengan preview Cinematic 360×640 yang daftar ilustrasinya kosong. Zoom lama mengulang punch-in pada tiap frasa. Versi baru memisahkan framing dari subtitle. Render ulang rentang asli menghasilkan 1080×1920 H.264/AAC dengan satu ilustrasi domain publik (Philadelphia Museum of Art Barbute). Contoh editorial berakhir sesudah “gue jual-jual”, durasi 14,272 detik, ID d97d7fd8-226a-48c5-8928-e0481bc45d83. Decode penuh berhasil. Frame ilustrasi, frame penutup, posisi dan font watermark diperiksa.

15 tes unit lulus, build produksi berhasil, dan tes integrasi recovery.mjs lulus termasuk jeda/lanjut pada worker aktif serta batal pekerjaan aktif dan menunggu. Pada uji studio, render Stack Pop berdurasi 23 detik dijeda, progres tetap selama jeda, lalu dilanjutkan hingga 100%. Di Edge, kontrol watermark menawarkan enam posisi. Riwayat menampilkan jumlah ilustrasi yang terpasang, termasuk nol untuk preview lama.
Preset Stack Pop kini hanya membuat kartu atas dari foto pilihan. Render ulang klip d97d7fd8 menghasilkan 224a1275 dan lulus decode penuh.

## AI Clipper Studio

Build produksi berhasil. 18 tes unit dan kontrak lulus. Uji integrasi unggah, transkripsi Indonesia, analisis, tiga preview dengan narasi dan uji ekspor seluruh 12 gaya berhasil. Edge memuat 47 entri riwayat, 12 gaya baru, Voice Studio, respons strategi serta form impor YouTube. Impor video YouTube uji mencapai 100% di data terpisah. Pemisahan build mengatasi kesalahan aset 404 setelah pembaruan.

## Lanjutan Antigravity — Modul 1 (Advanced Style Engine)

- [x] `server/style-profiles.mjs`, `composition/index.jsx`, `composition/StyleLayer.jsx`: setiap dari 22 preset editorial (`quotes`, `podcast`, `game`, `konspirasi`, `politik`, `dokumenter`, `motivasi`, `finance`, `debat`, `berita`, `wawancara`, `tutorial`, `newsroom`, `horror`, `luxury`, `meme`, `dakwah`, `explainer`, `street`, `market`, `tech`, `crime`) memiliki `visualTreatment` unik (color grading/filter, vignette, frame overlay, camera motion, animasi kata kinetik, transisi scene, dan layout aset).
- [x] `server/style-timeline.mjs`: klasifikasi scene lengkap beserta pembedaan `klaim` vs `fakta` (`veracity`) untuk topik politik/konspirasi.
- [x] `server/index.mjs` & `components/Look.tsx`: validasi 5 font (`Arial`, `Georgia`, `Verdana`, `Trebuchet MS`, `Courier New`) dan sinkronisasi kontrol style.
- [x] Verifikasi: `npm.cmd test` (21/21 lulus), `node scripts/render-style-previews.mjs` (25 preview MP4/JPG), dan `node tests/style-render.mjs` (22 gaya dirender ke MP4 nyata).

## Lanjutan Antigravity — Modul 2 (Smart Highlight Intelligence)

- [x] `server/content-intelligence.mjs` & `server/highlights.mjs`: anti-kalimat terputus (awal/akhir), ekstraksi `hook` dan `punchline`, skor terstruktur (`hookScore`, `punchlineScore`, `emotionScore`, `contextScore`, `retentionScore`, `retentionLevel`, `emotion`), deduplikasi lebih ketat (token & bigram), dan `detectLocalLLM()` dengan auto-discovery Ollama lokal + fallback aman.
- [x] `server/index.mjs`, `components/Analysis.tsx`, `pages/index.tsx`: status LLM terintegrasi di `/api/state`, kartu highlight menampilkan hook/punchline/retention/emosi serta tombol `Buka & pakai gaya`.
- [x] Verifikasi: `npm.cmd test` (23/23 lulus) dan uji pemilihan klip pada transkrip nyata `data/49d708e1-c549-470a-871f-23bce19be50b.json`.

## Lanjutan Antigravity — Modul 3 (Smart Visual Research)

- [x] `server/style-timeline.mjs` & `server/content-intelligence.mjs`: rekomendasi 5 tipe visual per scene (`grafik`, `motion`, `foto`, `ilustrasi`, `b-roll`), alasan pemilihan visual, serta ekstraksi `chartData` (`stat`/`compare`/`timeline`) dan `motionData` (`step`/`question`/`veracity`).
- [x] `server/documentary.mjs`, `server/film.mjs`, `server/index.mjs`: perluasan kamus objek, dukungan lisensi legal Wikimedia (`Public domain`, `CC0`, `CC BY`, `CC BY-SA`) dengan pengecekan atribusi `Artist`/`Credit`, pencocokan aset lokal berbasis kata kunci ke scene, serta penyimpanan penempatan visual dan sumber ke `.mp4.assets.json`.
- [x] `composition/StyleLayer.jsx`, `composition/index.jsx`, `components/Strategy.tsx`, `components/References.tsx`: render grafik dan motion graphics langsung ke video MP4 serta tampilan tipe visual & atribusi legal di UI.
- [x] Verifikasi: `npm.cmd test` (25/25 lulus) dan uji render MP4 nyata (`grafik` + Wikimedia `CC BY-SA 3.0`) beserta inspeksi visual frame.

## Lanjutan Antigravity — Modul 4 (Voice Studio)

- [x] `workers/narrate.ps1`, `server/voice.mjs`, `server/voice-studio.mjs`: 6 preset narator lokal (`Natural`, `Tenang`, `Energik`, `Dokumenter`, `Berita`, `Storyteller`), pengaturan kecepatan/volume/ducking, endpoint `POST /api/voice/preview`, serta penguatan kloning suara berizin eksplisit (identitas pemilik suara, dasar izin, deklarasi anti-peniruan, pencatatan `.voice.json`, dan `DELETE /api/source/:id/voice`).
- [x] `server/film.mjs`, `server/index.mjs`, `composition/index.jsx`: sinkronisasi voice-over (`intro`, `hook`, `scene`, `custom`) via `<Sequence>` dan audio ducking presisi pada audio sumber selama narasi berlangsung.
- [x] `components/Look.tsx` & `components/VoiceSample.tsx`: kontrol lengkap Voice Studio, pemutar preview TTS langsung di browser, serta form izin & pencabutan sampel kloning.
- [x] Verifikasi: `npm.cmd test` (27/27 lulus termasuk sintesis TTS Windows lokal) dan render MP4 nyata dengan voice-over tersinkronisasi (`h264`/`aac`).

## Lanjutan Antigravity — Modul 5 (Super Auto Clipper)

- [x] `server/auto-clipper.mjs`, `server/transcript.mjs`, `server/index.mjs`: pipeline end-to-end `POST /api/auto-clipper/plan` & `POST /api/auto-clipper/execute` yang menghubungkan input media, transkripsi otomatis (HTTP 202), AI Highlight, rekomendasi style, visual planning, draf narasi opsional, serta antrean render MP4 untuk mode Full Auto, Review Mode, dan Multi-Version Edit (1–3 versi).
- [x] `server/index.mjs`: perbaikan `res.sendFile(..., { root })` pada video sumber & hasil render agar bekerja aman pada direktori data apa pun (termasuk folder uji berawalan titik).
- [x] `components/AutoClipper.tsx`, `pages/index.tsx`, `styles/studio.css`: antarmuka 6-tahap Super Auto Clipper, pemilihan Full Auto vs Review Mode, editor multi-versi interaktif per highlight, dan pemantauan progres transkripsi.
- [x] Verifikasi: `npm.cmd test` (29/29 lulus), `npm.cmd run build` (berhasil), dan `node tests/auto-clipper-e2e.mjs` (integrasi lengkap unggah MP4 → Whisper → Review 2 versi → Full Auto → render MP4 H.264/AAC terdecode penuh).

## Upgrade 6 — AI Clipper Ultimate Studio

### Tahap 1 · History Management & Storage Cleanup
- [x] `server/history.mjs`, `components/HistoryManager.tsx`, `server/index.mjs`, `pages/index.tsx`: daftar riwayat lengkap, detail ukuran per pekerjaan, ringkasan total storage, filter tanggal/status/sumber, pencarian, single/bulk/all delete dengan konfirmasi Mode A/B/C, estimasi ruang dibebaskan, pembatalan job aktif sebelum hapus, perlindungan sumber bersama & path boundary, serta sinkronisasi file sementara.
- [x] Verifikasi: `tests/history.test.mjs` (`npm.cmd test`: 31/31 lulus).

### Tahap 2 · Automatic Video Quality Control (Video QC Engine)
- [x] `server/qc.mjs`, `server/film.mjs`, `workers/render-job.mjs`, `server/index.mjs`, `components/HistoryManager.tsx`: pemeriksaan 12 aspek kualitas video (format/FPS/resolusi via `ffprobe`, deteksi blank/freeze & level audio via `ffmpeg`, safe area subtitle, sinkronisasi kata, framing wajah, tabrakan overlay-wajah, kecepatan transisi, kepadatan animasi, relevansi b-roll, konteks dialog, dan kejujuran klaim faktual), auto-repair terukur dengan batas percobaan (`maxAttempts = 2`), serta status `Passed`, `Needs Review`, dan `Failed`.
- [x] Verifikasi: `tests/qc.test.mjs` (`npm.cmd test`: 33/33 lulus).

### Tahap 3 · AI Video Director Engine
- [x] `server/director.mjs`, `server/content-intelligence.mjs`, `server/index.mjs`, `composition/StyleLayer.jsx`, `components/Strategy.tsx`: structured Edit Decision List (EDL) per beat (`hook`, `build-up`, `climax`, `payoff`, deteksi pergantian topik & pembicara, momen `restraint` fokus pembicara tanpa efek, `emphasisKeywords`, rekomendasi b-roll, kamera/transisi, dan audio/SFX cues).
- [x] Verifikasi: `tests/director.test.mjs` (`npm.cmd test`: 34/34 lulus).

### Tahap 4 · Advanced Editing Controls
- [x] `server/style-registry.mjs`, `server/style-timeline.mjs`, `server/film.mjs`, `server/media.mjs`, `composition/StyleLayer.jsx`, `composition/index.jsx`, `components/Look.tsx`: 7 preset intensitas (`Clean`, `Balanced`, `Cinematic`, `Highly Visual`, `Viral Dynamic`, `Documentary Rich`, `Maximum Motion`), kontrol `substyle`, `animationIntensity`, `visualDensity`, `subtitleAnimation`, `subtitleSize`, `position` (`Bawah`/`Tengah`/`Atas`), `transitionSpeed`, `brollFrequency`, `collageIntensity`, `motionDensity`, `bgmVolume`, `sfxIntensity`, `exportQuality` (`360p`/`720p`/`1080p`), `safeArea` (`universal`/`tiktok`/`reels`/`shorts`), dan pratinjau kanvas 9:16 instan.
- [x] Verifikasi: `tests/style-grammar.test.mjs` (`npm.cmd test`: 35/35 lulus).

### Tahap 5 · Simple Mode & Advanced Mode
- [x] `components/SimpleMode.tsx`, `pages/index.tsx`, `components/Guide.tsx`, `PANDUAN_PEMAKAIAN.md`: alur 6 langkah Simple Mode (1. Upload/YouTube → 2. Pilih tujuan: Viral, Informative, Cinematic, Documentary, Gaming, Quotes, atau Auto → 3. Jumlah & durasi klip → 4. Klik Generate → 5. Lihat preview hasil → 6. Download MP4) dilengkapi bar progres nyata, tombol retry & batalkan, serta tab pengalih langsung ke Advanced Mode.

### Tahap 6 · Smart Revision Engine
- [x] `server/revision.mjs`, `server/index.mjs` (`POST /api/job/:id/revise`), `components/HistoryManager.tsx`, `tests/revision.test.mjs`: pemrosesan instruksi revisi bahasa alami pasca-render (perbesar/perkecil subtitle, kurangi/tambah zoom, tambahkan visual relevan, buat lebih cinematic, kurangi sound effect, ubah style menjadi documentary/lainnya, dan koreksi subtitle pada timestamp tertentu) tanpa mentranskripsi ulang podcast, pelacakan versi (`parentJobId`, `versionNumber`, `changesApplied`), serta pemutar perbandingan video **Before vs After**.
- [x] Verifikasi: `tests/revision.test.mjs` (`npm.cmd test`: 36/36 lulus).

### Tahap 7 · Reliability, Performance & Quality Acceptance Test
- [x] `server/index.mjs`: auto-resume pekerjaan yang terhenti saat server mulai ulang (`status='berjalan' -> 'menunggu'`), pembersihan otomatis file sementara saat startup (`syncStorageAndCleanupTemp`), dan caching transkrip/segmen per job.
- [x] Verifikasi E2E: `node tests/ultimate-acceptance-e2e.mjs` lulus 11/11 tahap (Upload MP4 → Generate highlights & EDL → Render 2 style berbeda → Video QC 12 aspek → Revisi style ke Documentary & perbesar subtitle tanpa transkrip ulang → Download MP4 H.264/AAC → Single delete Mode B → Bulk delete Mode B → Delete all Mode C → File asli user di luar `DATA_DIR` tetap utuh → Database & antrean bersih).

Rincian implementasi, provider experimental, keterbatasan dan perintah pengujian tersedia di UPGRADE_PLAN.md dan HANDOFF.md.
