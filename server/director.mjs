import { styles } from "./style-registry.mjs";
import { classifySceneAction, classifyVeracity, enrichSceneVisual } from "./style-timeline.mjs";

const STOP_WORDS = new Set(
  "yang dengan pada dari untuk bahwa adalah karena kalau dalam sudah bisa akan tidak jadi saya kita kamu mereka juga lebih itu ini ada dan terus kayak banget namun tapi lalu maka saat baru saja aja gitu gini selamat terima kasih langsung lagi dulu".split(
    " ",
  ),
);

const RESTRAINT_MARKERS =
  /\b(jujur|sedih|maaf|menyesal|doa|ikhlas|tenang|hening|pribadi|hati|terharu|renungan|syukur)\b/i;
const TOPIC_SHIFT_MARKERS =
  /^(namun|tetapi|tapi|sementara|selanjutnya|kedua|ketiga|berikutnya|di sisi lain|sekarang)\b/i;
const CLIMAX_MARKERS =
  /!|\b(ternyata|akhirnya|puncak|kuncinya|intinya|terbesar|mengejutkan|fakta|kesimpulannya|hasilnya)\b/i;

function pickEmphasisKeywords(text) {
  const tokens = text.match(/[\p{L}\d%]{3,}/gu) || [];
  const scored = tokens
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => {
      let weight = w.length >= 6 ? 2 : 1;
      if (/\d|%/.test(w)) weight += 4;
      if (/^[A-Z]/.test(w)) weight += 2;
      return { word: w.toLowerCase(), raw: w, weight };
    })
    .sort((a, b) => b.weight - a.weight);
  const seen = new Set();
  const picks = [];
  for (const item of scored) {
    if (seen.has(item.word)) continue;
    seen.add(item.word);
    picks.push(item.raw);
    if (picks.length >= 3) break;
  }
  return picks;
}

function detectBeatEmotion(text) {
  if (/lucu|ketawa|haha|kocak/i.test(text)) return "lucu";
  if (/sedih|haru|maaf|menyesal|doa/i.test(text)) return "reflektif";
  if (/marah|tegas|bantah|lawan|krisis/i.test(text)) return "tegas";
  if (/!|ternyata|mengejutkan|gila|parah/i.test(text)) return "intens";
  if (/\?|mengapa|kenapa|bagaimana/i.test(text)) return "penasaran";
  if (/\d|persen|data|tahun/i.test(text)) return "analitis";
  return "natural";
}

