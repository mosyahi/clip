import path from "node:path";
import fs from "node:fs";
import { ffmpeg, run } from "./media.mjs";
export const python =
  process.env.PYTHON_PATH || path.resolve(".venv/Scripts/python.exe");
const stamp = (n) =>
  new Date(Math.round(n * 1000)).toISOString().slice(11, 23).replace(".", ",");
export function subtitleWords(seg) {
  if (seg.words?.length) return seg.words;
  const tokens = seg.text.trim().split(/\s+/),
    step = (seg.end - seg.start) / tokens.length;
  return tokens.map((text, i) => ({
    text,
    start: seg.start + i * step,
    end: seg.start + (i + 1) * step,
  }));
}
export function transcripts({ app, db, source, file }) {
  db.exec(
    "create table if not exists transcript(source text primary key,status text,progress integer,error text,content text); update transcript set status='gagal', error='Transkripsi terhenti. Silakan ulangi.' where status='berjalan'",
  );
  const row = (id) =>
    db.prepare("select * from transcript where source=?").get(id);
  function save(id, data) {
    const srt = data.segments
      .map(
        (s, i) =>
          i +
          1 +
          "\n" +
          stamp(s.start) +
          " --> " +
          stamp(s.end) +
          "\n" +
          s.text +
          "\n",
      )
      .join("\n");
    fs.writeFileSync(file(id, ".json"), JSON.stringify(data, null, 2));
    fs.writeFileSync(file(id, ".srt"), srt);
    db.prepare(
      "update transcript set content=?,status='selesai',progress=100,error='' where source=?",
    ).run(JSON.stringify(data), id);
  }
  async function processAudio(s, language) {
    const wav = file(s.id, ".wav"),
      temp = file(s.id, ".partial.json");
    try {
      await run(ffmpeg, [
        "-nostdin",
        "-y",
        "-v",
        "error",
        "-i",
        file(s.id, ".source"),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        wav,
      ]);
      if(process.env.TRANSCRIPT_MODE==="hybrid" && process.env.TRANSCRIPT_URL){
        try{
          const body=new FormData();
          body.append("audio",await fs.openAsBlob(wav,{type:"audio/wav"}),"audio.wav");
          body.append("language",language);
          const r=await fetch(process.env.TRANSCRIPT_URL,{method:"POST",body,redirect:"error",signal:AbortSignal.timeout(120000)});
          if(!r.ok)throw Error("Provider gagal");
          const result=await r.json();
          if(!Array.isArray(result.segments)||!result.segments.every(seg=>typeof seg.text==="string"&&Number.isFinite(seg.start)&&Number.isFinite(seg.end)&&seg.start>=0&&seg.end>seg.start&&seg.end<=s.meta.duration+.1))throw Error("Transkrip tidak valid");
          save(s.id,{language,segments:result.segments.map(({start,end,text})=>({start,end,text}))});
          return;
        }catch{/* Whisper lokal menangani kegagalan provider. */}
      }
      await run(
        python,
        ["-B", "workers/transcribe.py", wav, language, temp],
        (l) => {
          if (/^\d+$/.test(l))
            db.prepare("update transcript set progress=? where source=?").run(
              Math.min(+l, 99),
              s.id,
            );
        },
      );
      save(s.id, JSON.parse(fs.readFileSync(temp, "utf8")));
    } catch (e) {
      db.prepare(
        "update transcript set status='gagal',error=? where source=?",
      ).run(e.message, s.id);
    } finally {
      for (const f of [wav, temp]) if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
  app.get("/api/source/:id/transcript", (req, res) => {
    const t = row(source(req.params.id).id);
    res.json(
      t
        ? {
            status: t.status,
            progress: t.progress,
            error: t.error,
            ...JSON.parse(t.content || "{}"),
          }
        : { status: "baru" },
    );
  });
  function start(s, language = "id") {
    if (process.env.TRANSCRIPT_MODE === "disabled")
      throw Error("Provider transkrip dinonaktifkan.");
    if (!s.meta.audio || !["id", "en", "auto"].includes(language))
      throw Error("Periksa bahasa dan kanal audio.");
    const running = db.prepare("select source from transcript where status='berjalan'").get();
    if (running) {
      if (running.source === s.id) return { alreadyRunning: true };
      throw Error("Transkripsi lain sedang berjalan.");
    }
    db.prepare(
      "insert into transcript values(?,'berjalan',0,'',null) on conflict(source) do update set status='berjalan',progress=0,error=''",
    ).run(s.id);
    void processAudio(s, language);
    return { started: true };
  }
  app.post("/api/source/:id/transcript", (req, res) => {
    const s = source(req.params.id),
      language = req.body?.language || "id";
    const info = start(s, language);
    if (info.alreadyRunning) throw Error("Transkripsi lain sedang berjalan.");
    res.json({ ok: true });
  });
  app.put("/api/source/:id/transcript", (req, res) => {
    const s = source(req.params.id),
      t = row(s.id);
    if (t?.status !== "selesai") throw Error("Transkrip belum siap.");
    const data = JSON.parse(t.content),
      { index, text } = req.body;
    if (
      !Number.isInteger(index) ||
      !data.segments[index] ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 4000
    )
      throw Error("Koreksi subtitle tidak valid.");
    const seg = data.segments[index];
    seg.text = text.trim();
    seg.words = subtitleWords({ ...seg, words: [] });
    save(s.id, data);
    res.json({ ok: true });
  });
  app.get("/api/source/:id/subtitles", (req, res) => {
    const s = source(req.params.id);
    if (!row(s.id)?.content) return res.sendStatus(404);
    res.download(file(s.id, ".srt"));
  });
  const read = (id) => JSON.parse(row(id)?.content || '{"segments":[]}');
  read.start = start;
  read.status = (id) => row(id);
  return read;
}
