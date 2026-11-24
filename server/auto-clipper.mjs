import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { analyze } from "./content-intelligence.mjs";
import { recommend } from "./highlights.mjs";
import { bounds } from "./media.mjs";
import { modes, styles } from "./style-registry.mjs";
import { styleScenes } from "./style-timeline.mjs";
import { VOICE_PRESETS } from "./voice.mjs";

function pickVoiceStyle(styleType) {
  if (["dokumenter", "crime", "konspirasi"].includes(styleType)) return "Dokumenter";
  if (["berita", "newsroom", "politik", "market"].includes(styleType)) return "Berita";
  if (["wawancara", "quotes", "dakwah", "luxury"].includes(styleType)) return "Storyteller";
  if (["motivasi", "game", "meme", "debat"].includes(styleType)) return "Energik";
  if (["finance", "tech", "explainer", "tutorial"].includes(styleType)) return "Tenang";
  return "Natural";
}

function summarizeVisuals(scenes) {
  const counts = { grafik: 0, motion: 0, foto: 0, ilustrasi: 0, "b-roll": 0 };
  for (const s of scenes) {
    const key = counts[s.visualType] !== undefined ? s.visualType : "motion";
    counts[key]++;
  }
  return counts;
}

function draftNarration(clip, autoNarrate) {
  if (!autoNarrate) return "";
  const topic = clip.topic?.split(" · ")[0];
  if (topic) return `Perhatikan poin penting soal ${topic} berikut ini.`;
  return "Simak bagian menarik dari pembahasan berikut ini.";
}

export async function buildAutoClipperPlan({
  sourceId,
  sourceName,
  duration,
  segments,
  options = {},
}) {
  const min = [15, 30, 60].includes(Number(options.min)) ? Number(options.min) : 15;
  const count = Math.max(3, Math.min(10, Number.isInteger(Number(options.count)) ? Number(options.count) : 3));
  const versionCount = Math.max(1, Math.min(3, Number.isInteger(Number(options.versionCount)) ? Number(options.versionCount) : 1));
  const editMode = typeof options.editMode === "string" ? options.editMode : "Otomatis";
  const autoNarrate = options.autoNarrate === true;

  let eligible = segments;
  if (options.range) {
    bounds(options.range.start, options.range.end, duration);
    eligible = segments.filter((seg) => seg.start >= options.range.start && seg.end <= options.range.end);
  }
  if (!eligible.length) throw Error("Transkrip pada rentang ini belum berisi ujaran.");

  const rec = await recommend(eligible, { min, count, provider: options.provider === true });
  if (!rec.clips.length) throw Error("Belum ditemukan segmen yang memenuhi durasi minimal klip.");

  const modePreset = Object.hasOwn(modes, editMode) ? modes[editMode] : null;
  const clips = rec.clips.map((clip, index) => {
    const plan = analyze(segments, clip.start, clip.end);
    const orderedNames = [];
    const pushStyle = (name) => {
      if (name && styles.some((s) => s.name === name) && !orderedNames.includes(name)) {
        orderedNames.push(name);
      }
    };
    if (modePreset) pushStyle(modePreset);
    for (const s of plan.suggestions) pushStyle(s.name);
    for (const s of styles) {
      if (orderedNames.length >= versionCount) break;
      pushStyle(s.name);
    }

    const versions = orderedNames.slice(0, versionCount).map((name, vIdx) => {
      const styleObj = styles.find((s) => s.name === name);
      const scenes = styleScenes(segments, clip.start, clip.end, styleObj);
      const suggReason = plan.suggestions.find((s) => s.name === name)?.reason || styleObj.description;
      return {
        versionIndex: vIdx + 1,
        preset: styleObj.name,
        type: styleObj.type,
        reason: suggReason,
        scenes,
        visualSummary: summarizeVisuals(scenes),
        narration: draftNarration(clip, autoNarrate),
        voiceStyle: pickVoiceStyle(styleObj.type),
        selected: vIdx === 0 || versionCount > 1,
      };
    });

    const excerptText = segments
      .filter((s) => s.end > clip.start && s.start < clip.end)
      .map((s) => s.text.trim())
      .join(" ");

    return {
      clipIndex: index,
      selected: true,
      excerptText,
      ...clip,
      versions,
    };
  });

  return {
    source: sourceId,
    sourceName,
    highlightMode: rec.mode,
    editMode,
    versionCount,
    transcriptSummary: {
      totalSegments: segments.length,
      eligibleSegments: eligible.length,
      duration,
    },
    stages: [
      { id: "input", label: "Input Media", status: "selesai" },
      { id: "transcript", label: "Transkripsi", status: "selesai" },
      { id: "highlight", label: "AI Highlight Intelligence", status: "selesai" },
      { id: "style", label: "Rekomendasi Style", status: "selesai" },
      { id: "visual", label: "Visual Planning", status: "selesai" },
      { id: "render", label: "Editing & Render MP4", status: "siap" },
    ],
    clips,
  };
}

