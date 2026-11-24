const cues = {
  "data baru": /\d|persen|indeks|ukuran/i,
  "bukti baru": /bukti|dokumen|catatan|saksi|arsip|katanya|diduga|klaim|rumor/i,
  "langkah baru": /langkah|pertama|kedua|ketiga|proses|selanjutnya|cara/i,
  "aksen kata": /[!?]|ternyata|akhirnya|justru|parah|gila/i,
  "pergantian isu": /laporan|namun|selanjutnya|sementara|kebijakan|pemilu/i,
  "pergantian ide": /\?|tapi|menurut|kalau|namun|padahal/i,
  "akhir kalimat": /[.!?]\s*$/
};

const CLAIM_RE = /\b(katanya|kabarnya|diduga|konon|rumor|isu|klaim|spekulasi|menurut\s+saya|menurutnya|opini|gosip|katanya sih)\b/i;
const FACT_RE = /\b(tercatat|resmi|dokumen|arsip|survei|statistik|putusan|undang-undang|laporan\s+resmi|persen|tahun\s+(?:19|20)\d\d)\b/i;

export function classifySceneAction(text) {
  if (/\b(19|20)\d\d\b/.test(text)) return "timeline";
  if (/\b(vs|versus|dibanding|dibandingkan|lebih\s+(?:baik|besar|kecil|tinggi|rendah|cepat))\b/i.test(text)) return "perbandingan";
  if (/\b(pertama|kedua|ketiga|langkah|cara|tahap)\b/i.test(text)) return "langkah";
  if (/\d/.test(text)) return "statistik";
  if (CLAIM_RE.test(text)) return "klaim";
  if (FACT_RE.test(text)) return "fakta";
  if (/\?|\b(mengapa|kenapa|bagaimana)\b/i.test(text)) return "pertanyaan";
  return "kutipan";
}

export function classifyVeracity(text, action, styleType) {
  if (action === "klaim" || CLAIM_RE.test(text)) return "klaim";
  if (action === "fakta" || action === "statistik" || action === "timeline" || FACT_RE.test(text)) return "fakta";
  if (["politik", "konspirasi", "debat", "crime"].includes(styleType)) return "konteks";
  return "konteks";
}

function detectStepNumber(text, fallback) {
  if (/\bpertama\b/i.test(text)) return 1;
  if (/\bkedua\b/i.test(text)) return 2;
  if (/\bketiga\b/i.test(text)) return 3;
  if (/\bkeempat\b/i.test(text)) return 4;
  const num = text.match(/\b(?:langkah|tahap)\s+(\d+)/i)?.[1];
  return num ? Number(num) : fallback;
}

