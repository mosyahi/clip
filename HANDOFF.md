# HANDOFF.md — Podcast AI Editor / AI Auto Clipper

Dokumen catatan kelanjutan lintas AI agent (OpenAI Codex → Antigravity).

## 1. Aset & Database Existing yang Dipertahankan
- `data/studio.sqlite`: berisi 15 sumber video (podcast/video uji dan hasil impor) serta 50 riwayat pekerjaan render (44 selesai, 6 dibatalkan) dan 9 transkrip selesai.
- `data/*.source`, `data/*.json`, `data/*.srt`, `data/*.mp4`, `data/*.mp4.assets.json`, dan `data/bukti/`: seluruh media asli, transkrip, hasil render, dan fixture pengujian dipertahankan tanpa reset.
- Aturan penguncian: hanya satu server studio yang boleh mengunci `data/studio.lock.sqlite`; pengujian server terisolasi wajib memakai direktori temporer `.cache/...`.

## 2. Audit Status & Progres Modul

| Modul | Status Saat Ini | Ringkasan Implementasi & Bukti |
| --- | --- | --- |
| **Modul 1 — Advanced Style Engine** | **Selesai** | 22 preset `Clipper *` + 3 built-in memiliki `visualTreatment` unik (`filter`, `vignette`, `backdrop`, `frameStyle`, `cameraMotion`, `captionEffect`), motion lengkap (`larut`/`diam`/`buka`/`sentak`/dll.), animasi kata subtitle dinamis, layout `bingkai`/`sisipan`/`layar`, validasi 5 font + sinkronisasi UI, dan pembedaan badge **KLAIM / OPINI** vs **DATA / RUJUKAN** pada `politik`/`konspirasi`. Teruji 21/21 unit test, render preview 25 gaya (`public/style-previews`), dan `node tests/style-render.mjs` (22 MP4 video uji nyata). |
| **Modul 2 — Smart Highlight Intelligence** | **Selesai** | Anti-kalimat terputus (`DANGLING_START`/`TRAILING_END`), ekstraksi `hook` & `punchline`, skor terstruktur (`hookScore`, `punchlineScore`, `emotionScore`, `contextScore`, `retentionScore`, `retentionLevel`, `emotion`), deduplikasi ketat (token `<= 0.50` & bigram `<= 0.35`), auto-discovery LLM lokal Ollama (`detectLocalLLM`), dan UI `Analysis.tsx` + tombol `Buka & pakai gaya`. Teruji 23/23 unit test dan data transkrip nyata `data/49d708e1-c549-470a-871f-23bce19be50b.json`. |
| **Modul 3 — Smart Visual Research** | **Selesai** | Klasifikasi 5 tipe visual (`grafik`, `motion`, `foto`, `ilustrasi`, `b-roll`), `chartData`/`motionData` di `style-timeline.mjs`, perluasan `objects` & dukungan lisensi `CC BY`/`CC BY-SA` beratribusi di `documentary.mjs`, pencocokan aset lokal & pencatatan lengkap ke `.mp4.assets.json` di `film.mjs`, render visual grafik/motion & atribusi sumber di `StyleLayer.jsx`/`index.jsx`, serta UI `Strategy.tsx`/`References.tsx`. Teruji 25/25 unit test + render nyata grafik & CC BY-SA Wikimedia (`mod3.mp4`). |
| **Modul 4 — Voice Studio** | **Selesai** | 6 preset narator lokal (`Natural`, `Tenang`, `Energik`, `Dokumenter`, `Berita`, `Storyteller`), kontrol kecepatan/volume/ducking, sinkronisasi offset (`intro`/`hook`/`scene`/`custom`) dengan `<Sequence>` & audio ducking di Remotion, `POST /api/voice/preview` untuk preview suara lokal, serta validasi izin eksplisit + anti-peniruan + pencabutan sampel (`DELETE /api/source/:id/voice`). Teruji 27/27 unit test (termasuk sintesis TTS Windows) + render MP4 `mod4.mp4` (`h264`/`aac`). |
| **Modul 5 — Super Auto Clipper** | **Selesai** | Pipeline end-to-end (`server/auto-clipper.mjs`, `server/transcript.mjs`, `server/index.mjs`, `components/AutoClipper.tsx`, `pages/index.tsx`): Input MP4/YouTube → Transkripsi otomatis (HTTP 202 + polling) → AI Highlight → Rekomendasi Style & Multi-Version Edit (1–3 versi per klip) → Visual Planning → Editing & Render MP4 dengan mode Full Auto dan Review Mode. Teruji 29/29 unit test (`tests/auto-clipper.test.mjs`), build produksi (`npm.cmd run build`), dan E2E render MP4 nyata (`node tests/auto-clipper-e2e.mjs`). |
| **Upgrade 6 — AI Clipper Ultimate Studio** | **Selesai** | 1) History Management & Storage Cleanup (Mode A/B/C, pencarian/filter, single/bulk/all delete, estimasi byte, active-job cancel, path boundary). 2) Automatic Video QC 12 Aspek (`server/qc.mjs`, auto-repair `maxAttempts = 2`, `Passed` / `Needs Review` / `Failed`). 3) AI Video Director Engine (`server/director.mjs`, EDL bertimestamp, hook/build-up/climax/payoff, momen restraint tanpa efek, keyword emphasis). 4) Advanced Editing Controls (7 preset, substyle, visual density, safe area TikTok/Reels/Shorts, live preview 9:16). 5) Simple Mode 6-Langkah (`components/SimpleMode.tsx`) & Advanced Mode. 6) Smart Revision Engine (`server/revision.mjs`, revisi bahasa alami & subtitle tanpa transkrip ulang, Before/After comparison). 7) Reliability & 11-Step Quality Acceptance E2E (`tests/ultimate-acceptance-e2e.mjs`). |

