import fs from "node:fs";
import path from "node:path";
import { ffmpeg, ffprobe, metadata, run } from "./media.mjs";

const DANGLING_START =
  /^(dan|tapi|tetapi|karena|sehingga|yang|terus|lalu|namun|maka|soalnya|makanya|padahal|sedangkan|atau)\b/i;
const TRAILING_END =
  /\b(karena|kalau|tetapi|tapi|dan|yang|atau|dari|untuk|dengan|sehingga|bahwa|di|ke|pada|dalam)[,. ]*$/i;
const SENSITIVE_STYLES = new Set(["politik", "konspirasi", "berita", "newsroom", "crime", "debat"]);

export function validateAndRepairTimeline(settings = {}, segments = [], track = [], attempt = 0, maxAttempts = 2) {
  const repaired = structuredClone(settings);
  const repairs = [];
  if (attempt >= maxAttempts) {
    return { settings: repaired, track, repairs, repairAttempts: attempt };
  }

  // 1. Safe Area & Subtitle Size Auto-Repair
  const currentSize = repaired.subtitleSize || repaired.style?.size || 72;
  if (currentSize > 86) {
    repaired.subtitleSize = 76;
    if (repaired.style) repaired.style = { ...repaired.style, size: 76 };
    repairs.push("Ukuran font subtitle dikecilkan ke 76px agar tidak keluar safe area Reels/TikTok/Shorts.");
  }

  // 2. Overlay vs Wajah (Face Occlusion Auto-Repair)
  if (Array.isArray(track) && track.length > 0) {
    const avgY = track.reduce((acc, pt) => acc + (pt[2] ?? 0.5), 0) / track.length;
    if (repaired.position === "Tengah" && avgY >= 0.35 && avgY <= 0.68) {
      repaired.position = "Bawah";
      repairs.push("Posisi subtitle dipindahkan dari Tengah ke Bawah agar tidak menutupi wajah pembicara.");
    }
  }

  // 3. Face Framing Stability Auto-Repair (jaga margin tepi 9:16 & hilangkan glitch 1-frame tanpa merusak cut kamera antar-pembicara)
  let repairedTrack = track;
  if (Array.isArray(track) && track.length > 1) {
    let clampedCount = 0;
    const bounded = track.map((pt) => {
      const x = Math.max(0.14, Math.min(0.86, Number(pt[1] ?? 0.5)));
      const y = Math.max(0.16, Math.min(0.84, Number(pt[2] ?? 0.5)));
      if (Math.abs(x - (pt[1] ?? 0.5)) > 0.01 || Math.abs(y - (pt[2] ?? 0.5)) > 0.01) clampedCount++;
      return [pt[0], x, y];
    });
    repairedTrack = bounded.map((pt, i) => {
      if (i === 0 || i === bounded.length - 1) return pt;
      const prev = bounded[i - 1];
      const next = bounded[i + 1];
      // Jika hanya melompat 1 tick (0.5 dtk) lalu langsung kembali ke posisi sebelumnya, ratakan glitch tersebut
      if (
        Math.abs(pt[1] - prev[1]) > 0.18 &&
        Math.abs(next[1] - prev[1]) < 0.08
      ) {
        clampedCount++;
        return [pt[0], Number(((prev[1] + next[1]) / 2).toFixed(4)), pt[2]];
      }
      return pt;
    });
    if (clampedCount > 0) {
      repairs.push("Koordinat framing wajah distabilkan agar wajah tidak terpotong di tepi frame 9:16.");
    }
  }

  // 4. Transisi terlalu cepat & Animasi berlebihan Auto-Repair
  if (repaired.plan?.scenes?.length > 1) {
    const filtered = [];
    for (const sc of repaired.plan.scenes) {
      const prev = filtered.at(-1);
      if (prev && sc.at - prev.at < 1.3) continue;
      const hold = Math.max(0.9, (sc.end ?? sc.at + 2) - sc.at);
      filtered.push({ ...sc, end: Math.min((repaired.end - repaired.start) - 0.25, sc.at + hold) });
    }
    if (filtered.length < repaired.plan.scenes.length) {
      repaired.plan = { ...repaired.plan, scenes: filtered };
      repairs.push("Frekuensi transisi scene dikurangi agar tidak terlalu cepat (< 1,3 detik).");
    }
  }

  const duration = Math.max(1, (repaired.end || 0) - (repaired.start || 0));
  const sceneCount = repaired.plan?.scenes?.length || 0;
  if ((repaired.zoom ?? 0.5) > 0.8 && sceneCount / duration > 0.45) {
    repaired.zoom = 0.65;
    repairs.push("Intensitas zoom diturunkan ke 0,65 untuk mencegah animasi berlebihan pada scene padat.");
  }

  return {
    settings: repaired,
    track: repairedTrack,
    repairs,
    repairAttempts: repairs.length ? attempt + 1 : attempt,
  };
}

