import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { run, metadata, ffmpeg } from "./media.mjs";
import { python } from "./transcript.mjs";
import { downloadProgress } from "./youtube-progress.mjs";
export function youtubeURL(value) {
  const url = new URL(value),
    host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw Error("Gunakan tautan HTTPS YouTube.");
  let id;
  if (host === "youtu.be") id = url.pathname.slice(1);
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:shorts|live)\/([\w-]+)$/)?.[1];
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id || ""))
    throw Error("Tautan video YouTube tidak valid.");
  return "https://www.youtube.com/watch?v=" + id;
}
export function imports({ app, db, source, file, root }) {
  db.exec(
    "create table if not exists asset(id text primary key,source text,name text)",
  );
  const store = multer({
    defParamCharset: "utf8",
    storage: multer.diskStorage({
      destination: root,
      filename: (_r, _f, cb) => cb(null, randomUUID() + ".image"),
    }),
    limits: { fileSize: 12 * 1024 ** 2, files: 1, fields: 0 },
  });
  app.get("/api/source/:id/assets", (req, res) =>
    res.json(
      db
        .prepare("select id,name from asset where source=?")
        .all(source(req.params.id).id),
    ),
  );
  app.post(
    "/api/source/:id/assets",
    (req, _res, next) => {
      source(req.params.id);
      next();
    },
    store.single("image"),
    (req, res) => {
      if (!req.file) throw Error("Pilih foto JPEG atau PNG.");
      const id = path.parse(req.file.filename).name;
      try {
        const fd = fs.openSync(req.file.path, "r"),
          buf = Buffer.alloc(8);
        try {
          fs.readSync(fd, buf, 0, 8, 0);
        } finally {
          fs.closeSync(fd);
        }
        if (
          !buf.subarray(0, 3).equals(Buffer.from([255, 216, 255])) &&
          !buf.equals(Buffer.from("89504e470d0a1a0a", "hex"))
        )
          throw Error("Foto harus berupa JPEG atau PNG.");
        db.prepare("insert into asset values(?,?,?)").run(
          id,
          req.params.id,
          req.file.originalname,
        );
        res.json({ id });
      } catch (e) {
        fs.unlinkSync(req.file.path);
        throw e;
      }
    },
  );
  app.post("/api/youtube", async (req, res) => {
    if (req.body.rights !== true)
      throw Error("Konfirmasi izin penggunaan terlebih dahulu.");
    const url = youtubeURL(req.body.url),
      id = randomUUID(),
      dir = fs.mkdtempSync(path.join(root, "impor-"));
    const stream = req.get("Accept") === "application/x-ndjson";
    const send = (event) => {
      if (stream && !res.destroyed) res.write(JSON.stringify(event) + "\n");
    };
    if (stream) {
      res.type("application/x-ndjson");
      res.flushHeaders();
      send({ stage: "Memeriksa tautan", percent: 0 });
    }
    let measure,
      latest = { percent: 0, bytes: 0 };
    try {
      const dest = path.join(dir, "video.%(ext)s");
      await run(
        python,
        [
          "-B",
          "-m",
          "yt_dlp",
          "--ignore-config",
          "--js-runtimes",
          "node:" + process.execPath,
          "--no-playlist",
          "--newline",
          "--progress",
          "--progress-template",
          "download:BYTES|%(info.format_id)s|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s",
          "--progress-delta",
          "0.25",
          "--no-cache-dir",
          "--socket-timeout",
          "20",
          "--retries",
          "1",
          "--match-filter",
          "!is_live & duration <= 21600",
          "--max-filesize",
          "4G",
          "--ffmpeg-location",
          ffmpeg,
          "-f",
          "bv[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]",
          "--merge-output-format",
          "mp4",
          "--write-info-json",
          "-o",
          dest,
          "--",
          url,
        ],
        (line) => {
          if (!stream) return;
          if (line.startsWith("BYTES|")) {
            if (!measure) {
              try {
                const info = JSON.parse(
                  fs.readFileSync(path.join(dir, "video.info.json"), "utf8"),
                );
                measure = downloadProgress(info);
              } catch {
                return;
              }
            }
            const [, format, bytes, total] = line.split("|");
            latest = measure(format, bytes, total);
            send({ stage: "Mengunduh media", ...latest });
          } else if (line.startsWith("[Merger]")) {
            send({ stage: "Menggabungkan video dan audio", ...latest });
          }
        },
      );
      send({ stage: "Memeriksa file video", ...latest });
      const input = path.join(dir, "video.mp4");
      if (!fs.existsSync(input) || fs.statSync(input).size > 4 * 1024 ** 3)
        throw Error("Video tidak tersedia atau melewati batas ukuran/durasi.");
      const meta = await metadata(input),
        info = JSON.parse(
          fs.readFileSync(path.join(dir, "video.info.json"), "utf8"),
        );
      fs.renameSync(input, file(id, ".source"));
      db.prepare("insert into source values(?,?,?,?)").run(
        id,
        info.title || "YouTube",
        JSON.stringify(meta),
        Date.now(),
      );
      if (stream) {
        send({ id, stage: "Video siap digunakan", percent: 100 });
        res.end();
      } else res.json({ id });
    } catch (error) {
      if (!stream) throw error;
      send({ error: error.message });
      res.end();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