export function buildRenderEntriesFromPlan({
  sourceId,
  duration,
  segments,
  items,
  shared = {},
  hasVoiceSample = false,
}) {
  const entries = [];
  for (const item of items) {
    if (item.selected === false) continue;
    bounds(item.start, item.end, duration);
    const chosenVersions = Array.isArray(item.versions)
      ? item.versions.filter((v) => v.selected !== false)
      : [{ preset: item.preset, narration: item.narration, voiceStyle: item.voiceStyle }];

    for (const ver of chosenVersions) {
      const styleObj = styles.find((s) => s.name === ver.preset) || styles[0];
      const plan = analyze(segments, item.start, item.end);
      plan.scenes = styleScenes(segments, item.start, item.end, styleObj);
      const voiceStyle = Object.hasOwn(VOICE_PRESETS, ver.voiceStyle)
        ? ver.voiceStyle
        : pickVoiceStyle(styleObj.type);
      const vp = VOICE_PRESETS[voiceStyle];
      const versionTag = chosenVersions.length > 1 ? ` · ${styleObj.name.replace("Clipper ", "")}` : "";
      entries.push({
        id: randomUUID(),
        settings: {
          start: item.start,
          end: item.end,
          title: ((item.title || "Klip Auto") + versionTag).slice(0, 160),
          preview: shared.preview !== false,
          preset: styleObj.name,
          style: styleObj,
          plan,
          font: shared.font || styleObj.font,
          color: shared.color || styleObj.color,
          position: ["Bawah", "Tengah", "Atas"].includes(shared.position) ? shared.position : "Bawah",
          subtitleSize: Number.isFinite(Number(shared.subtitleSize)) ? Number(shared.subtitleSize) : styleObj.size,
          cameraFocus: ["auto", "left", "right", "center"].includes(shared.cameraFocus) ? shared.cameraFocus : "auto",
          zoom: Number.isFinite(Number(shared.zoom)) ? Number(shared.zoom) : styleObj.zoom,
          assets: Array.isArray(shared.assets) ? shared.assets.slice(0, 3) : [],
          subtitles: shared.subtitles !== false,
          approvedPages: null,
          sourceLabel: typeof shared.sourceLabel === "string" ? shared.sourceLabel.trim().slice(0, 90) : "",
          watermark: typeof shared.watermark === "string" ? shared.watermark.trim().slice(0, 48) : "",
          watermarkCorner: shared.watermarkCorner || "Kanan",
          watermarkFont: shared.watermarkFont || "Arial",
          watermarkStyle: shared.watermarkStyle || "Klasik",
          watermarkOpacity: Number.isFinite(Number(shared.watermarkOpacity)) ? Number(shared.watermarkOpacity) : 0.7,
          autoIllustrate: shared.autoIllustrate !== false,
          voiceStyle,
          voiceRate: vp.rate,
          voiceVolume: 1,
          ducking: vp.ducking,
          voiceSync: "intro",
          voiceStart: 0,
          clone: shared.clone === true && hasVoiceSample,
          narration: typeof ver.narration === "string" ? ver.narration.trim().slice(0, 500) : "",
        },
      });
    }
  }
  if (!entries.length) throw Error("Pilih minimal satu versi klip untuk dirender.");
  if (entries.length > 20) throw Error("Maksimal 20 versi render dalam satu antrean Auto Clipper.");
  return entries;
}

export function autoClipper({ app, source, transcript, file, insertJobs }) {
  app.post("/api/auto-clipper/plan", async (req, res) => {
    const s = source(req.body?.source);
    const language = ["id", "en", "auto"].includes(req.body?.language) ? req.body.language : "id";
    const trRow = transcript.status(s.id);
    if (trRow?.status !== "selesai") {
      if (req.body?.autoTranscribe === false)
        throw Error("Transkripsikan video sumber terlebih dahulu.");
      if (trRow?.status !== "berjalan") {
        transcript.start(s, language);
      }
      const updated = transcript.status(s.id);
      return res.status(202).json({
        status: "transcribing",
        source: s.id,
        progress: updated?.progress || 0,
        stages: [
          { id: "input", label: "Input Media", status: "selesai" },
          { id: "transcript", label: "Transkripsi", status: "berjalan" },
          { id: "highlight", label: "AI Highlight Intelligence", status: "menunggu" },
          { id: "style", label: "Rekomendasi Style", status: "menunggu" },
          { id: "visual", label: "Visual Planning", status: "menunggu" },
          { id: "render", label: "Editing & Render MP4", status: "menunggu" },
        ],
      });
    }

    const segments = transcript(s.id).segments;
    const plan = await buildAutoClipperPlan({
      sourceId: s.id,
      sourceName: s.name,
      duration: s.meta.duration,
      segments,
      options: req.body,
    });

    if (req.body?.workflow === "full-auto") {
      const hasVoiceSample = existsSync(file(s.id, ".voice.wav")) && existsSync(file(s.id, ".voice.json"));
      const entries = buildRenderEntriesFromPlan({
        sourceId: s.id,
        duration: s.meta.duration,
        segments,
        items: plan.clips,
        shared: req.body,
        hasVoiceSample,
      });
      insertJobs(s.id, entries, segments);
      plan.stages[5].status = "berjalan";
      return res.json({
        status: "queued",
        id: entries[0].id,
        ids: entries.map((e) => e.id),
        plan,
      });
    }

    res.json({ status: "review", plan });
  });

  app.post("/api/auto-clipper/execute", (req, res) => {
    const s = source(req.body?.source);
    const trRow = transcript.status(s.id);
    if (trRow?.status !== "selesai") throw Error("Transkrip belum selesai.");
    const segments = transcript(s.id).segments;
    const items = req.body?.clips;
    if (!Array.isArray(items) || !items.length) throw Error("Daftar klip rencana kosong.");
    const hasVoiceSample = existsSync(file(s.id, ".voice.wav")) && existsSync(file(s.id, ".voice.json"));
    const entries = buildRenderEntriesFromPlan({
      sourceId: s.id,
      duration: s.meta.duration,
      segments,
      items,
      shared: req.body,
      hasVoiceSample,
    });
    insertJobs(s.id, entries, segments);
    res.json({
      status: "queued",
      id: entries[0].id,
      ids: entries.map((e) => e.id),
    });
  });
}