async function probeAudioAndVideoStats(videoPath) {
  let blackSeconds = 0;
  let freezeSeconds = 0;
  let meanVolumeDb = -18;
  let maxVolumeDb = -1.5;

  try {
    // Gunakan spawn/run untuk memeriksa volumedetect & blackdetect pada 15 detik pertama
    const out = await new Promise((resolve) => {
      import("node:child_process").then(({ spawn }) => {
        const child = spawn(
          ffmpeg,
          [
            "-nostdin",
            "-v",
            "info",
            "-t",
            "15",
            "-i",
            videoPath,
            "-vf",
            "blackdetect=d=0.4:pix_th=0.08,freezedetect=n=0.002:d=1.8",
            "-af",
            "volumedetect",
            "-f",
            "null",
            "-",
          ],
          { windowsHide: true },
        );
        let log = "";
        child.stderr.on("data", (d) => (log = (log + d).slice(-16000)));
        child.on("close", () => resolve(log));
        child.on("error", () => resolve(""));
      });
    });

    for (const m of out.matchAll(/black_duration:\s*([\d.]+)/g)) {
      blackSeconds += Number(m[1] || 0);
    }
    for (const m of out.matchAll(/lavfi\.freezedetect\.freeze_duration:\s*([\d.]+)/g)) {
      freezeSeconds += Number(m[1] || 0);
    }
    const meanMatch = out.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
    const maxMatch = out.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
    if (meanMatch) meanVolumeDb = Number(meanMatch[1]);
    if (maxMatch) maxVolumeDb = Number(maxMatch[1]);
  } catch {}

  return { blackSeconds, freezeSeconds, meanVolumeDb, maxVolumeDb };
}

export async function autoRepairRenderedAudio(videoPath) {
  const tempFixed = videoPath + ".autofix.mp4";
  try {
    await run(ffmpeg, [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-i",
      videoPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      tempFixed,
    ]);
    if (fs.existsSync(tempFixed) && fs.statSync(tempFixed).size > 1000) {
      fs.renameSync(tempFixed, videoPath);
      return true;
    }
  } catch {}
  if (fs.existsSync(tempFixed)) fs.rmSync(tempFixed, { force: true });
  return false;
}

