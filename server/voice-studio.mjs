import multer from "multer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { narrate, analyzeVoiceSample, VOICE_PRESETS } from "./voice.mjs";

const DOWNLOADS_TEST_WAV = path.join(os.homedir(), "Downloads", "test.wav");

function readConsent(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function validateCloneUpload(body, bytes) {
  if (body?.consent !== "yes")
    throw Error("Konfirmasi izin pemilik suara terlebih dahulu.");
  const ownerName = typeof body?.ownerName === "string" ? body.ownerName.trim() : "";
  if (ownerName.length < 2 || ownerName.length > 80)
    throw Error("Isi nama pemilik suara yang memberi izin (minimal 2 huruf).");
  const relationship = body?.relationship;
  if (!["self", "authorized"].includes(relationship))
    throw Error("Pilih dasar izin pemilik suara (suara sendiri atau izin eksplisit tertulis).");
  if (body?.nonImpersonation !== "yes")
    throw Error("Konfirmasi bahwa sampel tidak digunakan untuk meniru suara orang lain tanpa izin.");
  if (
    bytes?.toString("ascii", 0, 4) !== "RIFF" ||
    bytes?.toString("ascii", 8, 12) !== "WAVE"
  )
    throw Error("Gunakan sampel WAV.");
  return {
    ownerName,
    relationship,
    nonImpersonationDeclared: true,
    consentedAt: new Date().toISOString(),
  };
}

export function voiceStudio({ app, source, file }) {
  const upload = multer({ limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

  app.post("/api/source/:id/voice", upload.single("sample"), async (req, res) => {
    const id = source(req.params.id).id;
    const bytes = req.file?.buffer;
    const record = validateCloneUpload(req.body, bytes);
    const wavPath = file(id, ".voice.wav");
    fs.writeFileSync(wavPath, bytes);
    const voiceProfile = await analyzeVoiceSample(wavPath);
    const fullRecord = { ...record, voiceProfile };
    fs.writeFileSync(file(id, ".voice.json"), JSON.stringify(fullRecord, null, 2));
    res.json({ saved: true, consentMeta: fullRecord });
  });

  app.post("/api/source/:id/voice/from-downloads", async (req, res) => {
    const id = source(req.params.id).id;
    if (!fs.existsSync(DOWNLOADS_TEST_WAV))
      throw Error("File Downloads/test.wav tidak ditemukan.");
    const stat = fs.statSync(DOWNLOADS_TEST_WAV);
    if (stat.size > 8 * 1024 * 1024)
      throw Error("Ukuran test.wav melebihi batas 8 MB.");
    const bytes = fs.readFileSync(DOWNLOADS_TEST_WAV);
    const record = validateCloneUpload(req.body, bytes);
    const wavPath = file(id, ".voice.wav");
    fs.writeFileSync(wavPath, bytes);
    const voiceProfile = await analyzeVoiceSample(wavPath);
    const fullRecord = { ...record, sourceFile: "Downloads/test.wav", voiceProfile };
    fs.writeFileSync(file(id, ".voice.json"), JSON.stringify(fullRecord, null, 2));
    res.json({ saved: true, consentMeta: fullRecord });
  });

  app.get("/api/source/:id/voice", async (req, res) => {
    const id = source(req.params.id).id;
    const wavPath = file(id, ".voice.wav");
    const hasSample = fs.existsSync(wavPath);
    let consentMeta = readConsent(file(id, ".voice.json"));
    if (hasSample && consentMeta && !consentMeta.voiceProfile) {
      const voiceProfile = await analyzeVoiceSample(wavPath);
      if (voiceProfile) {
        consentMeta = { ...consentMeta, voiceProfile };
        fs.writeFileSync(file(id, ".voice.json"), JSON.stringify(consentMeta, null, 2));
      }
    }
    res.json({
      sample: hasSample && !!consentMeta,
      clone: true,
      cloneMode:
        process.env.TTS_MODE === "hybrid" && process.env.CLONE_URL
          ? "Endpoint Kloning Eksternal"
          : "Kemiripan Warna Suara & Nada Lokal",
      consentMeta,
      downloadsTestWav: fs.existsSync(DOWNLOADS_TEST_WAV),
    });
  });

  app.delete("/api/source/:id/voice", (req, res) => {
    const id = source(req.params.id).id;
    for (const ext of [".voice.wav", ".voice.json"]) {
      if (fs.existsSync(file(id, ext))) fs.unlinkSync(file(id, ext));
    }
    res.json({ deleted: true });
  });

  app.post("/api/voice/preview", async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 500) : "";
    if (!text) throw Error("Isi teks narasi terlebih dahulu.");
    const style = Object.hasOwn(VOICE_PRESETS, req.body?.voiceStyle) ? req.body.voiceStyle : "Natural";
    const rate = Number.isFinite(Number(req.body?.voiceRate)) ? Number(req.body.voiceRate) : VOICE_PRESETS[style].rate;
    let samplePath = null;
    if (req.body?.clone === true && typeof req.body?.source === "string" && req.body.source) {
      const id = source(req.body.source).id;
      if (fs.existsSync(file(id, ".voice.wav")) && fs.existsSync(file(id, ".voice.json"))) {
        samplePath = file(id, ".voice.wav");
      }
    }
    fs.mkdirSync(".cache", { recursive: true });
    const dir = fs.mkdtempSync(path.resolve(".cache/voice-preview-"));
    try {
      const ok = await narrate(text, dir, samplePath, style, { rate });
      const wav = path.join(dir, "narration.wav");
      if (!ok || !fs.existsSync(wav))
        throw Error("Sintesis suara lokal tidak tersedia pada lingkungan ini.");
      res.type("audio/wav").send(fs.readFileSync(wav));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
