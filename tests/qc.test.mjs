import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { validateAndRepairTimeline, inspectRenderedVideo } from "../server/qc.mjs";

test("auto-repair timeline memperbaiki font di luar safe area, tabrakan wajah, dan transisi terlalu cepat dengan batas percobaan", () => {
  const rawSettings = {
    start: 0,
    end: 10,
    position: "Tengah",
    zoom: 0.95,
    style: { size: 96, type: "meme" },
    plan: {
      scenes: [
        { at: 0.2, end: 0.6, action: "kutipan" },
        { at: 0.7, end: 1.2, action: "kutipan" },
        { at: 2.5, end: 4.5, action: "kutipan" },
        { at: 4.8, end: 5.3, action: "kutipan" },
        { at: 6.5, end: 8.5, action: "kutipan" },
        { at: 8.8, end: 9.2, action: "kutipan" },
      ],
    },
  };
  const track = [
    [0, 0.02, 0.5],
    [0.5, 0.96, 0.52],
  ];
  const r1 = validateAndRepairTimeline(rawSettings, [], track, 0, 2);
  assert.equal(r1.settings.position, "Bawah");
  assert.equal(r1.settings.subtitleSize, 76);
  assert.ok(r1.settings.plan.scenes.length < rawSettings.plan.scenes.length);
  assert.ok(r1.repairs.length >= 3);
  assert.equal(r1.repairAttempts, 1);

  // Batas percobaan mencegah infinite loop
  const rMax = validateAndRepairTimeline(rawSettings, [], track, 2, 2);
  assert.equal(rMax.repairs.length, 0);
  assert.equal(rMax.repairAttempts, 2);
});

test("inspectRenderedVideo memeriksa 12 aspek teknis & editorial pada MP4 nyata serta menandai klaim sensitif sebagai Needs Review", async () => {
  const sampleVideo = path.resolve("data/bukti/klip-manual.mp4");
  const cleanReport = await inspectRenderedVideo({
    videoPath: sampleVideo,
    settings: { start: 0, end: 2, preview: false, preset: "Manual", position: "Bawah" },
    segments: [{ start: 0, end: 2, text: "Kalimat lengkap dan jelas." }],
    track: [[0, 0.5, 0.45]],
  });
  assert.equal(cleanReport.checks.length, 12);
  assert.equal(cleanReport.status, "Passed");

  // Topik politik / klaim atau b-roll otomatis wajib diberi status Needs Review, bukan Passed
  const claimReport = await inspectRenderedVideo({
    videoPath: sampleVideo,
    settings: {
      start: 0,
      end: 2,
      preview: false,
      preset: "Clipper Konspirasi",
      style: { type: "konspirasi", size: 66 },
      plan: { scenes: [{ at: 0.2, end: 1.8, veracity: "klaim" }] },
    },
    segments: [{ start: 0, end: 2, text: "Katanya ada rumor rahasia" }],
    track: [],
    placedAssets: [{ sourceType: "Wikimedia Commons", query: "rumor" }],
  });
  assert.equal(claimReport.status, "Needs Review");
  assert.ok(claimReport.checks.some((c) => c.id === "factual_veracity" && c.status === "Needs Review"));
  assert.ok(claimReport.checks.some((c) => c.id === "broll_relevance" && c.status === "Needs Review"));

  // File tidak ada / rusak wajib berstatus Failed
  const failedReport = await inspectRenderedVideo({
    videoPath: path.resolve("data/bukti/tidak-ada.mp4"),
    settings: { start: 0, end: 2, preview: false },
  });
  assert.equal(failedReport.status, "Failed");
});
