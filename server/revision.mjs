import { styles, controlPresets } from "./style-registry.mjs";
import { styleScenes } from "./style-timeline.mjs";
import { buildEditDecisionList } from "./director.mjs";
import { subtitleWords } from "./transcript.mjs";

const STYLE_ALIASES = {
  documentary: "Clipper Documentary",
  dokumenter: "Clipper Documentary",
  podcast: "Clipper Podcast",
  quotes: "Clipper Quotes",
  kutipan: "Clipper Quotes",
  game: "Clipper Game",
  gaming: "Clipper Game",
  politik: "Clipper Politik",
  konspirasi: "Clipper Konspirasi",
  finance: "Clipper Finance",
  keuangan: "Clipper Finance",
  motivasi: "Clipper Motivation",
  motivation: "Clipper Motivation",
  berita: "Clipper Breaking News",
  news: "Clipper Breaking News",
  newsroom: "Clipper Newsroom",
  horror: "Clipper Horror Story",
  horor: "Clipper Horror Story",
  meme: "Clipper Meme Fast",
  tutorial: "Clipper Tutorial",
  luxury: "Clipper Luxury",
  debat: "Clipper Debate",
  debate: "Clipper Debate",
  wawancara: "Clipper Storytelling",
  storytelling: "Clipper Storytelling",
  dakwah: "Clipper Islamic Dakwah",
  explainer: "Clipper Edu Explainer",
  street: "Clipper Street Interview",
  market: "Clipper Finance Market",
  tech: "Clipper Tech Review",
  crime: "Clipper True Crime",
};

