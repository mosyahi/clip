import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { narrate, VOICE_PRESETS, computeVoiceOffset } from "../server/voice.mjs";
import { validateCloneUpload } from "../server/voice-studio.mjs";

const validWav = (() => {
  const wav = Buffer.alloc(46);
  wav.write("RIFF");
  wav.writeUInt32LE(38, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(2, 40);
  return wav;
})();

test("adapter menerima WAV dari endpoint kloning yang dikonfigurasi", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clip-voice-"));
  const sample = path.join(dir, "consent.wav");
  fs.writeFileSync(sample, validWav);
  let sent = false;
  const server = createServer(async (req, res) => {
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    const data = Buffer.concat(parts);
    sent = data.includes('name="sample"') && data.includes('name="text"');
    res.setHeader("Content-Type", "audio/wav");
    res.end(validWav);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const oldMode = process.env.TTS_MODE,
    oldUrl = process.env.CLONE_URL;
  try {
    process.env.TTS_MODE = "hybrid";
    process.env.CLONE_URL = "http://127.0.0.1:" + server.address().port;
    assert.equal(await narrate("Tes", dir, sample), true);
    assert.ok(sent);
    assert.deepEqual(fs.readFileSync(path.join(dir, "narration.wav")), validWav);
  } finally {
    for (const [k, v] of Object.entries({ TTS_MODE: oldMode, CLONE_URL: oldUrl }))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    await new Promise((r) => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("preset narator, sintesis TTS lokal, dan perhitungan offset sinkronisasi voice-over", async () => {
  assert.ok(Object.keys(VOICE_PRESETS).length >= 6);
  for (const name of ["Natural", "Tenang", "Energik", "Dokumenter", "Berita", "Storyteller"]) {
    assert.ok(VOICE_PRESETS[name]);
  }
  const groups = [[{ start: 1.4, end: 2.0, text: "Halo" }]];
  const plan = { scenes: [{ at: 2.8, end: 5.0 }] };
  assert.equal(computeVoiceOffset("intro", 3, groups, plan), 0);
  assert.equal(computeVoiceOffset("hook", 3, groups, plan), 1.4);
  assert.equal(computeVoiceOffset("scene", 3, groups, plan), 2.8);
  assert.equal(computeVoiceOffset("custom", 3.5, groups, plan), 3.5);

  if (process.platform === "win32") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clip-tts-"));
    try {
      const ok = await narrate("Selamat datang di studio podcast lokal.", dir, null, "Dokumenter", { rate: -1 });
      assert.equal(ok, true);
      const out = fs.readFileSync(path.join(dir, "narration.wav"));
      assert.equal(out.toString("ascii", 0, 4), "RIFF");
      assert.equal(out.toString("ascii", 8, 12), "WAVE");
      assert.ok(out.length > 1000);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("kloning suara menolak tanpa izin eksplisit atau deklarasi anti-peniruan", () => {
  assert.throws(() => validateCloneUpload({ consent: "no", ownerName: "Budi", relationship: "self", nonImpersonation: "yes" }, validWav));
  assert.throws(() => validateCloneUpload({ consent: "yes", ownerName: "", relationship: "self", nonImpersonation: "yes" }, validWav));
  assert.throws(() => validateCloneUpload({ consent: "yes", ownerName: "Budi", relationship: "self", nonImpersonation: "no" }, validWav));
  assert.throws(() => validateCloneUpload({ consent: "yes", ownerName: "Budi", relationship: "other", nonImpersonation: "yes" }, validWav));
  assert.throws(() => validateCloneUpload({ consent: "yes", ownerName: "Budi", relationship: "self", nonImpersonation: "yes" }, Buffer.from("NOT_WAV")));

  const rec = validateCloneUpload(
    { consent: "yes", ownerName: "Budi Santoso", relationship: "authorized", nonImpersonation: "yes" },
    validWav,
  );
  assert.equal(rec.ownerName, "Budi Santoso");
  assert.equal(rec.relationship, "authorized");
  assert.equal(rec.nonImpersonationDeclared, true);
});
