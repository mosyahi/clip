import { spawn } from "node:child_process";
import ff from "@ffmpeg-installer/ffmpeg";
import probe from "@ffprobe-installer/ffprobe";
import { existsSync } from "node:fs";
import path from "node:path";
function portable(name, fallback) {
  const executable = path.resolve(".cache", "ffmpeg", name + ".exe");
  return existsSync(executable) ? executable : fallback;
}
export const ffmpeg = process.env.FFMPEG_PATH || portable("ffmpeg", ff.path);
export const ffprobe =
  process.env.FFPROBE_PATH || portable("ffprobe", probe.path);

export function run(binary, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stdout = "",
      stderr = "",
      partial = "";
    child.stdout.on("data", (chunk) => {
      stdout = (stdout + chunk).slice(-2000000);
      const lines = (partial + chunk).split(/\r?\n/);
      partial = lines.pop();
      lines.forEach((line) => onLine?.(line));
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || "Proses gagal (" + code + ").")),
    );
  });
}
export async function metadata(path) {
  const info = JSON.parse(
    await run(ffprobe, [
      "-v",
      "error",
      "-show_format",
      "-protocol_whitelist",
      "file",
      "-f",
      "mov",
      "-show_streams",
      "-of",
      "json",
      path,
    ]),
  );
  const video = info.streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
  );
  const duration = Number(info.format.duration);
  if (
    !video ||
    !info.format.format_name.split(",").includes("mov") ||
    !(duration > 0 && duration <= 21600)
  )
    throw Error("Pilih MP4/MOV berdurasi maksimal 6 jam.");
  const rotation =
    video.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ??
    Number(video.tags?.rotate || 0);
  const rotated = Math.abs(rotation) % 180 === 90;
  return {
    videoIndex: video.index,
    width: rotated ? video.height : video.width,
    height: rotated ? video.width : video.height,
    duration,
    audio: info.streams.some((s) => s.codec_type === "audio"),
    size: Number(info.format.size),
    codec: video.codec_name,
  };
}
export function bounds(start, end, duration) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > duration + 0.001 ||
    end - start < 0.1
  )
    throw Error(
      "Rentang waktu harus berada di dalam video dan minimal 0,1 detik.",
    );
}
export async function cut(input, output, settings, meta, progress) {
  const { start, end, preview, exportQuality } = settings;
  bounds(start, end, meta.duration);
  const h = exportQuality === "hd-720p" ? 1280 : preview || exportQuality === "preview-360p" ? 640 : 1920,
    w = exportQuality === "hd-720p" ? 720 : preview || exportQuality === "preview-360p" ? 360 : 1080;
  const args = [
    "-nostdin",
    "-y",
    "-v",
    "error",
    "-ss",
    String(start),
    "-i",
    input,
  ];
  if (!meta.audio)
    args.push(
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
    );
  args.push(
    "-t",
    String(end - start),
    "-map",
    meta.videoIndex === undefined ? "0:v:0" : "0:" + meta.videoIndex,
    "-map",
    meta.audio ? "0:a:0" : "1:a:0",
    "-vf",
    `crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=${w}:${h},setsar=1,fps=30`,
    "-c:v",
    "libx264",
    "-threads",
    "4",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    output,
  );
  await run(ffmpeg, args, (line) => {
    if (line.startsWith("out_time_ms="))
      progress(
        Math.min(
          99,
          Math.max(
            0,
            Math.round(Number(line.slice(12)) / 10000 / (end - start)),
          ),
        ),
      );
  });
}