function parseTimestampToSeconds(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw || "").trim();
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function applyRevisionInstruction({
  instruction = "",
  subtitleEdits = [],
  settings = {},
  segments = [],
}) {
  const text = String(instruction || "").trim();
  if (!text && (!Array.isArray(subtitleEdits) || !subtitleEdits.length)) {
    throw Error("Masukkan instruksi revisi atau perubahan subtitle.");
  }

  const nextSettings = structuredClone(settings);
  const nextSegments = structuredClone(Array.isArray(segments) ? segments : []);
  const changesApplied = [];

  // 1. Ukuran & Posisi Subtitle
  if (/perbesar\s+subtitle|subtitle\s+lebih\s+besar|huruf\s+lebih\s+besar|bigger\s+subtitle/i.test(text)) {
    const baseSize = nextSettings.subtitleSize || nextSettings.style?.size || 70;
    nextSettings.subtitleSize = Math.min(90, baseSize + 10);
    if (nextSettings.style) nextSettings.style = { ...nextSettings.style, size: nextSettings.subtitleSize };
    nextSettings.customStyle = true;
    changesApplied.push(`Ukuran subtitle diperbesar menjadi ${nextSettings.subtitleSize}px.`);
  }
  if (/perkecil\s+subtitle|subtitle\s+lebih\s+kecil|huruf\s+lebih\s+kecil|smaller\s+subtitle/i.test(text)) {
    const baseSize = nextSettings.subtitleSize || nextSettings.style?.size || 70;
    nextSettings.subtitleSize = Math.max(46, baseSize - 10);
    if (nextSettings.style) nextSettings.style = { ...nextSettings.style, size: nextSettings.subtitleSize };
    nextSettings.customStyle = true;
    changesApplied.push(`Ukuran subtitle diperkecil menjadi ${nextSettings.subtitleSize}px.`);
  }
  if (/posisi\s+(?:subtitle\s+)?tengah/i.test(text)) {
    nextSettings.position = "Tengah";
    changesApplied.push("Posisi subtitle dipindahkan ke Tengah.");
  } else if (/posisi\s+(?:subtitle\s+)?atas/i.test(text)) {
    nextSettings.position = "Atas";
    changesApplied.push("Posisi subtitle dipindahkan ke Atas.");
  } else if (/posisi\s+(?:subtitle\s+)?bawah/i.test(text)) {
    nextSettings.position = "Bawah";
    changesApplied.push("Posisi subtitle dipindahkan ke Bawah.");
  }

  // 2. Zoom & Gerak Kamera
  if (/kurangi\s+zoom|zoom\s+lebih\s+(?:kecil|halus|pelan|rendah)|less\s+zoom/i.test(text)) {
    nextSettings.zoom = Math.max(0.05, Number(((nextSettings.zoom ?? 0.5) - 0.22).toFixed(2)));
    nextSettings.animationIntensity = Math.max(0.15, Number(((nextSettings.animationIntensity ?? 0.55) - 0.2).toFixed(2)));
    nextSettings.customStyle = true;
    changesApplied.push(`Intensitas zoom dikurangi ke ${Math.round(nextSettings.zoom * 100)}%.`);
  }
  if (/tambah(?:kan)?\s+zoom|perbesar\s+zoom|zoom\s+lebih\s+(?:kuat|cepat|besar)|more\s+zoom/i.test(text)) {
    nextSettings.zoom = Math.min(0.95, Number(((nextSettings.zoom ?? 0.5) + 0.22).toFixed(2)));
    nextSettings.animationIntensity = Math.min(1, Number(((nextSettings.animationIntensity ?? 0.55) + 0.2).toFixed(2)));
    nextSettings.customStyle = true;
    changesApplied.push(`Intensitas zoom ditingkatkan ke ${Math.round(nextSettings.zoom * 100)}%.`);
  }

  // 3. Visual, B-Roll & Grafik
  if (/tambah(?:kan)?\s+(?:visual|ilustrasi|b-?roll|gambar|grafik)|lebih\s+banyak\s+visual/i.test(text)) {
    nextSettings.autoIllustrate = true;
    nextSettings.visualDensity = Math.min(1, Number(((nextSettings.visualDensity ?? 0.5) + 0.3).toFixed(2)));
    nextSettings.brollFrequency = Math.min(1, Number(((nextSettings.brollFrequency ?? 0.5) + 0.35).toFixed(2)));
    nextSettings.motionDensity = Math.min(1, Number(((nextSettings.motionDensity ?? 0.5) + 0.3).toFixed(2)));
    changesApplied.push(
      `Kepadatan visual & b-roll ditingkatkan (${Math.round(nextSettings.visualDensity * 100)}%) dan riset ilustrasi diaktifkan.`,
    );
  }
  if (/kurangi\s+(?:visual|ilustrasi|b-?roll)|tanpa\s+(?:visual|ilustrasi|b-?roll)|hapus\s+visual/i.test(text)) {
    if (/tanpa|hapus/i.test(text)) {
      nextSettings.autoIllustrate = false;
      nextSettings.brollFrequency = 0;
      changesApplied.push("Ilustrasi dan b-roll tambahan dinonaktifkan.");
    } else {
      nextSettings.visualDensity = Math.max(0.1, Number(((nextSettings.visualDensity ?? 0.5) - 0.3).toFixed(2)));
      nextSettings.brollFrequency = Math.max(0.1, Number(((nextSettings.brollFrequency ?? 0.5) - 0.3).toFixed(2)));
      changesApplied.push(`Frekuensi visual & b-roll dikurangi ke ${Math.round(nextSettings.visualDensity * 100)}%.`);
    }
  }

  // 4. Cinematic / Preset Intensitas
  if (/lebih\s+cinematic|buat\s+cinematic|nuansa\s+cinematic/i.test(text)) {
    Object.assign(nextSettings, controlPresets.Cinematic);
    if (!nextSettings.style) {
      const docStyle = styles.find((s) => s.type === "dokumenter") || styles[0];
      nextSettings.preset = docStyle.name;
      nextSettings.style = docStyle;
    }
    changesApplied.push("Menerapkan profil Cinematic (transisi halus, karaoke glow, BGM lembut, safe area Reels).");
  }

  // 5. Sound Effect & BGM
  if (/kurangi\s+(?:sound\s*effect|sfx|efek\s+suara|musik|bgm)|tanpa\s+(?:sound\s*effect|sfx|musik)/i.test(text)) {
    nextSettings.sfxIntensity = /tanpa/i.test(text) ? 0 : Math.max(0, Number(((nextSettings.sfxIntensity ?? 0.25) - 0.25).toFixed(2)));
    nextSettings.bgmVolume = /tanpa/i.test(text) ? 0 : Math.max(0, Number(((nextSettings.bgmVolume ?? 0.08) - 0.06).toFixed(2)));
    changesApplied.push(`Intensitas SFX (${Math.round(nextSettings.sfxIntensity * 100)}%) dan BGM dikurangi.`);
  }
  if (/tambah(?:kan)?\s+(?:sound\s*effect|sfx|efek\s+suara|musik|bgm)/i.test(text)) {
    nextSettings.sfxIntensity = Math.min(1, Number(((nextSettings.sfxIntensity ?? 0.25) + 0.3).toFixed(2)));
    nextSettings.bgmVolume = Math.min(0.35, Number(((nextSettings.bgmVolume ?? 0.06) + 0.08).toFixed(2)));
    changesApplied.push(`Intensitas SFX (${Math.round(nextSettings.sfxIntensity * 100)}%) dan BGM ditingkatkan.`);
  }

  // 6. Ubah Style menjadi X
  for (const [alias, targetName] of Object.entries(STYLE_ALIASES)) {
    const re = new RegExp(`(?:style|gaya|menjadi|ke)\\s+(?:clipper\\s+)?${alias}\\b|\\b${alias}\\s+style\\b`, "i");
    if (re.test(text)) {
      const targetStyle = styles.find((s) => s.name === targetName);
      if (targetStyle) {
        nextSettings.preset = targetStyle.name;
        nextSettings.style = { ...targetStyle, size: nextSettings.subtitleSize || targetStyle.size };
        nextSettings.font = targetStyle.font;
        nextSettings.color = targetStyle.color;
        if (!/zoom/i.test(text)) nextSettings.zoom = targetStyle.zoom;
        changesApplied.push(`Gaya editing diubah menjadi ${targetStyle.name}.`);
        break;
      }
    }
  }

  // 6b. Watermark, Kredit Sumber (Source Label), dan Fokus Kamera Pembicara
  const wmMatch = text.match(/(?:tambah(?:kan)?|ubah|set|pasang)?\s*watermark\s*(?:menjadi|ke|:)?\s*["“']?([@\w\s._-]{2,48})["”']?/i);
  if (wmMatch && !/hapus\s+watermark/i.test(text)) {
    nextSettings.watermark = wmMatch[1].trim().slice(0, 48);
    changesApplied.push(`Watermark diatur menjadi "${nextSettings.watermark}".`);
  } else if (/hapus\s+watermark|tanpa\s+watermark/i.test(text)) {
    nextSettings.watermark = "";
    changesApplied.push("Watermark dihapus.");
  }

  const srcMatch = text.match(/(?:tambah(?:kan)?|ubah|set|pasang)?\s*(?:source|sumber|kredit)\s*(?:menjadi|ke|:)\s*["“']?([^"”'\n]{2,90})["”']?/i);
  if (srcMatch) {
    nextSettings.sourceLabel = srcMatch[1].trim().slice(0, 90);
    changesApplied.push(`Kredit sumber diatur menjadi "${nextSettings.sourceLabel}".`);
  }

  if (/fokus\s+(?:kamera\s+)?(?:ke\s+)?(?:orang|pembicara|wajah)|kamera\s+otomatis/i.test(text)) {
    nextSettings.cameraFocus = "auto";
    nextSettings.autoIllustrate = false;
    changesApplied.push("Fokus kamera diarahkan otomatis ke pembicara aktif dan ilustrasi penutup wajah dimatikan.");
  } else if (/fokus\s+(?:kamera\s+)?kiri|pembicara\s+kiri/i.test(text)) {
    nextSettings.cameraFocus = "left";
    changesApplied.push("Fokus kamera 9:16 dikunci ke pembicara sisi kiri.");
  } else if (/fokus\s+(?:kamera\s+)?kanan|pembicara\s+kanan/i.test(text)) {
    nextSettings.cameraFocus = "right";
    changesApplied.push("Fokus kamera 9:16 dikunci ke pembicara sisi kanan.");
  } else if (/fokus\s+(?:kamera\s+)?tengah/i.test(text)) {
    nextSettings.cameraFocus = "center";
    changesApplied.push("Fokus kamera 9:16 diatur ke tengah frame.");
  }

  // 7. Perbaiki Subtitle pada Timestamp atau Kata Tertentu
  const tsMatch = text.match(
    /(?:pada|di|timestamp|detik)\s+(\d+(?::\d+)?(?:\.\d+)?)\s*(?:dtk|detik|s)?\s*(?:ubah|ganti|perbaiki)?\s*(?:subtitle|teks)?\s*(?:menjadi|ke|:)\s*["“']([^"”']+)["”']/i,
  );
  const allEdits = [...(Array.isArray(subtitleEdits) ? subtitleEdits : [])];
  if (tsMatch) {
    allEdits.push({ timestamp: parseTimestampToSeconds(tsMatch[1]), replaceText: tsMatch[2] });
  }
  const wordReplaceMatch = text.match(
    /(?:ubah|ganti|perbaiki)\s+(?:kata|teks|subtitle)\s+["“']([^"”']+)["”']\s+(?:menjadi|ke)\s+["“']([^"”']+)["”']/i,
  );
  if (wordReplaceMatch) {
    allEdits.push({ findText: wordReplaceMatch[1], replaceText: wordReplaceMatch[2] });
  }

  for (const edit of allEdits) {
    if (edit.timestamp !== undefined && edit.timestamp !== null && edit.replaceText) {
      const ts = Number(edit.timestamp);
      // Cocokkan baik timestamp absolut sumber maupun relatif terhadap awal klip
      const absTs = ts < nextSettings.start ? nextSettings.start + ts : ts;
      const seg =
        nextSegments.find((s) => absTs >= s.start && absTs <= s.end) ||
        nextSegments.find((s) => Math.abs(s.start - absTs) <= 2.5);
      if (seg) {
        seg.text = edit.replaceText.trim();
        seg.words = subtitleWords({ ...seg, words: [] });
        changesApplied.push(`Subtitle pada ${ts} dtk diperbarui menjadi "${seg.text}".`);
      }
    } else if (edit.findText && edit.replaceText) {
      let replaced = false;
      for (const seg of nextSegments) {
        if (seg.text.toLowerCase().includes(edit.findText.toLowerCase())) {
          seg.text = seg.text.replace(new RegExp(edit.findText, "gi"), edit.replaceText);
          seg.words = subtitleWords({ ...seg, words: [] });
          replaced = true;
        }
      }
      if (replaced) {
        changesApplied.push(`Teks subtitle "${edit.findText}" diganti menjadi "${edit.replaceText}".`);
      }
    }
  }

  // Fallback bila instruksi umum tidak cocok pola spesifik: simpan sebagai catatan dan sesuaikan kualitas/scene
  if (!changesApplied.length) {
    nextSettings.visualDensity = Math.min(1, Number(((nextSettings.visualDensity ?? 0.5) + 0.15).toFixed(2)));
    changesApplied.push(`Konfigurasi scene disesuaikan untuk instruksi: "${text}".`);
  }

  // Perbarui scene plan & EDL tanpa memproses ulang transkripsi Whisper
  const activeStyle =
    nextSettings.style || styles.find((s) => s.name === nextSettings.preset) || styles[1];
  if (nextSegments.length > 0 && nextSettings.preset !== "Manual") {
    const scenes = styleScenes(
      nextSegments,
      nextSettings.start,
      nextSettings.end,
      activeStyle,
      nextSettings.visualDensity ?? 0.5,
    );
    const dir = buildEditDecisionList(
      nextSegments,
      nextSettings.start,
      nextSettings.end,
      activeStyle,
    );
    nextSettings.plan = {
      ...(nextSettings.plan || {}),
      scenes,
      edl: dir.edl,
      directorSummary: dir.directorSummary,
    };
  }

  return {
    nextSettings,
    nextSegments,
    changesApplied,
  };
}
