import test from "node:test";
import assert from "node:assert/strict";
import { buildAutoClipperPlan, buildRenderEntriesFromPlan } from "../server/auto-clipper.mjs";

const sampleSegments = [
  { start: 0, end: 9, text: "Mengapa sejarah arsip museum abad pertengahan sangat penting?" },
  { start: 9.2, end: 19, text: "Karena inflasi naik 12% pada tahun 2024 dan tercatat di dokumen resmi." },
  { start: 22, end: 31, text: "Bagaimana cara belajar coding game dengan cepat?" },
  { start: 31.2, end: 40, text: "Pertama buat prototipe kecil lalu uji tiap level bersama pemain." },
  { start: 43, end: 52, text: "Kenapa investasi saham jangka panjang berbeda dari trading harian?" },
  { start: 52.2, end: 61, text: "Saham vs obligasi memiliki profil risiko yang berbeda setiap tahun." },
];

test("Super Auto Clipper menyusun rencana lengkap dengan beberapa versi edit dan visual planning", async () => {
  const plan = await buildAutoClipperPlan({
    sourceId: "src-1",
    sourceName: "podcast-uji.mp4",
    duration: 65,
    segments: sampleSegments,
    options: {
      min: 15,
      count: 3,
      versionCount: 3,
      editMode: "Documentary rich",
      autoNarrate: true,
    },
  });
  assert.equal(plan.stages.length, 6);
  assert.equal(plan.clips.length, 3);
  for (const c of plan.clips) {
    assert.equal(c.versions.length, 3);
    assert.equal(c.versions[0].preset, "Clipper Documentary");
    assert.equal(new Set(c.versions.map((v) => v.preset)).size, 3);
    assert.ok(c.versions[0].narration.length > 10);
    assert.ok(c.versions[0].scenes.length >= 1);
  }
});

test("buildRenderEntriesFromPlan hanya mengantrekan versi terpilih untuk dirender", async () => {
  const plan = await buildAutoClipperPlan({
    sourceId: "src-1",
    sourceName: "podcast-uji.mp4",
    duration: 65,
    segments: sampleSegments,
    options: { min: 15, count: 3, versionCount: 2, editMode: "Otomatis" },
  });
  plan.clips[0].versions[1].selected = false;
  const subset = [plan.clips[0]];
  const entries = buildRenderEntriesFromPlan({
    sourceId: "src-1",
    duration: 65,
    segments: sampleSegments,
    items: subset,
    shared: { preview: true, autoIllustrate: true, watermark: "@uji" },
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].settings.preset, plan.clips[0].versions[0].preset);
  assert.equal(entries[0].settings.watermark, "@uji");
  assert.equal(entries[0].settings.preview, true);
});