## 3. Log Perubahan per Modul

- **[TAHAP 0]** Audit codebase & database `data/studio.sqlite` selesai (`npm.cmd test`: 20/20 lulus).
- **[MODUL 1 · Selesai]**
  - File diubah: `server/style-profiles.mjs`, `server/style-timeline.mjs`, `composition/StyleLayer.jsx`, `composition/index.jsx`, `server/index.mjs`, `components/Look.tsx`, `tests/style-grammar.test.mjs`, `public/style-previews/*`.
  - Pengujian lulus: `npm.cmd test` (21/21 lulus), `node scripts/render-style-previews.mjs` (25 preset valid & terdecode), `node tests/style-render.mjs` (22 preset dirender ke MP4 nyata dari `data/bukti/ujaran-indonesia.mp4`), pemeriksaan visual frame `quotes.jpg`, `game.jpg`, `konspirasi.jpg`, `politik.jpg`, `horror.jpg`, `meme.jpg`.
  - Pekerjaan tersisa: lanjut ke **Modul 2 — Smart Highlight Intelligence**.
- **[MODUL 2 · Selesai]**
  - File diubah: `server/content-intelligence.mjs`, `server/highlights.mjs`, `server/index.mjs`, `components/Analysis.tsx`, `pages/index.tsx`, `tests/analysis.test.mjs`, `tests/provider.test.mjs`.
  - Pengujian lulus: `npm.cmd test` (23/23 lulus) dan uji `recommend()` pada transkrip nyata `data/49d708e1-c549-470a-871f-23bce19be50b.json` (3 klip tuntas tanpa tumpang tindih dengan hook, punchline, emosi, retentionScore, dan style rekomendasi).
  - Pekerjaan tersisa: lanjut ke **Modul 3 — Smart Visual Research**.
- **[MODUL 3 · Selesai]**
  - File diubah: `server/style-timeline.mjs`, `server/content-intelligence.mjs`, `server/documentary.mjs`, `server/film.mjs`, `server/index.mjs`, `composition/StyleLayer.jsx`, `composition/index.jsx`, `components/Strategy.tsx`, `components/References.tsx`, `tests/documentary.test.mjs`, `tests/strategy.test.mjs`.
  - Pengujian lulus: `npm.cmd test` (25/25 lulus), render MP4 nyata pada `data/bukti/ujaran-indonesia.mp4` dengan `Clipper Finance` (`45%` grafik progress bar + CC BY-SA 3.0 Wikimedia Commons + `.mp4.assets.json` lengkap) dan verifikasi visual frame.
  - Pekerjaan tersisa: lanjut ke **Modul 4 — Voice Studio**.
