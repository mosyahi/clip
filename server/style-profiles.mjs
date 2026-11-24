// Distances and holds are seconds on the source timeline. Typography uses a 1080px canvas.
function profile(animation, subtitle, gap, hold, layout, tag, asset, typography, transition, cut, sound, example, visualTreatment) {
  return {
    animationGrammar: animation, subtitleGrammar: subtitle,
    pacingRules: {hold}, sceneDensityRules: {minGap: gap},
    overlayVocabulary: {layout, tag}, assetBehavior: asset, typographyBehavior: typography,
    transitionGrammar: transition, cutRhythm: cut, soundCueHints: sound, example,
    visualTreatment
  };
}
function treatment(filter, vignette, backdrop, frameStyle, cameraMotion, captionEffect) {
  return { filter, vignette, backdrop, frameStyle, cameraMotion, captionEffect };
}
export const profiles = {
 quotes:profile("larut","frasa",10,4,"kutipan","Renungan","bingkai","serif miring","larut","akhir kalimat","hening","Monolog tentang menerima kegagalan.",
  treatment("contrast(1.06) saturate(0.82) sepia(0.18) brightness(0.94)","radial-gradient(circle at 50% 42%, transparent 45%, rgba(16,12,8,0.62) 100%)","linear-gradient(180deg, rgba(22,18,12,0.48) 0%, transparent 25%, transparent 58%, rgba(14,10,6,0.72) 100%)","cinema-quote","slow-drift","archival-fade")),
 podcast:profile("diam","karaoke",8,2,"mikrofon","Percakapan","sisipan","tebal natural","potong","pergantian ide","room tone","Obrolan dua pendiri tentang pelanggan pertama.",
  treatment("contrast(1.04) saturate(1.05) brightness(1.0)","radial-gradient(circle at 50% 45%, transparent 56%, rgba(8,14,12,0.45) 100%)","linear-gradient(180deg, transparent 55%, rgba(6,12,10,0.58) 100%)","studio-badge","still","karaoke-glow")),
 game:profile("sentak","blok",3,1.6,"hud","Checkpoint","layar","kapital padat","usap","aksen kata","klik digital","Analisis keputusan terakhir dalam pertandingan.",
  treatment("contrast(1.16) saturate(1.28) brightness(1.02)","radial-gradient(circle at 50% 50%, transparent 48%, rgba(4,20,28,0.62) 100%)","linear-gradient(180deg, rgba(0,22,28,0.42) 0%, transparent 22%, transparent 60%, rgba(2,14,22,0.72) 100%)","cyber-hud","beat-punch","block-pop")),
 konspirasi:profile("tempel","tinta",7,3,"catatan","Catatan","bingkai","mesin tik","buka","bukti baru","gesekan kertas","Menelusuri asal sebuah rumor dan sumbernya.",
  treatment("contrast(1.22) saturate(0.62) sepia(0.24) brightness(0.86)","radial-gradient(circle at 50% 45%, transparent 34%, rgba(18,6,6,0.82) 100%)","linear-gradient(180deg, rgba(24,8,8,0.55) 0%, transparent 30%, rgba(14,6,6,0.78) 100%)","red-thread","creep-zoom","type-stamp")),
 politik:profile("geser","baris",7,3,"rubrik","Kebijakan","sisipan","judul tebal","usap","pergantian isu","ketuk ringan","Penjelasan perubahan anggaran kota.",
  treatment("contrast(1.1) saturate(0.92) brightness(0.98)","radial-gradient(circle at 50% 45%, transparent 52%, rgba(10,16,28,0.58) 100%)","linear-gradient(180deg, rgba(12,20,36,0.45) 0%, transparent 25%, rgba(8,14,26,0.74) 100%)","civic-ticker","editorial-pan","ticker-slide")),
 dokumenter:profile("naik","frasa",9,4,"arsip","Konteks","bingkai","serif editorial","larut","akhir kalimat","ambience lokasi","Sejarawan menjelaskan sebuah arsip foto.",
  treatment("contrast(1.12) saturate(0.75) sepia(0.14) brightness(0.95)","radial-gradient(circle at 50% 48%, transparent 46%, rgba(8,12,10,0.66) 100%)","linear-gradient(180deg, rgba(10,14,12,0.52) 0%, transparent 22%, transparent 62%, rgba(8,12,10,0.72) 100%)","archival-film","slow-drift","rise")),
 motivasi:profile("angkat","blok",4,2,"manifesto","Dorongan","layar","kapital tebal","potong","aksen kata","dentum rendah","Pidato tentang memulai latihan kembali.",
  treatment("contrast(1.18) saturate(1.18) brightness(0.96)","radial-gradient(circle at 50% 44%, transparent 40%, rgba(18,12,4,0.72) 100%)","linear-gradient(180deg, rgba(20,12,0,0.35) 0%, transparent 28%, rgba(10,8,4,0.76) 100%)","bold-spotlight","dramatic-snap","impact-bounce")),
 finance:profile("naik","angka",6,3,"neraca","Rincian","sisipan","angka tabular","buka","data baru","klik lembut","Perbandingan bunga tetap dan mengambang.",
  treatment("contrast(1.08) saturate(0.96) brightness(0.99)","radial-gradient(circle at 50% 45%, transparent 54%, rgba(6,18,14,0.55) 100%)","linear-gradient(180deg, rgba(6,22,16,0.4) 0%, transparent 25%, rgba(6,16,12,0.7) 100%)","ledger-grid","step-push","tabular-flash")),
 debat:profile("geser","karaoke",4,2,"argumen","Argumen","sisipan","tebal natural","potong","pergantian ide","hening","Dua pendapat mengenai subsidi angkutan.",
  treatment("contrast(1.14) saturate(1.08) brightness(0.98)","radial-gradient(circle at 50% 45%, transparent 48%, rgba(24,10,10,0.6) 100%)","linear-gradient(180deg, rgba(22,12,14,0.44) 0%, transparent 25%, rgba(16,8,10,0.72) 100%)","split-versus","beat-punch","highlight-sweep")),
 berita:profile("sentak","baris",3,2,"kilat","Laporan","layar","kapital padat","usap","pergantian isu","sting singkat","Ringkasan perkembangan peristiwa hari ini.",
  treatment("contrast(1.12) saturate(1.06) brightness(1.0)","radial-gradient(circle at 50% 45%, transparent 55%, rgba(28,8,12,0.52) 100%)","linear-gradient(180deg, rgba(60,8,18,0.48) 0%, transparent 20%, rgba(18,6,10,0.75) 100%)","breaking-banner","dramatic-snap","news-flash")),
 wawancara:profile("larut","frasa",8,3.5,"bab","Cerita","bingkai","serif miring","larut","akhir kalimat","ambience lokasi","Cerita seorang perantau tentang perjalanan pulang.",
  treatment("contrast(1.04) saturate(0.94) sepia(0.08) brightness(0.98)","radial-gradient(circle at 50% 46%, transparent 50%, rgba(16,10,20,0.56) 100%)","linear-gradient(180deg, rgba(16,12,22,0.34) 0%, transparent 26%, rgba(12,8,18,0.68) 100%)","story-chapter","slow-drift","ink-reveal")),
 tutorial:profile("geser","tinta",5,3,"langkah","Langkah","sisipan","tebal natural","buka","langkah baru","klik konfirmasi","Demonstrasi mengganti filter kamera.",
  treatment("contrast(1.05) saturate(1.04) brightness(1.03)","radial-gradient(circle at 50% 46%, transparent 58%, rgba(8,18,26,0.44) 100%)","linear-gradient(180deg, rgba(8,20,28,0.38) 0%, transparent 22%, rgba(8,16,22,0.64) 100%)","step-guide","step-push","step-underline")),
 newsroom:profile("geser","baris",5,2.8,"desk","Desk berita","sisipan","judul tebal","usap","pergantian isu","sting bulletin","Presenter mengantar laporan koresponden dari lapangan.",
  treatment("contrast(1.09) saturate(0.98) brightness(1.01)","radial-gradient(circle at 50% 46%, transparent 54%, rgba(8,18,36,0.55) 100%)","linear-gradient(180deg, rgba(10,26,48,0.52) 0%, transparent 22%, rgba(8,18,34,0.74) 100%)","broadcast-desk","editorial-pan","desk-bar")),
 horror:profile("larut","muncul",10,4,"bayangan","Cerita malam","layar","serif renggang","larut","akhir kalimat","dengung rendah","Cerita fiksi tentang langkah kaki di lorong kosong.",
  treatment("contrast(1.28) saturate(0.45) brightness(0.78) hue-rotate(-8deg)","radial-gradient(circle at 50% 44%, transparent 26%, rgba(4,2,6,0.92) 100%)","linear-gradient(180deg, rgba(6,2,8,0.72) 0%, transparent 32%, rgba(4,2,6,0.88) 100%)","shadow-veil","creep-zoom","ghost-fade")),
 luxury:profile("naik","frasa",12,4.5,"galeri","Detail","bingkai","serif renggang","larut","akhir kalimat","nada kaca","Detail pengerjaan dial jam tangan mekanis.",
  treatment("contrast(1.08) saturate(0.88) sepia(0.12) brightness(0.96)","radial-gradient(circle at 50% 45%, transparent 46%, rgba(14,11,8,0.68) 100%)","linear-gradient(180deg, rgba(18,14,10,0.48) 0%, transparent 24%, transparent 62%, rgba(12,9,6,0.74) 100%)","gold-atelier","slow-drift","gold-shimmer")),
 meme:profile("sentak","blok",2,1.2,"stiker","Reaksi","layar","kapital tebal","potong","aksen kata","pop pendek","Reaksi spontan setelah salah menjawab kuis.",
  treatment("contrast(1.2) saturate(1.36) brightness(1.04)","radial-gradient(circle at 50% 50%, transparent 58%, rgba(12,12,4,0.48) 100%)","linear-gradient(180deg, transparent 60%, rgba(12,12,8,0.65) 100%)","comic-sticker","handheld-jitter","meme-shake")),
 dakwah:profile("diam","frasa",11,4.2,"renungan","Renungan","bingkai","serif editorial","larut","akhir kalimat","hening","Pengajian tentang menjaga lisan saat berbeda pendapat.",
  treatment("contrast(1.03) saturate(0.9) sepia(0.08) brightness(0.98)","radial-gradient(circle at 50% 45%, transparent 48%, rgba(8,24,20,0.62) 100%)","linear-gradient(180deg, rgba(10,32,26,0.46) 0%, transparent 24%, transparent 62%, rgba(8,24,20,0.7) 100%)","islamic-arch","still","calm-glow")),
 explainer:profile("angkat","tinta",4,2.8,"papan","Konsep","sisipan","judul tebal","buka","langkah baru","nada penanda","Guru menerangkan bagaimana uap membentuk awan.",
  treatment("contrast(1.06) saturate(1.08) brightness(1.02)","radial-gradient(circle at 50% 46%, transparent 56%, rgba(8,22,28,0.46) 100%)","linear-gradient(180deg, rgba(10,26,34,0.4) 0%, transparent 24%, rgba(8,20,26,0.68) 100%)","concept-board","step-push","board-underline")),
 street:profile("tempel","karaoke",3.5,2,"vox","Suara jalan","sisipan","tebal natural","potong","pergantian ide","suasana jalan","Jawaban warga mengenai ongkos transportasi.",
  treatment("contrast(1.14) saturate(1.14) brightness(1.0)","radial-gradient(circle at 50% 48%, transparent 50%, rgba(20,14,8,0.56) 100%)","linear-gradient(180deg, rgba(22,16,10,0.38) 0%, transparent 24%, rgba(16,12,8,0.68) 100%)","vox-tag","handheld-jitter","street-pop")),
 market:profile("geser","angka",3,2.4,"terminal","Pasar","sisipan","angka tabular","usap","data baru","tick pendek","Ulasan pergerakan indeks setelah pengumuman suku bunga.",
  treatment("contrast(1.1) saturate(0.94) brightness(0.96)","radial-gradient(circle at 50% 46%, transparent 50%, rgba(4,18,16,0.64) 100%)","linear-gradient(180deg, rgba(4,22,18,0.56) 0%, transparent 22%, rgba(4,16,14,0.76) 100%)","market-terminal","editorial-pan","terminal-pulse")),
 tech:profile("buka","angka",5,2.6,"spesifikasi","Spesifikasi","bingkai","mesin tik","buka","data baru","klik antarmuka","Uji daya tahan baterai dua ponsel.",
  treatment("contrast(1.1) saturate(1.08) brightness(0.99) hue-rotate(4deg)","radial-gradient(circle at 50% 46%, transparent 50%, rgba(10,12,28,0.6) 100%)","linear-gradient(180deg, rgba(14,16,34,0.48) 0%, transparent 22%, rgba(10,12,26,0.74) 100%)","spec-blueprint","step-push","tech-scan")),
 crime:profile("buka","muncul",8,3.8,"berkas","Kronologi","bingkai","mesin tik","buka","bukti baru","lembar berkas","Kronologi perkara dari dokumen pengadilan.",
  treatment("contrast(1.22) saturate(0.55) sepia(0.22) brightness(0.88)","radial-gradient(circle at 50% 45%, transparent 38%, rgba(14,12,10,0.78) 100%)","linear-gradient(180deg, rgba(18,16,12,0.56) 0%, transparent 26%, rgba(12,10,8,0.8) 100%)","case-dossier","creep-zoom","dossier-type"))
};
