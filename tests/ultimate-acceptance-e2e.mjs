import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ffprobe, ffmpeg, run } from "../server/media.mjs";

const dir = fs.mkdtempSync(path.resolve(".cache/ultimate-acceptance-e2e-"));
const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), "user-original-video-"));
const externalUserFile = path.join(externalDir, "podcast-asli-user.mp4");
fs.copyFileSync(path.resolve("data/bukti/ujaran-indonesia.mp4"), externalUserFile);

const port = 34329;
const server = spawn(process.execPath, ["server/index.mjs", "--production"], {
  windowsHide: true,
  env: { ...process.env, PORT: String(port), DATA_DIR: dir, ASSET_MODE: "local-only" },
  stdio: "ignore",
});

const sleep = () => new Promise((r) => setTimeout(r, 800));
async function api(route, data) {
  const form = data instanceof FormData;
  const r = await fetch("http://127.0.0.1:" + port + "/api/" + route, {
    method: data ? "POST" : "GET",
    headers: data && !form ? { "Content-Type": "application/json" } : {},
    body: data ? (form ? data : JSON.stringify(data)) : undefined,
  });
  const json = await r.json();
  return { status: r.status, ok: r.ok, json };
}

async function wait(fn, maxLoops = 500) {
  for (let i = 0; i < maxLoops; i++) {
    if (server.exitCode !== null) throw Error("Server stopped unexpectedly");
    const result = await fn();
    if (result) return result;
    await sleep();
  }
  throw Error("Timed out waiting for condition");
}