export function enrichSceneVisual(text, action, veracity, index = 0, assetBehavior = "sisipan") {
  if (action === "statistik") {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(%|persen|juta|miliar|ribu|level|kali|tahun|jam|menit|detik)?/i);
    const rawNum = match ? parseFloat(match[1].replace(",", ".")) : 50;
    const unit = match?.[2] || "";
    const isPercent = /%|persen/i.test(unit);
    const valueText = match ? `${match[1]}${unit === "%" ? "%" : unit ? " " + unit : ""}` : "";
    return {
      visualType: "grafik",
      visualReason: "Ujaran memuat data numerik yang lebih mudah dipahami lewat grafik metrik.",
      recommendedSource: "Grafik Data Internal",
      chartData: {
        kind: "stat",
        value: valueText,
        percent: isPercent ? Math.max(8, Math.min(100, rawNum)) : Math.max(18, Math.min(95, rawNum * 10)),
      },
    };
  }
  if (action === "perbandingan") {
    const parts = text.split(/\b(?:vs|versus|dibandingkan|dibanding|daripada)\b/i);
    const left = (parts[0] || "").trim().split(/\s+/).slice(-4).join(" ") || "Opsi A";
    const right = (parts[1] || "").trim().split(/\s+/).slice(0, 4).join(" ") || "Opsi B";
    return {
      visualType: "grafik",
      visualReason: "Kalimat membandingkan dua hal sehingga cocok memakai kartu perbandingan.",
      recommendedSource: "Grafik Perbandingan Internal",
      chartData: { kind: "compare", left, right },
    };
  }
  if (action === "timeline") {
    const year = text.match(/\b((?:19|20)\d\d)\b/)?.[1] || "Linimasa";
    return {
      visualType: "grafik",
      visualReason: "Menyebut tahun atau periode peristiwa yang jelas dengan grafik linimasa.",
      recommendedSource: "Grafik Linimasa Internal",
      chartData: { kind: "timeline", year },
    };
  }
  if (action === "langkah" || action === "pertanyaan" || action === "klaim" || action === "fakta") {
    return {
      visualType: "motion",
      visualReason:
        action === "langkah"
          ? "Urutan langkah lebih jelas dengan penanda progres bernomor."
          : action === "klaim"
            ? "Pernyataan bersifat klaim/opini sehingga perlu penanda verifikasi tanpa bukti palsu."
            : action === "fakta"
              ? "Pernyataan merujuk dokumen/data sehingga cocok diberi penanda rujukan."
              : "Pertanyaan pembuka diperkuat dengan motion callout interaktif.",
      recommendedSource: "Motion Graphic Overlay",
      motionData: {
        kind: action === "langkah" ? "step" : action === "pertanyaan" ? "question" : "veracity",
        stepNumber: action === "langkah" ? detectStepNumber(text, index + 1) : undefined,
        status: veracity,
      },
    };
  }
  if (/\b(lokasi|kota|jalan|ruang|studio|suasana|gedung|pasar|hutan|kapal|pantai|pertandingan|rumah)\b/i.test(text)) {
    return {
      visualType: "b-roll",
      visualReason: "Menyebut suasana atau lokasi yang tepat didukung footage/foto b-roll.",
      recommendedSource: "Aset Lokal / Stok Berizin",
    };
  }
  if (/\b(arsip|sejarah|tokoh|foto|gambar|ilustrasi|candi|radio|mesin tik|medieval|museum|peta|parfum|kopi|pesawat|ponsel|laptop)\b/i.test(text)) {
    return {
      visualType: assetBehavior === "bingkai" ? "ilustrasi" : "foto",
      visualReason: "Menyebut objek atau konsep konkret yang dapat divisualkan dengan referensi berlisensi.",
      recommendedSource: "Wikimedia Commons / Aset Lokal",
    };
  }
  return {
    visualType: assetBehavior === "bingkai" ? "ilustrasi" : "motion",
    visualReason:
      assetBehavior === "bingkai"
        ? "Gaya editorial bingkai memprioritaskan ilustrasi kontekstual atau kartu arsip."
        : "Menekankan inti kutipan pembicara dengan motion typography.",
    recommendedSource: assetBehavior === "bingkai" ? "Wikimedia Commons / Aset Lokal" : "Motion Graphic Overlay",
  };
}

export function styleScenes(segments, start, end, style, visualDensity = 0.5) {
  const events = [];
  const dFactor = Number.isFinite(Number(visualDensity))
    ? 1.4 - 0.8 * Math.max(0, Math.min(1, Number(visualDensity)))
    : 1.0;
  const minGap = Math.max(1.2, (style.sceneDensityRules?.minGap || 5) * dFactor);
  for (const segment of segments) {
    if (segment.end <= start || segment.start >= end) continue;
    const words = segment.words?.filter((w) => w.end > start && w.start < end);
    if (segment.words?.length && !words.length) continue;
    const text = (words?.length ? words.map((w) => w.text).join(" ") : segment.text).trim();
    if (!text) continue;
    const at = Math.max(0, (words?.[0]?.start ?? segment.start) - start);
    const last = events.at(-1);
    const cueMatch = cues[style.cutRhythm] ? cues[style.cutRhythm].test(text) : false;
    if (
      last &&
      (at - last.at < minGap ||
        (!cueMatch && at - last.at < minGap * 1.7))
    ) {
      continue;
    }
    const until = Math.min(end - start - 0.35, at + style.pacingRules.hold);
    if (until - at < 0.55) continue;
    const tokens = text.split(/\s+/);
    const headline = tokens.slice(-5).join(" ").replace(/[.,;:]$/, "");
    const action = classifySceneAction(text);
    const veracity = classifyVeracity(text, action, style.type);
    const visual = enrichSceneVisual(text, action, veracity, events.length, style.assetBehavior);
    events.push({
      at,
      end: until,
      label: tokens.slice(0, 9).join(" "),
      headline,
      query: tokens.slice(0, 3).join(" "),
      action,
      veracity,
      ...visual,
    });
  }
  return events;
}
