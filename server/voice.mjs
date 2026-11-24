import fs from "node:fs";
import path from "node:path";
import { run } from "./media.mjs";
import { python } from "./transcript.mjs";

export const VOICE_PRESETS = {
  Natural: { rate: 0, volume: 100, ducking: 0.38, label: "Natural · Bahasa Indonesia (Ardi)" },
  Tenang: { rate: -2, volume: 95, ducking: 0.42, label: "Tenang · Kalem & Jelas" },
  Energik: { rate: 2, volume: 100, ducking: 0.32, label: "Energik · Cepat & Antusias" },
  Dokumenter: { rate: -2, volume: 100, ducking: 0.3, label: "Narator Dokumenter Wibawa" },
  Berita: { rate: 1, volume: 100, ducking: 0.34, label: "Pembawa Berita Tegas" },
  Storyteller: { rate: -1, volume: 98, ducking: 0.36, label: "Storyteller Hangat (Gadis)" },
};

export function computeVoiceOffset(syncMode = "intro", customStart = 0, groups = [], plan = null) {
  if (syncMode === "hook") return Math.max(0, groups?.[0]?.[0]?.start ?? 0);
  if (syncMode === "scene") return Math.max(0, plan?.scenes?.[0]?.at ?? 0);
  if (syncMode === "custom") return Math.max(0, Number.isFinite(Number(customStart)) ? Number(customStart) : 0);
  return 0;
}

export async function analyzeVoiceSample(samplePath) {
  try {
    const out = await run(python, ["-B", "workers/tts.py", "--analyze", samplePath]);
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

export async function narrate(text, dir, sample, style = "Natural", options = {}) {
  if (!text || process.env.TTS_MODE === "disabled") return false;
  const preset = VOICE_PRESETS[style] || VOICE_PRESETS.Natural;
  const rate = Number.isFinite(Number(options.rate))
    ? Math.max(-5, Math.min(5, Math.round(Number(options.rate))))
    : preset.rate;
  const volume = preset.volume;
  const endpoint = sample ? process.env.CLONE_URL : process.env.TTS_URL;
  if (process.env.TTS_MODE === "hybrid" && endpoint) {
    try {
      const form = new FormData();
      form.append("text", text);
      form.append("style", style);
      form.append("rate", String(rate));
      if (sample)
        form.append(
          "sample",
          new Blob([fs.readFileSync(sample)], { type: "audio/wav" }),
          "sample.wav",
        );
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
      if (response.ok) {
        const buffers = [];
        let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 16 * 1024 * 1024) throw Error("Audio terlalu besar");
          buffers.push(chunk);
        }
        const data = Buffer.concat(buffers);
        if (
          data.toString("ascii", 0, 4) === "RIFF" &&
          data.toString("ascii", 8, 12) === "WAVE"
        ) {
          fs.writeFileSync(path.join(dir, "narration.wav"), data);
          return true;
        }
      }
    } catch {
      /* Gunakan sintesis lokal. */
    }
  }

  const input = path.join(dir, "narration.txt");
  const outWav = path.join(dir, "narration.wav");
  fs.writeFileSync(input, text, "utf8");

  // Gunakan worker Python Bahasa Indonesia (id-ID Neural + pencocokan warna suara & nada sampel WAV lokal)
  try {
    await run(python, [
      "-B",
      path.resolve("workers/tts.py"),
      input,
      outWav,
      style,
      String(rate),
      sample && fs.existsSync(sample) ? sample : "none",
    ]);
    if (fs.existsSync(outWav)) return true;
  } catch {
    /* Fallback ke System.Speech PowerShell bila Python gagal. */
  }

  if (process.platform !== "win32") return false;
  try {
    await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.resolve("workers/narrate.ps1"),
      input,
      outWav,
      String(rate),
      String(volume),
    ]);
    return fs.existsSync(outWav);
  } catch {
    return false;
  }
}
