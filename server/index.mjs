import express from "express";
import {styles, controlPresets, normalizeEditingControls} from "./style-registry.mjs";
import {styleScenes} from "./style-timeline.mjs";
import {voiceStudio} from "./voice-studio.mjs";
import {VOICE_PRESETS} from "./voice.mjs";
import {autoClipper} from "./auto-clipper.mjs";
import {registerHistoryRoutes, getStorageSummary, getJobStorageDetails} from "./history.mjs";
import {inspectRenderedVideo} from "./qc.mjs";
import {buildEditDecisionList} from "./director.mjs";
import {applyRevisionInstruction} from "./revision.mjs";
import {documentary} from "./documentary.mjs";
import {analyze} from "./content-intelligence.mjs";
import multer from "multer";
import next from "next";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { fork, execFileSync } from "node:child_process";
import path from "node:path";
import { bounds, cut, metadata } from "./media.mjs";
import { transcripts, python } from "./transcript.mjs";
import { recommend, detectLocalLLM } from "./highlights.mjs";
import { imports } from "./imports.mjs";
import yazl from "yazl";
process.env.NEXT_TELEMETRY_DISABLED = "1";
const root = path.resolve(process.env.DATA_DIR || "data");
mkdirSync(root, { recursive: true });
// SQLite melepaskan kunci ketika proses berakhir, termasuk setelah crash.
const ownership = new DatabaseSync(path.join(root, "studio.lock.sqlite"));
try {
  ownership.exec("begin exclusive");
} catch {
  ownership.close();
  throw Error(
    "Folder data sedang digunakan oleh Podcast AI Editor yang sudah berjalan.",
  );
}
process.once("exit", () => ownership.close());
const port = Number(process.env.PORT || 3210);
mkdirSync(".cache", { recursive: true });
process.env.TEMP = process.env.TMP = path.resolve(".cache");
const buildPointer = ".cache/web-builds/current.txt";
if (process.argv.includes("--production") && existsSync(buildPointer)) {
  const id = readFileSync(buildPointer, "utf8").trim();
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("ID build studio tidak valid.");
  process.env.STUDIO_NEXT_DIST = ".cache/web-builds/" + id;
}
const web = next({
  dev: !process.argv.includes("--production"),
  hostname: "127.0.0.1",
  port,
  webpack: true,
});
await web.prepare();
const app = express(),
  db = new DatabaseSync(path.join(root, "studio.sqlite"));
db.exec(`pragma journal_mode=WAL;
create table if not exists source(id text primary key,name text,meta text,created integer);
create table if not exists job(id text primary key,source text,settings text,status text,progress integer,error text,created integer);
create table if not exists render_transcript(job text primary key,segments text);
update job set status='menunggu',progress=0,error='' where status='berjalan';`);
try {
  syncStorageAndCleanupTemp({ db, root });
} catch {}
const listSources = () =>
  db
    .prepare("select * from source order by created desc")
    .all()
    .map((s) => ({ ...s, meta: JSON.parse(s.meta) }));
const jobs = () =>
  db
    .prepare("select * from job order by created desc")
    .all()
    .map((j) => ({ ...j, settings: JSON.parse(j.settings) }));
