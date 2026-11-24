import fs from "node:fs";
import { narrate, computeVoiceOffset, VOICE_PRESETS } from "./voice.mjs";
import path from "node:path";
import express from "express";
import { createHash } from "node:crypto";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ffmpeg, ffprobe, run } from "./media.mjs";
import { python, subtitleWords } from "./transcript.mjs";
import { documentary } from "./documentary.mjs";
import { validateAndRepairTimeline, inspectRenderedVideo } from "./qc.mjs";
let bundled;
export async function film(
  input,
  output,
  s,
  meta,
  segments,
  assets,
  progress,
  workspace = ".cache",
) {
  fs.mkdirSync(".cache", { recursive: true });
  const dir = fs.mkdtempSync(path.resolve(workspace, "film-"));
  let server;
  try {
    const duration = s.end - s.start,
      clip = path.join(dir, "source.mp4");
    const args = [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-ss",
      String(s.start),
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
    await run(ffmpeg, [
      ...args,
      "-t",
      String(duration),
      "-map",
      meta.videoIndex === undefined ? "0:v:0" : "0:" + meta.videoIndex,
      "-map",
      meta.audio ? "0:a:0" : "1:a:0",
      "-c:v",
      "libx264",
      "-threads",
      "4",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      ...(s.preset === "Manual"
        ? []
        : [
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=" +
              Math.max(0, duration - 0.08) +
              ":d=0.08",
            "-ar",
            "48000",
          ]),
      clip,
    ]);
    let track = [];
    try {
      if (s.preset !== "Manual" || (s.cameraFocus && s.cameraFocus !== "center"))
        track = JSON.parse(
          await run(python, [
            "-B",
            "workers/track.py",
            clip,
            "0",
            String(duration),
            s.cameraFocus || "auto",
          ]),
        );
    } catch {
      /* Gunakan crop tengah saat deteksi wajah gagal. */
    }
    const autoRepaired = validateAndRepairTimeline(s, segments, track, s.repairAttempts || 0, 2);
    s = autoRepaired.settings;
    track = autoRepaired.track;
    const cards = [];
    if (s.preset === "Stack Pop" || s.style) {
      for (let i = 0; i < Math.min(3, assets.length); i++) {
        const name = "card" + i + ".jpg";
        await run(ffmpeg, [
          "-nostdin",
          "-y",
          "-v",
          "error",
          "-i",
          assets[i],
          "-frames:v",
          "1",
          "-vf",
          "scale=480:-2",
          path.join(dir, name),
        ]);
        if (fs.existsSync(path.join(dir, name))) cards.push(name);
      }
    }
    const app = express();
    app.use(express.static(dir));
    server = await new Promise((resolve, reject) => {
      const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
      srv.on("error", reject);
    });
    const base = "http://127.0.0.1:" + server.address().port + "/";
    const shots = s.autoIllustrate && !cards.length && !["local-only","disabled"].includes(process.env.ASSET_MODE)
      ? (await documentary(segments, s.start, s.end, dir)).filter(item=>!s.approvedPages || s.approvedPages.includes(item.page))
      : [];
    if(s.style && cards.length) {
      const scenes = s.plan?.scenes || [];
      const usedScenes = new Set();
      for (let i = 0; i < cards.length; i++) {
        const rawName = (s.assetMeta?.[i]?.name || path.basename(assets[i] || "Foto pilihan")).replace(/\.[^.]+$/, "");
        const nameTokens = new Set(rawName.toLowerCase().match(/[\p{L}\d]{3,}/gu) || []);
        let bestIdx = scenes.findIndex((sc, idx) => !usedScenes.has(idx) && [...nameTokens].some((t) => (sc.query + " " + sc.label).toLowerCase().includes(t)));
        if (bestIdx === -1) bestIdx = scenes.findIndex((_, idx) => !usedScenes.has(idx));
        const scene = bestIdx !== -1 ? scenes[bestIdx] : { at: Math.min(Math.max(0, duration - 1.5), i * 4), visualType: "foto" };
        if (bestIdx !== -1) usedScenes.add(bestIdx);
        shots.push({
          at: scene.at,
          name: cards[i],
          title: rawName || "Foto pilihan",
          creator: "Aset Lokal Pengguna",
          license: "Berizin pengguna",
          sourceType: "Aset Lokal",
          visualType: scene.visualType === "b-roll" ? "b-roll" : "foto",
          query: "local",
        });
      }
      shots.sort((a, b) => a.at - b.at);
    }
    const groups = [];
    for (const seg of segments) {
      const words = subtitleWords(seg)
        .filter((w) => w.end > s.start && w.start < s.end)
        .map((w) => ({
          ...w,
          start: Math.max(0, w.start - s.start),
          end: Math.min(duration, w.end - s.start),
        }));
      let phrase = [];
      for (const word of words) {
        const last = phrase.at(-1);
        if (
          last &&
          (word.start - last.end > 0.42 ||
            /[.!?,;:]$/.test(last.text) ||
            phrase.length >= (s.style?.words || 5) ||
            [...phrase, word].map((w) => w.text).join(" ").length > 30)
        ) {
          groups.push(phrase);
          phrase = [];
        }
        phrase.push(word);
      }
      if (phrase.length) groups.push(phrase);
    }
    const tail=groups.at(-1), lead=groups.at(-2);
    if(!s.style?.overlayVocabulary&&tail&&lead&&tail.length<=2&&tail[0].start-lead.at(-1).end<.35 && [...lead,...tail].map(w=>w.text).join(" ").length<=43){
      lead.push(...tail);groups.pop();
    }
    let voiceDuration=0;
    const voiceSample = s.clone ? input.replace(/\.source$/,".voice.wav") : null;
    if(await narrate(s.narration,dir,voiceSample,s.voiceStyle,{rate:s.voiceRate})){
      try{voiceDuration=Number(await run(ffprobe,["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",path.join(dir,"narration.wav")]));}catch{/* Audio sumber tersedia. */}
    }
    const voiceOffset = voiceDuration > 0
      ? Math.min(Math.max(0, duration - 0.5), computeVoiceOffset(s.voiceSync, s.voiceStart, groups, s.plan))
      : 0;
    const voiceVolume = Number.isFinite(Number(s.voiceVolume)) ? Math.max(0.4, Math.min(1.5, Number(s.voiceVolume))) : 1;
    const ducking = Number.isFinite(Number(s.ducking)) ? Math.max(0.1, Math.min(0.8, Number(s.ducking))) : (VOICE_PRESETS[s.voiceStyle]?.ducking ?? 0.38);
    const visibleShots=[];
    const brollFreq = Number.isFinite(Number(s.brollFrequency)) ? Number(s.brollFrequency) : 0.6;
    const minShotGap = Math.max(2.6, 5.2 - 2.6 * brollFreq);
    if (brollFreq > 0.02) {
      for(const shot of shots){
        if(visibleShots.length && shot.at-visibleShots.at(-1).at<minShotGap)continue;
        visibleShots.push(shot);
      }
    }
    if (s.plan?.scenes?.length && Number.isFinite(Number(s.motionDensity))) {
      const md = Math.max(0, Math.min(1, Number(s.motionDensity)));
      const maxMotion = Math.max(md > 0 ? 1 : 0, Math.ceil(s.plan.scenes.length * md));
      s = { ...s, plan: { ...s.plan, scenes: s.plan.scenes.slice(0, maxMotion) } };
    }
    let hasBgm = false;
    const bgmVol = Number(s.bgmVolume || 0);
    const sfxAmp = Number(s.sfxIntensity || 0);
    if (!s.preset || s.preset !== "Manual") {
      if (bgmVol > 0.01 || sfxAmp > 0.05) {
        try {
          await run(ffmpeg, [
            "-nostdin",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=110:duration=${duration}`,
            "-af",
            `lowpass=f=320,volume=${Math.max(0.03, bgmVol * 0.35 + sfxAmp * 0.04)},afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5`,
            path.join(dir, "bgm.wav"),
          ]);
          hasBgm = fs.existsSync(path.join(dir, "bgm.wav"));
        } catch {}
      }
    }
    const renderScale =
      s.exportQuality === "hd-720p"
        ? 2 / 3
        : s.exportQuality === "preview-360p" || s.preview
          ? 1 / 3
          : 1;
    const inputProps = {
      frames: Math.max(1, Math.round(duration * 30)),
      url: base + "source.mp4",
      groups,
      shots: visibleShots.map((shot) => ({ ...shot, url: shot.name ? base + shot.name : "" })),
      track,
      cards: cards.map((n) => base + n),
      settings: s,
      voice:voiceDuration>0?base+"narration.wav":undefined,voiceDuration,voiceOffset,voiceVolume,ducking,
      bgm: hasBgm ? base + "bgm.wav" : undefined,
      bgmVolume: hasBgm ? Math.max(0.05, bgmVol || 0.08) : 0,
      aspect: meta.width / meta.height,
    };
    if (!bundled) {
      const key = createHash("sha256")
        .update(fs.readFileSync("composition/index.jsx"))
        .update(fs.readFileSync("composition/Callout.jsx"))
        .update(fs.readFileSync("composition/StyleLayer.jsx"))
        .update(fs.readFileSync("package-lock.json"))
        .digest("hex")
        .slice(0, 16);
      const out = path.resolve(".cache", "composition-" + key);
      if (!fs.existsSync(path.join(out, "ready"))) {
        await run(process.execPath, ["workers/bundle.mjs", out]);
        fs.writeFileSync(path.join(out, "ready"), "ok");
      }
      bundled = out;
    }
    const composition = await selectComposition({
      serveUrl: bundled,
      id: "Podcast",
      inputProps,
    });
    await renderMedia({
      serveUrl: bundled,
      composition,
      inputProps,
      outputLocation: output,
      codec: "h264",
      audioCodec: "aac",
      concurrency: 2,
      scale: renderScale,
      onProgress: ({ progress: p }) =>
        progress(Math.min(99, Math.floor(p * 100))),
    });
    let placedAssets = [];
    if (s.autoIllustrate || (s.style && (visibleShots.length || s.plan?.scenes?.length))) {
      const mediaPlacements = visibleShots.map(({ name, ...item }) => item);
      const motionGraphicPlacements = (s.plan?.scenes || [])
        .filter((sc) => ["grafik", "motion"].includes(sc.visualType) && !visibleShots.some((v) => Math.abs(v.at - sc.at) < 2))
        .map((sc) => ({
          at: sc.at,
          title: sc.headline || sc.label,
          query: sc.query,
          visualType: sc.visualType,
          sourceType: sc.recommendedSource || "Overlay Internal",
          license: "Dibangkitkan dari transkrip",
          veracity: sc.veracity,
        }));
      placedAssets = [...mediaPlacements, ...motionGraphicPlacements];
      fs.writeFileSync(
        output + ".assets.json",
        JSON.stringify(placedAssets, null, 2),
      );
    }
    try {
      const qcReport = await inspectRenderedVideo({
        videoPath: output,
        settings: s,
        segments,
        track,
        placedAssets,
        repairs: autoRepaired.repairs,
        repairAttempts: autoRepaired.repairAttempts,
        maxRepairAttempts: 2,
      });
      fs.writeFileSync(output.replace(/\.mp4$/i, ".qc.json"), JSON.stringify(qcReport, null, 2));
    } catch {}
  } finally {
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}
