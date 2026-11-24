import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ffprobe, ffmpeg, run } from "../server/media.mjs";

const dir = fs.mkdtempSync(path.resolve(".cache/auto-clipper-e2e-"));
const port = 34318;
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
    if (server.exitCode !== null) throw Error("Server stopped");
    const result = await fn();
    if (result) return result;
    await sleep();
  }
  throw Error("Timed out");
}

try {
  await wait(async () => (await api("state").catch(() => null))?.ok);

  // 1. Input MP4 nyata
  const f = new FormData();
  f.append("video", new Blob([fs.readFileSync("data/bukti/ujaran-indonesia.mp4")]), "ujaran.mp4");
  const up = await api("source", f);
  assert.equal(up.ok, true);
  const sourceId = up.json.id;

  // 2. Plan sebelum transkrip -> memicu transkripsi otomatis (HTTP 202)
  const initialPlan = await api("auto-clipper/plan", {
    source: sourceId,
    language: "id",
    workflow: "review",
    min: 15,
    count: 3,
    versionCount: 2,
    autoNarrate: true,
  });
  assert.equal(initialPlan.status, 202);
  assert.equal(initialPlan.json.status, "transcribing");

  await wait(async () => {
    const tr = await api("source/" + sourceId + "/transcript");
    if (tr.json.status === "gagal") throw Error(tr.json.error);
    return tr.json.status === "selesai";
  });

  // 3. Review Mode Plan sesudah transkrip
  const reviewPlan = await api("auto-clipper/plan", {
    source: sourceId,
    language: "id",
    workflow: "review",
    min: 15,
    count: 3,
    versionCount: 2,
    autoNarrate: true,
  });
  assert.equal(reviewPlan.ok, true);
  assert.equal(reviewPlan.json.status, "review");
  assert.ok(reviewPlan.json.plan.clips.length >= 1);
  const firstClip = reviewPlan.json.plan.clips[0];
  assert.equal(firstClip.versions.length, 2);
  assert.ok(firstClip.hook && firstClip.retentionScore > 0);

  // 4. Eksekusi 2 versi edit dari klip pertama (Review -> Render MP4)
  const exec = await api("auto-clipper/execute", {
    source: sourceId,
    clips: [firstClip],
    preview: true,
    autoIllustrate: true,
  });
  assert.equal(exec.ok, true);
  assert.equal(exec.json.ids.length, 2);

  await wait(async () => {
    const st = await api("state");
    for (const j of st.json.jobs) if (j.status === "gagal") throw Error(j.error);
    return st.json.jobs.filter((j) => exec.json.ids.includes(j.id) && j.status === "selesai").length === 2;
  });

  for (const jobId of exec.json.ids) {
    const vid = await fetch("http://127.0.0.1:" + port + "/api/job/" + jobId + "/video");
    assert.equal(vid.status, 200);
    const outPath = path.join(dir, jobId + ".mp4");
    fs.writeFileSync(outPath, Buffer.from(await vid.arrayBuffer()));
    const streams = JSON.parse(
      await run(ffprobe, ["-v", "error", "-show_streams", "-of", "json", outPath]),
    ).streams;
    assert.ok(streams.some((s) => s.codec_name === "h264" && s.width === 360 && s.height === 640));
    assert.ok(streams.some((s) => s.codec_name === "aac"));
    await run(ffmpeg, ["-v", "error", "-i", outPath, "-f", "null", "-"]);
  }

  // 5. Uji Full Auto mode (1 versi)
  const fullAuto = await api("auto-clipper/plan", {
    source: sourceId,
    workflow: "full-auto",
    editMode: "Viral aggressive",
    min: 15,
    count: 3,
    versionCount: 1,
    preview: true,
    autoIllustrate: true,
  });
  assert.equal(fullAuto.ok, true);
  assert.equal(fullAuto.json.status, "queued");
  assert.ok(fullAuto.json.ids.length >= 1);

  console.log("Super Auto Clipper E2E (Upload -> Whisper -> Highlight -> Multi-Version Review -> Full Auto -> Render MP4) LULUS.");
} finally {
  if (server.exitCode === null) {
    const done = new Promise((r) => server.once("exit", r));
    server.kill();
    await done;
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 4 });
}
