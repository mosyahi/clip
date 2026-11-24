import assert from "node:assert/strict";
import test from "node:test";
import { applyRevisionInstruction } from "../server/revision.mjs";

const sampleSegments = [
  { start: 0, end: 4, text: "Banyak orang tidak sadar tentang inflasi tahun ini." },
  { start: 4.1, end: 8.2, text: "Padahal dampaknya terasa langsung pada tabungan harian kita." },
  { start: 8.3, end: 12.5, text: "Strategi terbaik adalah diversifikasi aset secara konsisten." },
];

const baseSettings = {
  start: 0,
  end: 12.5,
  preset: "Clipper Podcast",
  font: "Plus Jakarta Sans",
  color: "#d4ff47",
  position: "Bawah",
  subtitleSize: 66,
  zoom: 0.55,
  sfxIntensity: 0.65,
  bgmVolume: 0.35,
  brollFrequency: 0.5,
  visualDensity: 0.5,
  autoIllustrate: true,
};

test("Smart Revision Engine parses natural language instructions and updates settings & subtitles without re-transcribing", () => {
  // 1. Enlarge subtitle & reduce zoom
  const rev1 = applyRevisionInstruction({
    instruction: "Perbesar subtitle dan kurangi zoom",
    settings: baseSettings,
    segments: sampleSegments,
  });
  assert.ok(rev1.nextSettings.subtitleSize > baseSettings.subtitleSize, "Subtitle size must increase");
  assert.ok(rev1.nextSettings.zoom < baseSettings.zoom, "Zoom must decrease");
  assert.equal(rev1.nextSegments.length, sampleSegments.length, "Transcript segments preserved without re-transcription");

  // 2. Make cinematic & reduce SFX
  const rev2 = applyRevisionInstruction({
    instruction: "Buat lebih cinematic dan kurangi sound effect",
    settings: baseSettings,
    segments: sampleSegments,
  });
  assert.equal(rev2.nextSettings.controlPreset, "Cinematic");
  assert.ok(rev2.nextSettings.sfxIntensity <= 0.25, "SFX intensity reduced");

  // 3. Change style to documentary & add relevant visuals
  const rev3 = applyRevisionInstruction({
    instruction: "Ubah style menjadi documentary dan tambahkan visual yang relevan",
    settings: baseSettings,
    segments: sampleSegments,
  });
  assert.equal(rev3.nextSettings.preset, "Clipper Documentary");
  assert.equal(rev3.nextSettings.autoIllustrate, true);
  assert.ok(rev3.nextSettings.brollFrequency > baseSettings.brollFrequency);
  assert.ok(Array.isArray(rev3.nextSettings.plan?.scenes) && rev3.nextSettings.plan.scenes.length > 0);
  assert.ok(rev3.nextSettings.plan?.edl?.length > 0);

  // 4. Fix subtitle at specific timestamp
  const rev4 = applyRevisionInstruction({
    instruction: 'Perbaiki subtitle pada 0:06 menjadi "Padahal dampaknya sangat besar bagi tabungan kita."',
    settings: baseSettings,
    segments: sampleSegments,
  });
  assert.equal(
    rev4.nextSegments[1].text,
    "Padahal dampaknya sangat besar bagi tabungan kita.",
    "Segment overlapping 0:06 must be updated",
  );
  assert.ok(
    rev4.nextSegments[1].words.some((w) => String(w.text || w.word || "").includes("tabungan")),
    "Subtitle words rebuilt from updated segments",
  );
});