- **[MODUL 4 · Selesai]**
  - File diubah: `workers/narrate.ps1`, `server/voice.mjs`, `server/voice-studio.mjs`, `server/film.mjs`, `server/index.mjs`, `composition/index.jsx`, `components/VoiceSample.tsx`, `components/Look.tsx`, `tests/voice-provider.test.mjs`.
  - Pengujian lulus: `npm.cmd test` (27/27 lulus, termasuk sintesis WAV Windows lokal & validasi izin eksplisit) dan render MP4 nyata dengan narasi `Dokumenter` tersinkronisasi ke `hook` (`h264`/`aac`).
  - Pekerjaan tersisa: lanjut ke **Modul 5 — Super Auto Clipper**.
- **[MODUL 5 · Selesai]**
  - File diubah/ditambah: `server/auto-clipper.mjs`, `server/transcript.mjs`, `server/index.mjs`, `components/AutoClipper.tsx`, `pages/index.tsx`, `styles/studio.css`, `tests/auto-clipper.test.mjs`, `tests/auto-clipper-e2e.mjs`.
  - Pengujian lulus: `npm.cmd test` (29/29 lulus), `npm.cmd run build` (TypeScript + Next.js production build lulus), dan `node tests/auto-clipper-e2e.mjs` (Upload MP4 → Whisper → Review Multi-Version 2 MP4 + ffprobe H.264/AAC & decode penuh + Full Auto queue).
  - Pekerjaan tersisa: seluruh Modul 1–5 selesai dan terverifikasi; database `data/studio.sqlite` & aset sumber dipertahankan utuh.
- **[UPGRADE 6 · Tahap 1: History Management & Storage Cleanup · Selesai]**
  - File diubah/ditambah: `server/history.mjs`, `components/HistoryManager.tsx`, `server/index.mjs`, `pages/index.tsx`, `tests/history.test.mjs`.
  - Fitur: filter tanggal/status/sumber, pencarian, single/bulk/all delete, konfirmasi permanen dengan Mode A (catatan saja), Mode B (riwayat + file render/cache job), Mode C (termasuk video sumber terkelola bila tidak dipakai job lain), estimasi byte dibebaskan, pembatalan active job sebelum hapus, proteksi boundary path, dan sinkronisasi file sementara.
  - Verifikasi: `npm.cmd test` (31/31 lulus).
  - Pekerjaan tersisa: lanjut ke **Tahap 2: Automatic Video Quality Control (Video QC Engine)**.
- **[UPGRADE 6 · Tahap 2: Automatic Video Quality Control · Selesai]**
  - File diubah/ditambah: `server/qc.mjs`, `server/film.mjs`, `workers/render-job.mjs`, `server/index.mjs`, `components/HistoryManager.tsx`, `tests/qc.test.mjs`.
  - Fitur: validasi & auto-repair timeline pra-render (safe area font, tabrakan wajah vs subtitle, stabilisasi koordinat wajah, ritme transisi & zoom dengan batas `maxAttempts = 2`) serta 12-point QC pasca-render dengan FFprobe/FFmpeg (`blackdetect`, `freezedetect`, `volumedetect`, auto-repair normalisasi audio, dan status jujur `Passed` / `Needs Review` / `Failed`).
  - Verifikasi: `npm.cmd test` (33/33 lulus).
  - Pekerjaan tersisa: lanjut ke **Tahap 3: AI Video Director Engine**.