export function buildEditDecisionList(segments = [], start = 0, end = 30, styleInput = null) {
  const duration = Math.max(0.5, end - start);
  const style =
    styleInput && styleInput.overlayVocabulary
      ? styleInput
      : styles.find((s) => s.name === styleInput || s.type === styleInput) || styles[1];

  const excerpt = segments.filter((s) => s.end > start && s.start < end);
  if (!excerpt.length) {
    return {
      edl: [],
      directorSummary: {
        editorialPhilosophy: "Belum ada segmen ujaran pada rentang waktu ini.",
        visualBeatsCount: 0,
        restraintBeatsCount: 0,
        topicShiftsCount: 0,
        speakerTurnsCount: 0,
      },
    };
  }

  // Cari indeks segmen klimaks pada paruh kedua klip
  let climaxIdx = Math.max(0, excerpt.length - 2);
  let bestClimaxScore = -1;
  for (let i = Math.floor(excerpt.length * 0.4); i < excerpt.length; i++) {
    const t = excerpt[i].text;
    const sc =
      (CLIMAX_MARKERS.test(t) ? 5 : 0) +
      (/\d|%/.test(t) ? 3 : 0) +
      (/!/.test(t) ? 3 : 0) +
      (i === excerpt.length - 1 ? 1 : 2);
    if (sc > bestClimaxScore) {
      bestClimaxScore = sc;
      climaxIdx = i;
    }
  }

  const edl = [];
  let lastVisualAt = -99;
  const minVisualGap = style.sceneDensityRules?.minGap ?? 5;

  for (let i = 0; i < excerpt.length; i++) {
    const seg = excerpt[i];
    const prev = excerpt[i - 1];
    const at = Math.max(0, Number((seg.start - start).toFixed(2)));
    const until = Math.min(duration, Number((seg.end - start).toFixed(2)));
    const segDur = Math.max(0.2, Number((until - at).toFixed(2)));
    const pauseBefore = prev ? Math.max(0, Number((seg.start - prev.end).toFixed(2))) : 0;
    const text = seg.text.trim();

    const relPos = at / duration;
    let phase = "build-up";
    if (i === 0 || (relPos < 0.22 && i <= 1)) phase = "hook";
    else if (i === excerpt.length - 1 && excerpt.length > 2) phase = "payoff";
    else if (i === climaxIdx) phase = "climax";

    const speakerTurn = i > 0 && (pauseBefore >= 0.55 || (/\?$/.test(prev?.text?.trim() || "") && pauseBefore >= 0.25));
    const topicShift = i > 0 && (TOPIC_SHIFT_MARKERS.test(text) || pauseBefore >= 0.85);
    const beatEmotion = detectBeatEmotion(text);
    const action = classifySceneAction(text);
    const veracity = classifyVeracity(text, action, style.type);
    const visualInfo = enrichSceneVisual(text, action, veracity, i, style.assetBehavior);
    const emphasisKeywords = pickEmphasisKeywords(text);

    // Tentukan apakah momen ini lebih baik TANPA efek visual (restraint)
    const isReflective = RESTRAINT_MARKERS.test(text) || ["quotes", "dakwah", "podcast"].includes(style.type) && action === "kutipan";
    const tooCloseToPrevVisual = at - lastVisualAt < minVisualGap;
    const isPayoffClose = phase === "payoff" && action === "kutipan";
    const restraint =
      isPayoffClose ||
      (isReflective && phase !== "hook" && action === "kutipan") ||
      (tooCloseToPrevVisual && phase === "build-up" && !["statistik", "perbandingan", "timeline"].includes(action));

    let editingAction = "speaker-focus-clean";
    let reason = "";
    let needsVisual = false;

    if (restraint) {
      editingAction = isPayoffClose ? "payoff-close" : "speaker-focus-clean";
      reason = isPayoffClose
        ? "Penutup klip kembali fokus penuh ke ekspresi pembicara agar pesan akhir mengendap tanpa gangguan visual."
        : isReflective
          ? "Momen reflektif/percakapan intim lebih kuat ditampilkan bersih tanpa efek overlay tambahan."
          : `Menjaga ritme napas visual (jarak < ${minVisualGap} dtk dari efek sebelumnya) agar video tidak penuh sesak.`;
    } else if (phase === "hook") {
      editingAction = "hook-punch";
      needsVisual = ["statistik", "pertanyaan", "klaim"].includes(action);
      reason = "Membuka klip dengan penekanan hook, gerak kamera aktif, dan sorotan kata kunci untuk menahan retensi 3 detik pertama.";
    } else if (["statistik", "perbandingan", "timeline"].includes(action)) {
      editingAction = "graphic-callout";
      needsVisual = true;
      reason = `Ujaran memuat ${action} terukur yang divisualkan dengan grafik data agar mudah dicerna.`;
    } else if (phase === "climax") {
      editingAction = "climax-emphasis";
      needsVisual = visualInfo.visualType !== "motion" || action !== "kutipan";
      reason = "Puncak argumen/cerita diperkuat dengan zoom klimaks dan penekanan tipografi.";
    } else if (topicShift || speakerTurn) {
      editingAction = "topic-transition";
      needsVisual = ["foto", "ilustrasi", "b-roll"].includes(visualInfo.visualType);
      reason = speakerTurn
        ? `Pergantian giliran bicara setelah jeda ${pauseBefore} dtk ditandai dengan potongan framing segar.`
        : "Perpindahan subtopik diperjelas dengan transisi scene dan penanda konteks.";
    } else {
      editingAction = "visual-cutaway";
      needsVisual = true;
      reason = visualInfo.visualReason;
    }

    if (needsVisual) lastVisualAt = at;

    const zoomDelta = restraint
      ? 0
      : phase === "hook"
        ? Number((style.zoom * 0.14).toFixed(3))
        : phase === "climax"
          ? Number((style.zoom * 0.18).toFixed(3))
          : Number((style.zoom * 0.08).toFixed(3));

    const sfxActive = !restraint && (phase === "hook" || phase === "climax" || editingAction === "graphic-callout");

    edl.push({
      index: i + 1,
      at,
      end: until,
      duration: segDur,
      phase,
      editingAction,
      restraint,
      topicShift,
      speakerTurn,
      pauseBefore,
      emotion: beatEmotion,
      reason,
      subtitleText: text,
      emphasisKeywords,
      suggestedBroll: {
        needed: needsVisual,
        visualType: restraint ? "none" : visualInfo.visualType,
        query: emphasisKeywords.slice(0, 2).join(" ") || visualInfo.query || "",
        veracity,
        recommendedSource: restraint ? "Kamera Pembicara" : visualInfo.recommendedSource,
        reason: restraint ? reason : visualInfo.visualReason,
      },
      camera: {
        zoomDelta,
        motion: restraint ? "steady" : style.visualTreatment?.cameraMotion || style.animationGrammar,
        transition: restraint ? "potong-halus" : style.transitionGrammar,
      },
      audio: {
        mix: pauseBefore >= 0.65 ? "natural-breath-pause" : "dialog-clarity-16lufs",
        bgmDucking: restraint ? 0.12 : 0.2,
        sfxCue: sfxActive ? style.soundCueHints || "subtle-tick" : "hening",
        sfxIntensity: sfxActive ? (style.tempo === "cepat" ? 0.65 : 0.35) : 0,
      },
    });
  }

  const visualBeatsCount = edl.filter((e) => !e.restraint).length;
  const restraintBeatsCount = edl.filter((e) => e.restraint).length;
  const topicShiftsCount = edl.filter((e) => e.topicShift).length;
  const speakerTurnsCount = edl.filter((e) => e.speakerTurn).length;

  return {
    edl,
    directorSummary: {
      styleName: style.name,
      tempo: style.tempo,
      visualBeatsCount,
      restraintBeatsCount,
      topicShiftsCount,
      speakerTurnsCount,
      arc: {
        hookAt: edl.find((e) => e.phase === "hook")?.at ?? 0,
        climaxAt: edl.find((e) => e.phase === "climax")?.at ?? 0,
        payoffAt: edl.find((e) => e.phase === "payoff")?.at ?? 0,
      },
      editorialPhilosophy: `Gaya ${style.name} (${style.tempo}): ${visualBeatsCount} beat bervisual/aksen dan ${restraintBeatsCount} beat fokus bersih pembicara tanpa efek (${topicShiftsCount} pergantian topik, ${speakerTurnsCount} pergantian giliran/jeda).`,
    },
  };
}
