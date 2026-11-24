# AI Clipper Studio
Studio lokal memakai Next Pages dan React untuk editor, Express untuk API dan SQLite untuk sumber, transkrip, aset dan antrean. Multer menerima video, yt-dlp menangani tautan, FFprobe membaca metadata. Worker Python menjalankan Whisper dan pelacakan wajah. Pemilihan highlight memakai batas ujaran, deduplikasi dan LLM opsional. Worker render menyiapkan media dengan FFmpeg lalu menjalankan komposisi Remotion. Wikimedia dan aset unggahan mendukung ilustrasi.
 
## Urutan integrasi
1. Analisis transkrip per rentang dan simpan keputusan bersama snapshot pekerjaan.
2. Hubungkan registry gaya dengan rekomendasi, editor, caption dan komposisi.
3. Gunakan timing ujaran untuk merencanakan callout serta usulan aset. Pertahankan atribusi penyedia dan pilihan pengguna.
4. Tambahkan narasi opsional dan fallback audio asli. Kloning memerlukan provider serta persetujuan pemilik suara.
5. Uji rangkaian impor, transkripsi, pemilihan klip, fallback dan render setiap gaya dalam folder data terpisah.

## Risiko dan dependensi
Analisis berbasis kata dapat keliru untuk sarkasme atau bahasa campuran. Provider eksternal bergantung pada jaringan. Render Chromium dan transkripsi CPU membatasi paralelisme. Antrean SQLite saat ini cocok untuk satu proses pemilik. Deployment multi-host membutuhkan penyimpanan media bersama dan antrean terdistribusi. Tahap lokal memakai dependensi proyek yang tersedia.

## Status implementasi dan pengujian

| Area | Status | Verifikasi atau batasan |
| --- | --- | --- |
| Impor, antrean, riwayat | Aktif | Impor YouTube hingga 100%, unggah MP4 dan riwayat di Edge. Build produksi memakai folder per versi. |
| Strategi dan rekomendasi | Aktif (Lokal + LLM Opsional) | Analisis lokal per rentang, skor retensi/hook/punchline/emosi, anti-kalimat terputus, anti-duplikat ketat, auto-discovery Ollama lokal + fallback lokal. |
| Gaya dan render | Aktif | 22 preset `Clipper *` + 3 built-in dengan `visualTreatment` unik (grading, frame, camera motion, animasi kata kinetik, pembedaan klaim vs fakta) beserta preview MP4/JPG. |
| Aset & Visual Research | Aktif (Lokal + Wikimedia/Stok) | Klasifikasi 5 tipe visual (`grafik`, `motion`, `foto`, `ilustrasi`, `b-roll`), render grafik/motion ke MP4, pencocokan aset lokal, dan atribusi Wikimedia PD/CC0/CC BY/CC BY-SA. |
| Voice Studio | Aktif (TTS Lokal) + Kloning Berizin | 6 preset narator lokal (`System.Speech`), kontrol kecepatan/volume/ducking, sinkronisasi offset, preview WAV lokal, dan validasi izin eksplisit + pencabutan sampel kloning. |
| Super Auto Clipper | Aktif | Pipeline end-to-end (`POST /api/auto-clipper/plan` & `/execute`) dengan Full Auto, Review Mode, dan Multi-Version Edit (1–3 versi). |
| Analisis lanjutan | Unavailable | Diarisasi multi-pembicara, perpindahan pembicara berbasis identitas, peta geografis aktual, efek suara adaptif dan evaluasi editorial oleh penilai manusia masih terbuka. |

Jalankan `npm.cmd test` untuk unit dan kontrak. Jalankan `node tests/strategy-studio.mjs` untuk unggah, Whisper, rencana dan batch dengan data terisolasi. Jalankan `node tests/style-render.mjs` untuk semua preset dengan fixture lokal di data/bukti. Konfigurasi provider dan kontrak HTTP ada di .env.example. Pengujian integrasi eksternal lanjutan memerlukan endpoint nyata dan sampel yang berizin.