- **[UPGRADE 6 · Tahap 3: AI Video Director Engine · Selesai]**
  - File diubah/ditambah: `server/director.mjs`, `server/content-intelligence.mjs`, `server/index.mjs`, `composition/StyleLayer.jsx`, `components/Strategy.tsx`, `tests/director.test.mjs`.
  - Fitur: analisis fase naratif (`hook`, `build-up`, `climax`, `payoff`), deteksi pergantian topik & giliran bicara, penentuan momen tanpa efek (`restraint: true` / `speaker-focus-clean`), `emphasisKeywords` pada subtitle Remotion, rekomendasi b-roll/grafik, kamera/transisi, serta audio mixing & SFX cues dalam structured Edit Decision List (EDL).
  - Verifikasi: `npm.cmd test` (34/34 lulus).
  - Pekerjaan tersisa: lanjut ke **Tahap 4: Advanced Editing Controls**.
- **[UPGRADE 6 · Tahap 4: Advanced Editing Controls · Selesai]**
  - File diubah/ditambah: `server/style-registry.mjs`, `server/style-timeline.mjs`, `server/film.mjs`, `server/media.mjs`, `server/qc.mjs`, `server/index.mjs`, `composition/StyleLayer.jsx`, `composition/index.jsx`, `components/Look.tsx`, `tests/style-grammar.test.mjs`.
  - Fitur: 7 preset kontrol editing (`Clean`, `Balanced`, `Cinematic`, `Highly Visual`, `Viral Dynamic`, `Documentary Rich`, `Maximum Motion`), substyle (`Default`, `Minimal`, `Bold`, `Editorial`, `Neon`), intensitas animasi, kepadatan visual (`visualDensity`), gaya animasi subtitle, ukuran/posisi/font/warna subtitle, kecepatan transisi, frekuensi b-roll, intensitas kolase, kepadatan motion graphics, BGM volume & SFX intensity, kualitas ekspor (`360p`/`720p`/`1080p`), safe area (`Universal`/`TikTok`/`Reels`/`Shorts`), dan live preview box 9:16 instan.
  - Verifikasi: `npm.cmd test` (35/35 lulus).
  - Pekerjaan tersisa: lanjut ke **Tahap 5: Simple Mode & Advanced Mode** serta **Tahap 6: Smart Revision Engine**.
- **[UPGRADE 6 · Tahap 5: Simple Mode & Advanced Mode · Selesai]**
  - File diubah/ditambah: `components/SimpleMode.tsx`, `pages/index.tsx`, `components/Guide.tsx`, `PANDUAN_PEMAKAIAN.md`.
  - Fitur: Simple Mode 6-Langkah (1. Upload/YouTube → 2. Pilih tujuan: Viral/Informative/Cinematic/Documentary/Gaming/Quotes/Auto → 3. Jumlah & durasi klip → 4. Generate → 5. Preview hasil → 6. Download MP4) dengan status progres nyata, tombol retry, dan tombol batal, berdampingan dengan Advanced Mode penuh.
- **[UPGRADE 6 · Tahap 6: Smart Revision Engine · Selesai]**
  - File diubah/ditambah: `server/revision.mjs`, `server/index.mjs` (`POST /api/job/:id/revise`), `components/HistoryManager.tsx`, `tests/revision.test.mjs`.
  - Fitur: revisi pasca-render berbasis instruksi bahasa alami (perbesar/perkecil subtitle, kurangi/tambah zoom, tambahkan visual relevan, buat lebih cinematic, kurangi sound effect, ubah style mis. documentary, koreksi subtitle pada timestamp tertentu) tanpa mentranskripsi ulang podcast, menyimpan `parentJobId` & `versionNumber`, serta menampilkan pemutar perbandingan **Before vs After** berdampingan.
  - Verifikasi: `npm.cmd test` (36/36 lulus).
- **[UPGRADE 6 · Tahap 7: Reliability, Performance & Quality Acceptance Test · Selesai]**
  - File diubah/ditambah: `server/index.mjs`, `tests/ultimate-acceptance-e2e.mjs`.
  - Fitur: auto-resume pekerjaan yang terhenti saat startup server (`status='berjalan' -> 'menunggu'` + `drain()`), pembersihan otomatis file sementara saat startup (`syncStorageAndCleanupTemp`), caching transkrip & segmen per job, serta pengujian penerimaan E2E 11 tahap (`tests/ultimate-acceptance-e2e.mjs`).