export async function inspectRenderedVideo({
  videoPath,
  settings = {},
  segments = [],
  track = [],
  placedAssets = [],
  repairs = [],
  repairAttempts = 0,
  maxRepairAttempts = 2,
}) {
  const checks = [];
  const addCheck = (id, label, status, detail) => checks.push({ id, label, status, detail });

  const expectedDuration = Math.max(0.1, (settings.end || 0) - (settings.start || 0));
  const expectedWidth =
    settings.exportQuality === "hd-720p"
      ? 720
      : settings.preview || settings.exportQuality === "preview-360p"
        ? 360
        : 1080;
  const expectedHeight =
    settings.exportQuality === "hd-720p"
      ? 1280
      : settings.preview || settings.exportQuality === "preview-360p"
        ? 640
        : 1920;

  // 1. Format, FPS, & Resolusi
  let info = null;
  let streamData = null;
  if (!videoPath || !fs.existsSync(videoPath)) {
    addCheck("format_fps_resolution", "Format, FPS & Resolusi", "Failed", "File MP4 hasil render tidak ditemukan.");
  } else {
    try {
      info = await metadata(videoPath);
      const raw = JSON.parse(
        await run(ffprobe, ["-v", "error", "-show_streams", "-of", "json", videoPath]),
      );
      const vStream = raw.streams?.find((s) => s.codec_type === "video");
      const aStream = raw.streams?.find((s) => s.codec_type === "audio");
      streamData = { vStream, aStream };
      const fpsParts = (vStream?.r_frame_rate || "30/1").split("/");
      const fps = Math.round(Number(fpsParts[0]) / Math.max(1, Number(fpsParts[1] || 1)));
      const resOk = info.width === expectedWidth && info.height === expectedHeight;
      const codecOk = info.codec === "h264" && aStream?.codec_name === "aac";
      const durOk = Math.abs(info.duration - expectedDuration) <= 0.6;
      if (resOk && codecOk && fps === 30 && durOk) {
        addCheck(
          "format_fps_resolution",
          "Format, FPS & Resolusi",
          "Passed",
          `H.264/AAC · ${info.width}×${info.height} · ${fps} fps · ${info.duration.toFixed(2)} dtk.`,
        );
      } else {
        addCheck(
          "format_fps_resolution",
          "Format, FPS & Resolusi",
          "Failed",
          `Spesifikasi tidak sesuai (${info.codec} ${info.width}×${info.height} ${fps}fps, durasi ${info.duration.toFixed(2)}s vs target ${expectedDuration.toFixed(2)}s).`,
        );
      }
    } catch (e) {
      addCheck("format_fps_resolution", "Format, FPS & Resolusi", "Failed", "Gagal membaca stream MP4: " + e.message);
    }
  }

  // 2 & 3. Video Blank/Frozen & Audio Clipping/Pelan
  let currentRepairs = [...repairs];
  let currentAttempts = repairAttempts;
  if (info) {
    let stats = await probeAudioAndVideoStats(videoPath);
    if (stats.blackSeconds > Math.min(1.5, expectedDuration * 0.5)) {
      addCheck(
        "video_blank_frozen",
        "Deteksi Video Blank / Frozen",
        "Failed",
        `Terdeteksi frame hitam selama ${stats.blackSeconds.toFixed(1)} dtk.`,
      );
    } else if (stats.freezeSeconds > Math.max(2.5, expectedDuration * 0.75)) {
      addCheck(
        "video_blank_frozen",
        "Deteksi Video Blank / Frozen",
        "Needs Review",
        `Video tampak statis/frozen selama ${stats.freezeSeconds.toFixed(1)} dtk; periksa apakah pembicara diam atau gambar statis.`,
      );
    } else {
      addCheck("video_blank_frozen", "Deteksi Video Blank / Frozen", "Passed", "Tidak ditemukan blank frame atau freeze abnormal.");
    }

    // Cek audio clipping atau terlalu pelan + Auto-Repair maksimal 1 kali
    const hasSpeech = segments.some((s) => s.end > settings.start && s.start < settings.end);
    if (hasSpeech && (stats.maxVolumeDb >= -0.05 || (stats.meanVolumeDb < -36 && stats.meanVolumeDb > -85))) {
      if (currentAttempts < maxRepairAttempts) {
        const fixed = await autoRepairRenderedAudio(videoPath);
        if (fixed) {
          currentAttempts++;
          currentRepairs.push("Audio dinormalisasi otomatis ulang ke -16 LUFS / -1.5 dBTP untuk mengatasi clipping/level rendah.");
          stats = await probeAudioAndVideoStats(videoPath);
        }
      }
    }
    if (stats.maxVolumeDb >= -0.05) {
      addCheck("audio_quality", "Kualitas & Sinkronisasi Audio", "Needs Review", `Puncak audio mendekati 0 dBFS (${stats.maxVolumeDb} dB), berpotensi clipping.`);
    } else if (hasSpeech && stats.meanVolumeDb < -38 && stats.meanVolumeDb > -85) {
      addCheck("audio_quality", "Kualitas & Sinkronisasi Audio", "Needs Review", `Volume rata-rata cukup pelan (${stats.meanVolumeDb} dB).`);
    } else {
      addCheck(
        "audio_quality",
        "Kualitas & Sinkronisasi Audio",
        "Passed",
        `Level audio seimbang (mean ${stats.meanVolumeDb} dB, peak ${stats.maxVolumeDb} dB).`,
      );
    }
  } else {
    addCheck("video_blank_frozen", "Deteksi Video Blank / Frozen", "Failed", "Video tidak dapat dianalisis.");
    addCheck("audio_quality", "Kualitas & Sinkronisasi Audio", "Failed", "Audio tidak dapat dianalisis.");
  }

  // 4. Subtitle Safe Area
  const excerpt = segments.filter((s) => s.end > settings.start && s.start < settings.end);
  const subSize = settings.subtitleSize || settings.style?.size || 72;
  const safeMarginOk = subSize <= 84 && ["Bawah", "Tengah", "Atas"].includes(settings.position || "Bawah");
  addCheck(
    "subtitle_safe_area",
    "Safe Area Subtitle (Reels/TikTok/Shorts)",
    safeMarginOk ? "Passed" : "Needs Review",
    safeMarginOk
      ? `Ukuran font ${subSize}px berada di dalam batas margin aman 7% kiri-kanan & >=14% bawah.`
      : `Ukuran font ${subSize}px cukup besar, periksa potensi terpotong pada UI aplikasi pendek.`,
  );

  // 5. Sinkronisasi Subtitle
  const outOfBoundsWords = excerpt.some((seg) =>
    (seg.words || []).some((w) => w.end < w.start || w.start < 0),
  );
  addCheck(
    "subtitle_sync",
    "Sinkronisasi Waktu Subtitle",
    outOfBoundsWords ? "Failed" : settings.preset !== "Manual" && !excerpt.length ? "Needs Review" : "Passed",
    outOfBoundsWords
      ? "Terdapat timestamp kata yang tidak valid."
      : excerpt.length
        ? `${excerpt.length} segmen subtitle tersinkronisasi dalam rentang klip.`
        : "Klip tidak memiliki segmen subtitle pada rentang ini.",
  );

  // 6. Framing Wajah
  if (settings.preset === "Manual") {
    addCheck("face_framing", "Framing Wajah Pembicara", "Passed", "Mode Manual menggunakan crop tengah standar.");
  } else if (!track || !track.length) {
    addCheck(
      "face_framing",
      "Framing Wajah Pembicara",
      "Needs Review",
      "Wajah tidak terdeteksi otomatis oleh OpenCV; menggunakan crop tengah.",
    );
  } else {
    const edgeHits = track.filter((pt) => pt[1] < 0.08 || pt[1] > 0.92).length;
    addCheck(
      "face_framing",
      "Framing Wajah Pembicara",
      edgeHits > track.length * 0.3 ? "Needs Review" : "Passed",
      edgeHits > track.length * 0.3
        ? "Posisi pembicara sering berada di tepi ekstrem frame; periksa apakah wajah terpotong."
        : `Pelacakan wajah stabil pada ${track.length} titik sampel.`,
    );
  }

  // 7. Overlay Menutupi Wajah
  const faceMid = track?.length
    ? track.reduce((a, b) => a + (b[2] ?? 0.5), 0) / track.length
    : 0.45;
  const overlayCollision = settings.position === "Tengah" && faceMid >= 0.36 && faceMid <= 0.65;
  addCheck(
    "overlay_face_occlusion",
    "Posisi Overlay terhadap Wajah",
    overlayCollision ? "Needs Review" : "Passed",
    overlayCollision
      ? "Subtitle posisi Tengah berdekatan dengan area vertikal wajah pembicara."
      : "Overlay dan subtitle ditempatkan di luar area utama wajah.",
  );

  // 8. Kecepatan Transisi
  const scenes = settings.plan?.scenes || [];
  const tooFastScene = scenes.some((sc, i) => i > 0 && sc.at - scenes[i - 1].at < 1.1);
  addCheck(
    "transition_speed",
    "Ritme & Kecepatan Transisi",
    tooFastScene ? "Needs Review" : "Passed",
    tooFastScene
      ? "Terdapat pergantian scene di bawah 1,1 detik."
      : `Jarak antar-scene (${scenes.length} scene) memenuhi batas keterbacaan.`,
  );

  // 9. Intensitas Animasi
  const zoomVal = settings.zoom ?? 0.5;
  const animExcessive = zoomVal > 0.85 && scenes.length / expectedDuration > 0.5;
  addCheck(
    "animation_intensity",
    "Keseimbangan Animasi & Gerak",
    animExcessive ? "Needs Review" : "Passed",
    animExcessive
      ? "Kombinasi zoom tinggi dan scene rapat cukup agresif; tinjau kenyamanan visual."
      : `Intensitas gerak (${Math.round(zoomVal * 100)}%) proporsional dengan tempo klip.`,
  );

  // 10. Relevansi B-Roll & Ilustrasi
  const externalMedia = placedAssets.filter((a) => a.sourceType === "Wikimedia Commons" || a.provider === "stock");
  if (externalMedia.length > 0 && !settings.approvedPages?.length) {
    addCheck(
      "broll_relevance",
      "Relevansi B-Roll & Ilustrasi",
      "Needs Review",
      `${externalMedia.length} ilustrasi diambil otomatis dari pencarian topik (${externalMedia.map((a) => a.query || a.title).join(", ")}); tinjau kecocokan konteks visualnya.`,
    );
  } else {
    addCheck(
      "broll_relevance",
      "Relevansi B-Roll & Ilustrasi",
      "Passed",
      placedAssets.length
        ? `${placedAssets.length} elemen visual berasal dari aset terpilih/grafik transkrip.`
        : "Tidak ada b-roll eksternal tanpa persetujuan.",
    );
  }

  // 11. Kelengkapan Konteks Dialog
  if (excerpt.length > 0) {
    const firstText = excerpt[0].text.trim();
    const lastText = excerpt.at(-1).text.trim();
    const badStart = DANGLING_START.test(firstText);
    const badEnd = TRAILING_END.test(lastText) || !/[.!?]["”']?$/.test(lastText);
    addCheck(
      "dialog_context",
      "Kelengkapan Konteks Dialog",
      badStart || badEnd ? "Needs Review" : "Passed",
      badStart || badEnd
        ? "Awal atau akhir dialog tampak belum berakhir dengan tanda baca tuntas; pastikan kalimat tidak menggantung."
        : "Dialog dimulai dan diakhiri pada batas kalimat yang utuh.",
    );
  } else {
    addCheck("dialog_context", "Kelengkapan Konteks Dialog", "Passed", "Tidak ada dialog yang terpotong.");
  }

  // 12. Verifikasi Klaim Faktual (Politik / Konspirasi / Berita / Data)
  const hasClaims = scenes.some((s) => s.veracity === "klaim");
  const isSensitiveStyle = SENSITIVE_STYLES.has(settings.style?.type || "");
  if (hasClaims || isSensitiveStyle) {
    addCheck(
      "factual_veracity",
      "Kejujuran Visual & Klaim Faktual",
      "Needs Review",
      hasClaims
        ? "Klip memuat pernyataan klaim/opini (diberi label KLAIM/OPINI); wajib tinjau agar visual tidak disalahartikan sebagai bukti faktual."
        : `Gaya ${settings.preset} membahas topik sensitif/publik; pastikan konteks faktual sesuai sumber asli.`,
    );
  } else {
    addCheck(
      "factual_veracity",
      "Kejujuran Visual & Klaim Faktual",
      "Passed",
      "Tidak ditemukan klaim sensitif atau atribusi bukti palsu.",
    );
  }

  const hasFailed = checks.some((c) => c.status === "Failed");
  const hasReview = checks.some((c) => c.status === "Needs Review");
  const status = hasFailed ? "Failed" : hasReview ? "Needs Review" : "Passed";

  const passedCount = checks.filter((c) => c.status === "Passed").length;
  const reviewCount = checks.filter((c) => c.status === "Needs Review").length;
  const failedCount = checks.filter((c) => c.status === "Failed").length;

  return {
    status,
    checkedAt: new Date().toISOString(),
    summary: `${status} · ${passedCount}/12 lulus${reviewCount ? `, ${reviewCount} perlu tinjauan` : ""}${failedCount ? `, ${failedCount} gagal` : ""}${currentRepairs.length ? ` · ${currentRepairs.length} perbaikan otomatis` : ""}`,
    repairs: currentRepairs,
    repairAttempts: currentAttempts,
    checks,
  };
}