try {
  await wait(async () => (await api("state").catch(() => null))?.ok);

  // 1. Upload MP4 dari file asli user di luar DATA_DIR
  const f = new FormData();
  f.append("video", new Blob([fs.readFileSync(externalUserFile)]), "podcast-asli-user.mp4");
  const up = await api("source", f);
  assert.equal(up.ok, true, "Upload MP4 harus berhasil");
  const sourceId = up.json.id;

  // 2. Transkripsi & Generate Highlights
  const startTr = await api("source/" + sourceId + "/transcript", { language: "id" });
  assert.equal(startTr.ok, true);
  await wait(async () => {
    const tr = await api("source/" + sourceId + "/transcript");
    if (tr.json.status === "gagal") throw Error(tr.json.error);
    return tr.json.status === "selesai";
  });

  const hl = await api("source/" + sourceId + "/highlights", { min: 15, count: 3 });
  assert.equal(hl.ok, true);
  assert.ok(Array.isArray(hl.json.clips) && hl.json.clips.length >= 1, "Highlights harus ditemukan");
  const clip = hl.json.clips[0];

  // Verifikasi AI Video Director Engine pada rentang highlight
  const strategy = await api("source/" + sourceId + "/strategy", {
    start: clip.start,
    end: clip.end,
    preset: "Clipper Podcast",
  });
  assert.equal(strategy.ok, true);
  assert.ok(Array.isArray(strategy.json.edl) && strategy.json.edl.length > 0, "AI Video Director EDL harus tersedia");

  // 3. Render 2 style berbeda (Clipper Podcast & Clipper Game)
  const render1 = await api("render", {
    source: sourceId,
    start: clip.start,
    end: clip.end,
    preset: "Clipper Podcast",
    controlPreset: "Balanced",
    preview: true,
    autoIllustrate: true,
    safeArea: "TikTok",
    title: "Klip 1 Podcast",
  });
  assert.equal(render1.ok, true);

  const render2 = await api("render", {
    source: sourceId,
    start: clip.start,
    end: clip.end,
    preset: "Clipper Game",
    controlPreset: "Viral Dynamic",
    preview: true,
    autoIllustrate: true,
    safeArea: "Reels",
    title: "Klip 2 Game",
  });
  assert.equal(render2.ok, true);

  const initialJobIds = [render1.json.id, render2.json.id];
  await wait(async () => {
    const st = await api("state");
    for (const j of st.json.jobs) if (j.status === "gagal") throw Error(j.error);
    return st.json.jobs.filter((j) => initialJobIds.includes(j.id) && j.status === "selesai").length === 2;
  });

  // 4. QC Video pada kedua hasil render
  for (const jobId of initialJobIds) {
    const qcRes = await api("job/" + jobId + "/qc", {});
    assert.equal(qcRes.ok, true, "Endpoint QC harus berhasil");
    assert.ok(["Passed", "Needs Review"].includes(qcRes.json.status), `Status QC tidak boleh Failed: ${qcRes.json.status}`);
    assert.equal(qcRes.json.checks.length, 12, "Harus memeriksa 12 aspek QC");
  }

  // 5. Revisi style tanpa mentranskripsi ulang (Smart Revision Engine)
  const trFileMtimeBefore = fs.statSync(path.join(dir, sourceId + ".json")).mtimeMs;
  const revRes = await api("job/" + render1.json.id + "/revise", {
    instruction: "Ubah style menjadi documentary dan perbesar subtitle serta kurangi zoom",
    preview: true,
  });
  assert.equal(revRes.ok, true, "Revisi harus berhasil diantrekan");
  assert.equal(revRes.json.parentJobId, render1.json.id);
  assert.equal(revRes.json.versionNumber, 2);
  assert.ok(revRes.json.changesApplied.length >= 2);
  const revisedJobId = revRes.json.id;

  await wait(async () => {
    const st = await api("state");
    const j = st.json.jobs.find((x) => x.id === revisedJobId);
    if (j?.status === "gagal") throw Error(j.error);
    return j?.status === "selesai";
  });
  const trFileMtimeAfter = fs.statSync(path.join(dir, sourceId + ".json")).mtimeMs;
  assert.equal(trFileMtimeAfter, trFileMtimeBefore, "File transkrip tidak boleh diproses ulang saat revisi");

  const revDetail = await api("history");
  assert.equal(revDetail.ok, true);
  const revItem = revDetail.json.items.find((x) => x.id === revisedJobId);
  assert.ok(revItem, "Revised job harus ada di daftar riwayat");
  assert.equal(revItem.settings.preset, "Clipper Documentary");
  assert.equal(revItem.settings.parentJobId, render1.json.id);

  // 6. Download MP4 hasil revisi & validasi stream H.264 + AAC
  const dl = await fetch("http://127.0.0.1:" + port + "/api/job/" + revisedJobId + "/video?download=1");
  assert.equal(dl.status, 200);
  const dlPath = path.join(externalDir, "downloaded-revised.mp4");
  fs.writeFileSync(dlPath, Buffer.from(await dl.arrayBuffer()));
  const streams = JSON.parse(
    await run(ffprobe, ["-v", "error", "-show_streams", "-of", "json", dlPath]),
  ).streams;
  assert.ok(streams.some((s) => s.codec_name === "h264"), "Video terunduh harus memiliki stream H.264");
  assert.ok(streams.some((s) => s.codec_name === "aac"), "Video terunduh harus memiliki stream AAC");
  await run(ffmpeg, ["-v", "error", "-i", dlPath, "-f", "null", "-"]);

  // Buat 1 job tambahan agar bisa menguji Single Delete -> Bulk Delete -> Delete All
  const render3 = await api("render", {
    source: sourceId,
    start: clip.start,
    end: clip.end,
    preset: "Clipper Quotes",
    preview: true,
    title: "Klip 3 Quotes",
  });
  assert.equal(render3.ok, true);
  await wait(async () => {
    const st = await api("state");
    const j = st.json.jobs.find((x) => x.id === render3.json.id);
    if (j?.status === "gagal") throw Error(j.error);
    return j?.status === "selesai";
  });

  // Total jobs saat ini = 4 (render1, render2, revisedJobId, render3)
  const stBeforeDelete = await api("state");
  assert.equal(stBeforeDelete.json.jobs.length, 4);

  // 7. Hapus 1 riwayat (Single Delete Mode B)
  const delSingle = await api("history/delete", {
    jobIds: [render2.json.id],
    mode: "B",
    confirm: true,
  });
  assert.equal(delSingle.ok, true);
  assert.equal(delSingle.json.deletedJobsCount, 1);
  assert.equal(fs.existsSync(path.join(dir, render2.json.id + ".mp4")), false, "File MP4 single delete harus terhapus");

  // 8. Hapus beberapa riwayat (Bulk Delete Mode B)
  const delBulk = await api("history/delete", {
    jobIds: [render1.json.id, revisedJobId],
    mode: "B",
    confirm: true,
  });
  assert.equal(delBulk.ok, true);
  assert.equal(delBulk.json.deletedJobsCount, 2);

  // 9. Hapus semua riwayat (Delete All Mode C + konfirmasi hapus salinan sumber)
  const delAll = await api("history/delete", {
    deleteAll: true,
    mode: "C",
    confirm: true,
    confirmSourceDelete: true,
  });
  assert.equal(delAll.ok, true);
  assert.equal(delAll.json.deletedJobsCount, 1);
  assert.equal(delAll.json.deletedSourcesCount, 1, "Salinan sumber di dalam DATA_DIR harus ikut dibersihkan pada Mode C");

  // 10. Pastikan file asli user di luar folder aplikasi TIDAK terhapus
  assert.equal(fs.existsSync(externalUserFile), true, "File sumber asli user di luar DATA_DIR tidak boleh terhapus");
  assert.ok(fs.statSync(externalUserFile).size > 100000, "File sumber asli user harus tetap utuh");

  // 11. Pastikan tidak ada job atau source tersisa di database
  const stFinal = await api("state");
  assert.equal(stFinal.json.jobs.length, 0, "Tidak boleh ada job tersisa setelah Delete All");
  assert.equal(stFinal.json.sources.length, 0, "Tidak boleh ada source tersisa setelah Delete All Mode C");

  console.log("QUALITY ACCEPTANCE TEST (11/11 STEPS) PASSED!");
} finally {
  server.kill();
  await new Promise((r) => server.once("close", r));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(externalDir, { recursive: true, force: true });
}
