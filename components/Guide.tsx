import { useState } from "react";

const sections = [
  {
    id: "cepat",
    title: "1. Mulai Cepat (3 Langkah)",
    items: [
      "① Masukkan Video: Klik tombol '＋ Impor video' di kanan atas (atau seret file MP4/MOV ke monitor), atau buka panel 'Impor dari YouTube' untuk mengunduh tautan YouTube berizin.",
      "② Pilih Cara Edit: Gunakan 'Super Auto Clipper' di bawah untuk mencari highlight & memilih gaya otomatis (6-Tahap), ATAU gunakan panel 'Pengaturan klip' di sebelah kanan untuk potong manual.",
      "③ Render & Unduh: Klik 'Render preview 360p' untuk cek hasil cepat, atau 'Render MP4' untuk kualitas final 1080×1920 (30 fps), lalu klik 'Putar' atau 'Unduh MP4 ↓' di panel Antrean.",
    ],
  },
  {
    id: "auto",
    title: "2. ⚡ Super Auto Clipper (Step 1 → 6)",
    items: [
      "Mode Review Step-by-Step: Klik 'Susun Rencana Auto Clipper (Mulai Tahap 1 → 6)'. Sistem akan memandu Anda meninjau: Tahap 2 (Transkripsi) → Tahap 3 (Pilih/Edit Highlight, Hook & Punchline) → Tahap 4 (Pilih 1–3 Versi Gaya per Klip) → Tahap 5 (Cek Visual Grafik/Motion/Foto & Narasi Suara) → Tahap 6 (Render MP4).",
      "Mode Full Auto: Ubah Mode eksekusi ke 'Full Auto (Langsung Render MP4)' lalu klik tombol jalankan. Sistem otomatis mentranskripsi (bila belum ada), mencari highlight, menerapkan gaya & visual, dan langsung memasukkan semua klip ke antrean render.",
      "Multi-Versi Edit: Pilih '2 Versi' atau '3 Versi Edit Berbeda' agar satu momen highlight otomatis dibuatkan beberapa variasi gaya (misal Versi 1 Podcast, Versi 2 Quotes, Versi 3 Documentary).",
    ],
  },
  {
    id: "voice",
    title: "3. 🎙️ Voice Studio & Downloads/test.wav",
    items: [
      "Suara Bahasa Indonesia Jelas: Buka menu 'Voice Studio · Suara Bahasa Indonesia & Kemiripan WAV' di panel kanan. Ketik teks Bahasa Indonesia, pilih satu dari 6 preset narator (Ardi/Gadis Neural), atur kecepatan & waktu muncul suara, lalu klik '🔊 Dengarkan preview suara'.",
      "Cara Pakai Kemiripan Downloads/test.wav: (1) Isi 'Nama pemilik suara' dan centang 2 kotak pernyataan izin. (2) Klik tombol '⚡ 2. Pakai Langsung Downloads/test.wav' (atau pilih file WAV lain). (3) Sistem otomatis membaca nada dasar (150.9 Hz · Tenor/Natural) dan mengaktifkan '3. Aktifkan kemiripan suara sampel ini'.",
      "Sinkronisasi & Audio Ducking: Pilih apakah voice-over masuk di awal video (0 dtk), saat kalimat pertama mulai, saat scene pertama, atau detik khusus. Volume suara video asli otomatis direndahkan secara halus selama narator berbicara.",
    ],
  },
  {
    id: "manual",
    title: "4. ✂️ Edit Manual & 25 Preset Gaya",
    items: [
      "Potong Cepat: Isi waktu 'Mulai' dan 'Selesai' (format mm:ss seperti 01:30 atau detik seperti 90), pilih 'Gaya editing', lalu langsung klik 'Render MP4' atau 'Render preview 360p'.",
      "Membandingkan 25 Gaya: Buka 'Pustaka gaya dan mode edit' → pilih gaya di 'Bandingkan preset' untuk memutar contoh video 6 detik dan melihat 10 aturan editingnya (color grading, frame HUD/cinema/berkas, animasi kata, ritme cut) → klik 'Pakai'.",
      "Buat 3 Versi Sekaligus: Klik tombol 'Buat 3 versi preview' di panel kanan untuk merender potongan waktu yang sama dalam 3 rekomendasi gaya terbaik.",
    ],
  },
  {
    id: "visual",
    title: "5. 🖼️ Visual, Klaim/Fakta & Watermark",
    items: [
      "5 Tipe Visual Otomatis: Sistem menganalisis kalimat transkrip per scene dan menampilkan Grafik Data (bar persentase, perbandingan A vs B, tahun linimasa), Motion Graphics (langkah 1/2/3, pertanyaan), Foto/Ilustrasi Wikimedia Commons (PD/CC0/CC BY/CC BY-SA beratribusi), atau B-Roll lokal.",
      "Pembeda Klaim vs Fakta: Untuk gaya Politik, Konspirasi, Debat, dan True Crime, kalimat spekulatif otomatis diberi penanda 'KLAIM / OPINI · BELUM TERVERIFIKASI' dan data terukur diberi penanda 'DATA / RUJUKAN' tanpa membuat bukti palsu.",
      "B-Roll Lokal & Watermark: Buka 'Tampilan dan gerak' untuk mengunggah foto b-roll Anda sendiri (maks. 3 foto aktif), dan buka 'Kredit sumber dan watermark' untuk memasang kredit kanal serta watermark di 6 pilihan posisi.",
    ],
  },
  {
    id: "ultimate",
    title: "6. ✨ Simple Mode, Revisi, QC & Riwayat",
    items: [
      "Simple Mode vs Advanced Mode: Klik tab '✨ Simple Mode (1-Klik Cepat)' untuk alur 6 langkah cepat (Unggah/YouTube → Pilih Tujuan → Jumlah & Durasi → Generate → Preview → Download MP4), atau klik '🎛️ Advanced Mode' untuk seluruh kontrol studio, EDL Sutradara AI, dan 7 preset kontrol editing.",
      "QC Video 12 Aspek & Smart Revision Engine: Klik '🔍 Detail' pada pekerjaan yang selesai untuk melihat laporan Automatic Video QC (Passed / Needs Review / Failed) dan mengetik perintah revisi cepat (misal 'Perbesar subtitle', 'Kurangi zoom', 'Ubah style menjadi documentary', atau koreksi subtitle pada timestamp tertentu) tanpa mentranskripsi ulang podcast, lengkap dengan perbandingan Before vs After.",
      "Manajemen Riwayat & Pembersihan Penyimpanan: Gunakan pencarian, filter tanggal/status/sumber, pilih banyak (multi-select), atau Hapus Semua Riwayat dengan 3 pilihan aman (Opsi A: catatan saja, Opsi B: beserta file render/cache klip, Opsi C: termasuk salinan sumber di folder aplikasi tanpa pernah menyentuh file asli Anda di komputer).",
    ],
  },
];

export function Guide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [tab, setTab] = useState("cepat");
  const active = sections.find((s) => s.id === tab) || sections[0];

  return (
    <details className="panel history guide-panel" open={defaultOpen || undefined}>
      <summary>📖 Panduan Lengkap Cara Pemakaian Studio</summary>
      <div className="body">
        <div className="pipeline-steps" role="tablist" aria-label="Kategori panduan pemakaian">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setTab(s.id)}
              className={`pipeline-step status-selesai${tab === s.id ? " step-active" : ""}`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="version-card">
          <strong>{active.title}</strong>
          {active.items.map((item, i) => (
            <p key={i} className="guide-item">
              {item}
            </p>
          ))}
        </div>
      </div>
    </details>
  );
}