const source = (id) => {
  const s = db.prepare("select * from source where id=?").get(id);
  if (!s) throw Error("Sumber tidak ditemukan.");
  return { ...s, meta: JSON.parse(s.meta) };
};
const file = (id, ext) => path.join(root, id + ext);
const upload = multer({
  defParamCharset: "utf8",
  storage: multer.diskStorage({
    destination: root,
    filename: (_r, _f, cb) => cb(null, randomUUID() + ".source"),
  }),
  limits: { fileSize: 4 * 1024 ** 3, files: 1, fields: 0 },
  fileFilter: (_r, f, cb) =>
    /\.(mp4|mov)$/i.test(f.originalname)
      ? cb(null, true)
      : cb(Error("Pilih file MP4 atau MOV.")),
});
app.use(
  "/api",
  (req, res, next) => {
    const host = req.headers.host;
    if (
      !["127.0.0.1:" + port, "localhost:" + port].includes(host) ||
      (req.headers.origin && req.headers.origin !== "http://" + host)
    )
      return res.sendStatus(403);
    res.set("Cache-Control", "no-store");
    next();
  },
  express.json({ limit: "2mb" }),
);
const context = { app, db, source, file, root };
const transcript = transcripts(context);
imports(context);
voiceStudio(context);
function readQc(jobId) {
  try {
    const p = file(jobId, ".qc.json");
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  } catch {}
  return null;
}
app.get("/api/state", async (_r, res) => {
  const llm = await detectLocalLLM();
  res.json({
    sources: listSources(),
    jobs: jobs().map((j) => {
      const storage = getJobStorageDetails(db, root, j);
      const qc = j.status === "selesai" ? readQc(j.id) : null;
      return {
        ...j,
        illustrationCount: assetCount(j),
        sizeBytes: storage.jobTotalBytes,
        storage,
        qcStatus: qc?.status || null,
        qcSummary: qc?.summary || null,
        qc,
      };
    }),
    storage: getStorageSummary(db, root),
    provider: !!llm,
    providerInfo: llm ? { model: llm.model, source: llm.source } : null,
  });
});
app.post("/api/source/:id/highlights", async (req, res) => {
  const s = source(req.params.id);
  const data = transcript(s.id);
  if (!data.segments.length) throw Error("Transkrip belum berisi ujaran.");
  const range = req.body.range;
  if (range !== undefined) bounds(range?.start, range?.end, s.meta.duration);
  const eligible = range
    ? data.segments.filter(
        (seg) => seg.start >= range.start && seg.end <= range.end,
      )
    : data.segments;
  res.json(await recommend(eligible, req.body));
});
app.post("/api/source", upload.single("video"), async (req, res) => {
  if (!req.file) throw Error("Video belum dipilih.");
  try {
    const meta = await metadata(req.file.path),
      id = path.parse(req.file.filename).name;
    db.prepare("insert into source values(?,?,?,?)").run(
      id,
      req.file.originalname,
      JSON.stringify(meta),
      Date.now(),
    );
    res.json({ id });
  } catch (e) {
    unlinkSync(req.file.path);
    throw e;
  }
});
app.get("/api/source/:id/video", (req, res) =>
  res.type("video/mp4").sendFile(source(req.params.id).id + ".source", { root }),
);
let busy = false;
let activeWorker = null;
const illustrationCounts = new Map();
function assetCount(j) {
  if (j.status !== "selesai" || !j.settings.autoIllustrate) return undefined;
  if (!illustrationCounts.has(j.id)) {
    try {
      illustrationCounts.set(
        j.id,
        JSON.parse(readFileSync(file(j.id, ".mp4.assets.json"), "utf8")).length,
      );
    } catch {
      return undefined;
    }
  }
  return illustrationCounts.get(j.id);
}
async function renderJob(id, payload, progress) {
  const dir = mkdtempSync(path.resolve(".cache/job-"));
  try {
    writeFileSync(path.join(dir, "job.json"), JSON.stringify(payload));
    await new Promise((resolve, reject) => {
      const child = fork("workers/render-job.mjs", [dir], {
        silent: true,
        windowsHide: true,
        execArgv: [],
      });
      const worker = { id, child, paused: false, cancelled: false };
      activeWorker = worker;
      let detail = "";
      child.stdout.resume();
      child.stderr.on("data", (d) => (detail = (detail + d).slice(-2500)));
      child.on("message", (m) => {
        if (!worker.paused && !worker.cancelled) progress(m.progress);
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 && !worker.cancelled
          ? resolve()
          : reject(Error(detail || "Render terhenti.")),
      );
    });
  } finally {
    activeWorker = null;
    rmSync(dir, { recursive: true, force: true, maxRetries: 4 });
  }
}
app.post("/api/job/:id/control", (req, res) => {
  const id = req.params.id,
    action = req.body?.action,
    j = db.prepare("select status from job where id=?").get(id);
  const allowed = {
    pause: ["menunggu", "berjalan"],
    resume: ["dijeda"],
    cancel: ["menunggu", "berjalan", "dijeda"],
  };
  if (!Object.hasOwn(allowed, action) || !allowed[action].includes(j?.status))
    throw Error("Status pekerjaan telah berubah.");
  const worker = activeWorker?.id === id ? activeWorker : null;
  if (!worker && j.status === "berjalan")
    throw Error("File sedang difinalisasi.");
  if (worker) {
    execFileSync(
      python,
      ["-B", "workers/render-control.py", String(worker.child.pid), action],
      { windowsHide: true, timeout: 6000 },
    );
    worker.paused = action === "pause";
    worker.cancelled = action === "cancel";
  }
  const state =
    action === "resume"
      ? worker
        ? "berjalan"
        : "menunggu"
      : action === "pause"
        ? "dijeda"
        : "dibatalkan";
  db.prepare("update job set status=? where id=?").run(state, id);
  res.json({ status: state });
  void drain();
});
async function drain() {
  if (busy) return;
  busy = true;
  try {
    let j;
    while (
      (j = db
        .prepare(
          "select * from job where status='menunggu' order by created limit 1",
        )
        .get())
    ) {
      const status = (state, p, msg = "") =>
        db
          .prepare("update job set status=?,progress=?,error=? where id=?")
          .run(state, p, msg, j.id);
      try {
        status("berjalan", 0);
        const s = source(j.source),
          settings = JSON.parse(j.settings);
        const input = file(s.id, ".source"),
          output = file(j.id, ".mp4");
        let lastProgress = 0;
        const progress = (p) => {
          if (Number.isFinite(p) && p > lastProgress) {
            status("berjalan", p);
            lastProgress = p;
          }
        };
        const assetMeta = (settings.assets || []).map(
          (id) =>
            db.prepare("select id,name from asset where id=?").get(id) || {
              id,
              name: "Foto pilihan",
            },
        );
        await renderJob(
          j.id,
          {
            input,
            output,
            settings: { ...settings, assetMeta },
            meta: s.meta,
            segments:
              JSON.parse(
                db
                  .prepare("select segments from render_transcript where job=?")
                  .get(j.id)?.segments || "null",
              ) ?? transcript(s.id).segments,
            assets: (settings.assets || []).map((id) => file(id, ".image")),
          },
          progress,
        );
        await metadata(file(j.id, ".mp4"));
        status("selesai", 100);
      } catch (e) {
        const cur = db.prepare("select status from job where id=?").get(j.id)?.status;
        if (!cur || cur === "dibatalkan") {
          for (const ext of [".mp4", ".mp4.assets.json", ".qc.json", ".rev.json"])
            rmSync(file(j.id, ext), { force: true });
        } else status("gagal", 0, e.message);
      }
    }
  } finally {
    busy = false;
  }
}
async function stopActiveJob(id) {
  const worker = activeWorker?.id === id ? activeWorker : null;
  if (!worker) return;
  worker.cancelled = true;
  const done = new Promise((r) => worker.child.once("exit", r));
  try {
    execFileSync(
      python,
      ["-B", "workers/render-control.py", String(worker.child.pid), "cancel"],
      { windowsHide: true, timeout: 6000 },
    );
  } catch {
    try {
      worker.child.kill("SIGKILL");
    } catch {}
  }
  await Promise.race([done, new Promise((r) => setTimeout(r, 4000))]);
}
registerHistoryRoutes({
  app,
  db,
  root,
  stopActiveJob,
  illustrationCounts,
  getActiveJobId: () => activeWorker?.id || null,
});
function insertJobs(sourceId, entries, segments = []) {
  for (const e of entries) {
    const assets = e.settings.assets || [];
    if (
      !Array.isArray(assets) ||
      assets.length > 3 ||
      assets.some((id) => !db.prepare("select id from asset where id=? and source=?").get(id, sourceId))
    ) {
      throw Error("Pilih maksimal tiga foto dari sumber ini.");
    }
  }
  db.exec("begin");
  try {
    for (const e of entries) {
      db.prepare("insert into job values(?,?,?,?,?,?,?)").run(
        e.id,
        sourceId,
        JSON.stringify(e.settings),
        "menunggu",
        0,
        "",
        Date.now(),
      );
      if (e.settings.preset !== "Manual") {
        const excerpt = segments.filter(
          (segment) => segment.end > e.settings.start && segment.start < e.settings.end,
        );
        db.prepare("insert into render_transcript values(?,?)").run(
          e.id,
          JSON.stringify(excerpt),
        );
      }
    }
    db.exec("commit");
  } catch (e) {
    db.exec("rollback");
    throw e;
  }
  void drain();
}
autoClipper({ app, db, source, transcript, file, insertJobs });
app.post("/api/source/:id/references",async(req,res)=>{
 const s=source(req.params.id),{start,end}=req.body;
 bounds(start,end,s.meta.duration);
 if(["local-only","disabled"].includes(process.env.ASSET_MODE))return res.json([]);
 const dir=mkdtempSync(path.resolve(".cache","research-"));
 try{res.json((await documentary(transcript(s.id).segments,start,end,dir)).map(({at,title,page,license,creator,sourceType,visualType})=>({at,title,page,license,creator,sourceType,visualType})));}finally{rmSync(dir,{recursive:true,force:true});}
});
app.post("/api/source/:id/strategy",(req,res)=>{
 const s=source(req.params.id), {start,end}=req.body;
 bounds(start,end,s.meta.duration);
 const segments=transcript(s.id).segments;
 const plan=analyze(segments,start,end);
 const name=req.body.preset==="Otomatis"?plan.suggestions[0]?.name:req.body.preset;
 const style=styles.find(s=>s.name===name);
 if(style){
   plan.scenes=styleScenes(segments,start,end,style);
   const dir=buildEditDecisionList(segments,start,end,style);
   plan.edl=dir.edl;
   plan.directorSummary=dir.directorSummary;
 }
 res.json(plan);
});
app.post("/api/render", (req, res) => {
  const s = source(req.body.source),
    clips = req.body.clips || [req.body];
  if (!Array.isArray(clips) || clips.length < 1 || clips.length > 10)
    throw Error("Pilih 1–10 klip.");
  const {
    preview = false,
    preset = "Manual",
    font = "Arial",
    color = "#caf784",
    position = "Bawah",
    zoom = 0.5,
    assets = [],
    subtitles = true,
    sourceLabel = "",
    watermark = "",
    watermarkCorner = "Kanan",
    watermarkFont = "Arial",
    watermarkStyle = "Klasik",
    watermarkOpacity = 0.7,
    autoIllustrate = false,
  } = req.body;
  if (
    typeof sourceLabel !== "string" ||
    sourceLabel.length > 90 ||
    typeof watermark !== "string" ||
    watermark.length > 48 ||
    ![
      "Kiri",
      "Kanan",
      "Tengah atas",
      "Kiri bawah",
      "Tengah bawah",
      "Kanan bawah",
    ].includes(watermarkCorner) ||
    !["Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"].includes(
      watermarkFont,
    ) ||
    !["Klasik", "Label", "Editorial"].includes(watermarkStyle) ||
    !Number.isFinite(watermarkOpacity) ||
    watermarkOpacity < 0.2 ||
    watermarkOpacity > 1
  )
    throw Error("Pengaturan kredit atau watermark tidak valid.");
  if (
    !["Manual", "Cinematic", "Stack Pop","Otomatis",...styles.map(s=>s.name)].includes(preset) ||
    !["Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"].includes(font) ||
    !/^#[a-f0-9]{6}$/i.test(color) ||
    !["Bawah", "Tengah", "Atas"].includes(position) ||
    !Number.isFinite(zoom) ||
    zoom < 0 ||
    zoom > 1
  )
    throw Error("Pengaturan preset tidak valid.");
  if (
    !Array.isArray(assets) ||
    assets.length > 3 ||
    assets.some(
      (id) =>
        !db
          .prepare("select id from asset where id=? and source=?")
          .get(id, s.id),
    )
  )
    throw Error("Pilih maksimal tiga foto dari sumber ini.");
  const variants=req.body.variants===true;
  if(variants && clips.length!==1) throw Error("Pilih satu rentang untuk tiga versi.");
  const renderClips=variants?Array(3).fill(clips[0]):clips;
  const advControls = normalizeEditingControls(req.body);
  const entries = renderClips.map(({ start, end, title }) => {
    bounds(start, end, s.meta.duration);
    return {
      id: randomUUID(),
      settings: {
        start,
        end,
        title: typeof title === "string" ? title.slice(0, 160) : undefined,
        preview: preview === true || advControls.exportQuality === "preview-360p",
        preset,
        font,
        color,
        position,
        zoom,
        assets,
        subtitles,
        ...advControls,
        approvedPages:Array.isArray(req.body.approvedPages)?req.body.approvedPages.filter(p=>typeof p==="string").slice(0,100):null,
        sourceLabel: sourceLabel.trim(),
        watermark: watermark.trim(),
        watermarkCorner,
        watermarkFont,
        watermarkStyle,
        watermarkOpacity,
        cameraFocus: ["auto", "left", "right", "center"].includes(req.body.cameraFocus) ? req.body.cameraFocus : "auto",
        autoIllustrate: autoIllustrate === true && preset !== "Manual",
      },
    };
  });
  const segments = preset === "Manual" && !variants ? [] : transcript(s.id).segments;
  for (const e of entries) {
    const voiceStyle = Object.hasOwn(VOICE_PRESETS, req.body.voiceStyle) ? req.body.voiceStyle : "Natural";
    const presetVoice = VOICE_PRESETS[voiceStyle];
    const voiceOptions = {
      voiceStyle,
      voiceRate: Number.isFinite(Number(req.body.voiceRate)) ? Math.max(-5, Math.min(5, Math.round(Number(req.body.voiceRate)))) : presetVoice.rate,
      voiceVolume: Number.isFinite(Number(req.body.voiceVolume)) ? Math.max(0.4, Math.min(1.5, Number(req.body.voiceVolume))) : 1,
      ducking: Number.isFinite(Number(req.body.ducking)) ? Math.max(0.1, Math.min(0.8, Number(req.body.ducking))) : presetVoice.ducking,
      voiceSync: ["intro", "hook", "scene", "custom"].includes(req.body.voiceSync) ? req.body.voiceSync : "intro",
      voiceStart: Number.isFinite(Number(req.body.voiceStart)) ? Math.max(0, Number(req.body.voiceStart)) : 0,
      clone: req.body.clone === true && existsSync(file(s.id, ".voice.wav")) && existsSync(file(s.id, ".voice.json")),
      narration: typeof req.body.narration === "string" ? req.body.narration.trim().slice(0, 500) : "",
    };
    if (variants || preset==="Otomatis" || styles.some(style=>style.name===preset)) {
      const plan = analyze(segments,e.settings.start,e.settings.end);
      const name=variants?plan.suggestions[entries.indexOf(e)].name:preset==="Otomatis"?plan.suggestions[0].name:preset;
      const style=styles.find(v=>v.name===name);
      plan.scenes=styleScenes(segments,e.settings.start,e.settings.end,style,e.settings.visualDensity);
      const dir=buildEditDecisionList(segments,e.settings.start,e.settings.end,style);
      plan.edl=dir.edl;
      plan.directorSummary=dir.directorSummary;
      Object.assign(e.settings,{preset:style.name,style,plan,...(req.body.customStyle===true?{}:{font:style.font,color:style.color,zoom:req.body.controlPreset?e.settings.zoom:style.zoom}),...voiceOptions});
    } else if (e.settings.preset !== "Manual") {
      Object.assign(e.settings, voiceOptions);
    }
  }
  insertJobs(s.id, entries, segments);
  res.json({ id: entries[0].id, ids: entries.map((e) => e.id) });
});
app.get("/api/export/:id/zip", (req, res) => {
  const rows = db
    .prepare(
      "select id from job where source=? and status='selesai' order by created",
    )
    .all(source(req.params.id).id);
  if (!rows.length) throw Error("Belum ada hasil render.");
  const zip = new yazl.ZipFile();
  res.attachment("klip-podcast.zip");
  zip.on("error", (e) => res.destroy(e));
  res.on("close", () => zip.outputStream.destroy());
  zip.outputStream.pipe(res);
  rows.forEach((r, i) =>
    zip.addFile(
      file(r.id, ".mp4"),
      "klip-" + (i + 1) + "-" + r.id.slice(0, 8) + ".mp4",
      { compress: false },
    ),
  );
  zip.end();
});
app.post("/api/job/:id/retry", (req, res) => {
  const result = db
    .prepare(
      "update job set status='menunggu',progress=0,error='' where id=? and status='gagal'",
    )
    .run(req.params.id);
  if (!result.changes) throw Error("Hanya pekerjaan gagal yang dapat diulang.");
  res.json({ ok: true });
  void drain();
});
app.get("/api/job/:id/illustrations", (req, res) => {
  const row = db
    .prepare("select id from job where id=? and status='selesai'")
    .get(req.params.id);
  if (!row || !existsSync(file(row.id, ".mp4.assets.json")))
    return res.sendStatus(404);
  res.attachment("sumber-ilustrasi.json").sendFile(row.id + ".mp4.assets.json", { root });
});
app.post("/api/job/:id/qc", async (req, res) => {
  const row = db.prepare("select * from job where id=?").get(req.params.id);
  if (!row) throw Error("Pekerjaan tidak ditemukan.");
  const settings = JSON.parse(row.settings);
  const segRow = db.prepare("select segments from render_transcript where job=?").get(row.id);
  const segments = segRow?.segments ? JSON.parse(segRow.segments) : [];
  let placedAssets = [];
  try {
    if (existsSync(file(row.id, ".mp4.assets.json"))) {
      placedAssets = JSON.parse(readFileSync(file(row.id, ".mp4.assets.json"), "utf8"));
    }
  } catch {}
  const report = await inspectRenderedVideo({
    videoPath: file(row.id, ".mp4"),
    settings,
    segments,
    placedAssets,
  });
  writeFileSync(file(row.id, ".qc.json"), JSON.stringify(report, null, 2));
  res.json(report);
});
app.post("/api/job/:id/revise", (req, res) => {
  const parentRow = db.prepare("select * from job where id=?").get(req.params.id);
  if (!parentRow) throw Error("Pekerjaan asal tidak ditemukan.");
  const s = source(parentRow.source);
  const parentSettings = JSON.parse(parentRow.settings);
  const segRow = db.prepare("select segments from render_transcript where job=?").get(parentRow.id);
  const baseSegments = segRow?.segments
    ? JSON.parse(segRow.segments)
    : transcript(s.id).segments.filter(
        (seg) => seg.end > parentSettings.start && seg.start < parentSettings.end,
      );

  const { nextSettings, nextSegments, changesApplied } = applyRevisionInstruction({
    instruction: req.body?.instruction || "",
    subtitleEdits: req.body?.subtitleEdits || [],
    settings: parentSettings,
    segments: baseSegments,
  });

  if (typeof req.body?.preview === "boolean") {
    nextSettings.preview = req.body.preview;
    nextSettings.exportQuality = req.body.preview ? "preview-360p" : "full-1080p";
  }

  const versionNumber = (Number(parentSettings.versionNumber) || 1) + 1;
  const newId = randomUUID();
  const baseTitle = (parentSettings.title || s.name).replace(/\s*·\s*Rev\s*\d+$/i, "");
  Object.assign(nextSettings, {
    title: `${baseTitle} · Rev ${versionNumber}`.slice(0, 160),
    parentJobId: parentRow.id,
    versionNumber,
    revisionInstruction: String(req.body?.instruction || "").slice(0, 300),
    changesApplied,
  });

  insertJobs(s.id, [{ id: newId, settings: nextSettings }], nextSegments);
  res.json({
    id: newId,
    parentJobId: parentRow.id,
    versionNumber,
    changesApplied,
  });
});
app.get("/api/job/:id/video", (req, res) => {
  const j = db
    .prepare("select id from job where id=? and status='selesai'")
    .get(req.params.id);
  if (!j || !existsSync(file(j.id, ".mp4"))) return res.sendStatus(404);
  if (req.query.download)
    res.attachment("klip-" + j.id.slice(0, 8) + ".mp4");
  res.sendFile(j.id + ".mp4", { root });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint API tidak ditemukan. Mulai ulang server studio." }),
);
app.use("/api", (err, _req, res, _next) =>
  res.status(400).json({ error: err.message }),
);
app.use((req, res) => web.getRequestHandler()(req, res));
app.listen(port, "127.0.0.1", () => {
  console.log("Podcast AI Editor http://127.0.0.1:" + port);
  void drain();
});
