import fs from "node:fs";
import { cut } from "../server/media.mjs";
import { film } from "../server/film.mjs";
import { inspectRenderedVideo } from "../server/qc.mjs";

const dir = process.argv[2];
const { input, output, settings, meta, segments, assets } = JSON.parse(
  fs.readFileSync(dir + "/job.json", "utf8"),
);
let last = -1;
const progress = (p) => {
  if (p !== last) {
    last = p;
    process.send?.({ progress: p });
  }
};
try {
  if (
    (settings.preset !== "Manual" && settings.preset) ||
    settings.watermark ||
    settings.sourceLabel
  )
    await film(input, output, settings, meta, segments, assets, progress, dir);
  else {
    await cut(input, output, settings, meta, progress);
    try {
      const qcReport = await inspectRenderedVideo({
        videoPath: output,
        settings,
        segments: segments || [],
      });
      fs.writeFileSync(output.replace(/\.mp4$/i, ".qc.json"), JSON.stringify(qcReport, null, 2));
    } catch {}
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
