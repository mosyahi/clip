import assert from "node:assert/strict";
import fs from "node:fs";
import { ffmpeg, ffprobe, run } from "../server/media.mjs";
const base = "http://127.0.0.1:" + (process.env.PORT || 3210) + "/api/";
async function call(url, method = "GET", body) {
  const form = body instanceof FormData;
  const r = await fetch(base + url, {
    method,
    headers: body && !form ? { "Content-Type": "application/json" } : {},
    body: form ? body : JSON.stringify(body),
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const pause = () => new Promise((r) => setTimeout(r, 1000));
async function wait(load, done) {
  for (let i = 0; i < 900; i++) {
    const v = await load();
    assert.notEqual(v.status, "gagal", v.error);
    if (done(v)) return v;
    await pause();
  }
  throw Error("Batas waktu pengujian");
}
const media = "data/bukti/ujaran-indonesia.mp4";
if (!fs.existsSync(media)) {
  await run(ffmpeg, [
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=480x270:rate=15",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "data/bukti/gabung.txt",
    "-shortest",
    "-c:v",
    "libx264",
    "-threads",
    "3",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    media,
  ]);
}
const form = new FormData();
form.append(
  "video",
  new Blob([fs.readFileSync(media)]),
  "Uji ujaran Indonesia · FLEURS.mp4",
);
const { id } = await call("source", "POST", form),
  route = "source/" + id + "/";
await call(route + "transcript", "POST", { language: "id" });
const tr = await wait(
  () => call(route + "transcript"),
  (v) => v.status === "selesai",
);
assert.ok(tr.segments.length > 1 && tr.segments.some((s) => s.words.length));
console.log(
  "Transkripsi Indonesia:",
  tr.segments.length,
  "segmen.",
  tr.segments[0].text,
);
assert.match(await (await fetch(base + route + "subtitles")).text(), /-->/);
await call(route + "transcript", "PUT", {
  index: 0,
  text: tr.segments[0].text,
});
const rec = await call(route + "highlights", "POST", { count: 3, min: 15 });
assert.ok(rec.clips.length >= 1);
console.log(
  rec.mode,
  rec.clips.map((c) => [c.start, c.end]),
);
const photo = "data/bukti/foto-uji.jpg";
await run(ffmpeg, ["-y", "-v", "error", "-i", media, "-frames:v", "1", photo]);
const image = new FormData();
image.append("image", new Blob([fs.readFileSync(photo)]), "Frame sumber.jpg");
const asset = await call(route + "assets", "POST", image);
const start = tr.segments[0].start,
  end = start + 2.6;
for (const preset of ["Cinematic", "Stack Pop"]) {
  const { ids } = await call("render", "POST", {
    source: id,
    preset,
    clips:
      preset === "Stack Pop"
        ? [
            { start, end },
            { start: end, end: end + 1 },
          ]
        : [{ start, end }],
    assets: preset === "Stack Pop" ? [asset.id] : [],
  });
  for (const [i, job] of ids.entries()) {
    await wait(
      async () => (await call("state")).jobs.find((j) => j.id === job),
      (v) => v.status === "selesai",
    );
    const r = await fetch(base + "job/" + job + "/video");
    assert.equal(r.status, 200);
    const out =
      "data/bukti/" +
      preset.toLowerCase().replace(" ", "-") +
      (i ? "-2" : "") +
      ".mp4";
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    const streams = JSON.parse(
      await run(ffprobe, ["-v", "error", "-show_streams", "-of", "json", out]),
    ).streams;
    assert.ok(
      streams.some(
        (s) =>
          s.codec_name === "h264" &&
          s.width === 1080 &&
          s.height === 1920 &&
          s.r_frame_rate === "30/1",
      ),
    );
    assert.ok(streams.some((s) => s.codec_name === "aac"));
    await run(ffmpeg, ["-v", "error", "-i", out, "-f", "null", "-"]);
    console.log("Lulus", out);
  }
}
const zip = await fetch(base + "export/" + id + "/zip");
assert.equal(zip.status, 200);
fs.writeFileSync("data/bukti/hasil.zip", Buffer.from(await zip.arrayBuffer()));
console.log("ZIP disimpan.", id);
