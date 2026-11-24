import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ffmpeg, metadata, run, ffprobe } from "../server/media.mjs";
const base = "http://127.0.0.1:" + (process.env.PORT || 3210) + "/api/";
mkdirSync("data/bukti", { recursive: true });
const input = "data/bukti/sumber-sintetis.mp4";
await run(ffmpeg, [
  "-y",
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=640x360:rate=30",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440",
  "-t",
  "4",
  "-c:v",
  "libx264",
  "-c:a",
  "aac",
  input,
]);
async function request(url, opts) {
  const r = await fetch(base + url, opts);
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
}
const form = new FormData();
form.append("video", new Blob([readFileSync(input)]), "Uji sintetis.mp4");
const src = await request("source", { method: "POST", body: form });
const options = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source: src.id, start: 0.5, end: 2.5 }),
};
const job = await request("render", options);
for (let k = 0; k < 120; k++) {
  const state = await request("state");
  const j = state.jobs.find((j) => j.id === job.id);
  assert.notEqual(j.status, "gagal", j.error);
  if (j.status === "selesai") break;
  await new Promise((r) => setTimeout(r, 500));
}
const r = await fetch(base + "job/" + job.id + "/video?download=1");
assert.equal(r.status, 200);
const out = "data/bukti/klip-manual.mp4";
writeFileSync(out, Buffer.from(await r.arrayBuffer()));
const m = await metadata(out);
assert.equal(m.width, 1080);
assert.equal(m.height, 1920);
assert.ok(Math.abs(m.duration - 2) < 0.1);
await run(ffmpeg, ["-v", "error", "-i", out, "-f", "null", "-"]);
console.log(
  await run(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,width,height,r_frame_rate",
    "-of",
    "compact",
    out,
  ]),
);
assert.equal(
  (
    await fetch(base + "job/" + job.id + "/video", {
      headers: { Range: "bytes=0-31" },
    })
  ).status,
  206,
);
console.log(
  "Lulus upload, metadata, render, decode, download dan Range.",
  job.id,
);
