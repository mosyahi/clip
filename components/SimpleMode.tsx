import { useRef, useState } from "react";
import { api } from "./Analysis";
import { useYouTubeImport, YouTubeProgress } from "./YouTubeProgress";
import type { Source } from "../pages/index";

const GOALS: Record<
  string,
  { label: string; editMode: string; description: string }
> = {
  Auto: {
    label: "Auto (Pilihan Cerdas AI)",
    editMode: "Otomatis",
    description: "AI menyesuaikan gaya dengan topik dan emosi ujaran.",
  },
  Viral: {
    label: "Viral Dynamic",
    editMode: "Viral aggressive",
    description: "Tempo cepat, blok kata aktif, hook kuat untuk TikTok/Reels.",
  },
  Informative: {
    label: "Informative & Clean",
    editMode: "Safe clean",
    description: "Percakapan bersih, karaoke subtitle, mudah diikuti.",
  },
  Cinematic: {
    label: "Cinematic Story",
    editMode: "Documentary rich",
    description: "Gerak kamera halus, grading sinematik, fokus emosi.",
  },
  Documentary: {
    label: "Documentary & Data",
    editMode: "Documentary rich",
    description: "Dilengkapi grafik data, bingkai arsip, dan ilustrasi.",
  },
  Gaming: {
    label: "Gaming Hype",
    editMode: "Gaming hype",
    description: "Frame HUD futuristik, transisi cepat, energi tinggi.",
  },
  Quotes: {
    label: "Quotes & Renungan",
    editMode: "Otomatis",
    description: "Tipografi kutipan serif hangat dengan tempo tenang.",
  },
};

const fmtTime = (n: number) =>
  Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");

export function SimpleMode({
  sources,
  selected,
  onSelectSource,
  jobs,
  onUploadFile,
  onRefresh,
  onControlJob,
  onRetryJob,
}: {
  sources: Source[];
  selected: string;
  onSelectSource: (id: string) => void;
  jobs: any[];
  onUploadFile: (f?: File) => void;
  onRefresh: () => Promise<any>;
  onControlJob: (jobId: string, action: string) => void;
  onRetryJob: (jobId: string) => void;
}) {
  const youtube = useYouTubeImport();
  const filePicker = useRef<HTMLInputElement>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [rights, setRights] = useState(false);
  const [goal, setGoal] = useState("Auto");
  const [min, setMin] = useState(15);
  const [count, setCount] = useState(3);
  const [preview, setPreview] = useState(true);
  const [cameraFocus, setCameraFocus] = useState<"auto" | "right" | "left" | "center">("auto");
  const [watermark, setWatermark] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageText, setStageText] = useState("");
  const [error, setError] = useState("");
  const [activePreviewJobId, setActivePreviewJobId] = useState("");

  async function importYouTubeSimple() {
    setBusy(true);
    setError("");
    setStageText("Mengunduh video YouTube…");
    try {
      const id = await youtube.start(ytUrl, rights);
      onSelectSource(id);
      setYtUrl("");
      setRights(false);
      await onRefresh();
      setStageText("Video YouTube siap digunakan.");
    } catch (e: any) {
      setError(e.message);
      setStageText("");
    } finally {
      setBusy(false);
    }
  }

  async function generateSimple() {
    if (!selected) {
      setError("Pilih atau unggah video sumber terlebih dahulu.");
      return;
    }
    setBusy(true);
    setError("");
    setStageText("1/3 · Memeriksa transkrip & menganalisis highlight…");
    try {
      const goalCfg = GOALS[goal] || GOALS.Auto;
      const payload = {
        source: selected,
        language: "id",
        workflow: "full-auto",
        editMode: goalCfg.editMode,
        min,
        count,
        versionCount: 1,
        preview,
        autoIllustrate: true,
        autoNarrate: false,
        cameraFocus,
        watermark,
        sourceLabel,
      };
      const res = await fetch("/api/auto-clipper/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "Gagal membuat klip.");

      if (res.status === 202 || data.status === "transcribing") {
        setStageText(`1/3 · Mentranskripsi suara (${data.progress || 0}%)…`);
        await new Promise<void>((resolve, reject) => {
          const timer = setInterval(async () => {
            try {
              const tr = await api("source/" + selected + "/transcript");
              if (tr.status === "gagal") {
                clearInterval(timer);
                reject(Error(tr.error || "Transkripsi gagal."));
              } else if (tr.status === "selesai") {
                clearInterval(timer);
                resolve();
              } else {
                setStageText(`1/3 · Mentranskripsi suara (${tr.progress || 0}%)…`);
              }
            } catch (err) {
              clearInterval(timer);
              reject(err);
            }
          }, 1600);
        });
        setStageText("2/3 · Menyusun highlight & merender MP4…");
        const retry = await api("auto-clipper/plan", "POST", payload);
        if (retry.id) setActivePreviewJobId(retry.id);
        setStageText(`3/3 · ${retry.ids?.length || 1} klip sedang dirender di bawah.`);
        await onRefresh();
        return;
      }

      if (data.id) setActivePreviewJobId(data.id);
      setStageText(`3/3 · ${data.ids?.length || 1} klip sedang dirender di bawah.`);
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
      setStageText("");
    } finally {
      setBusy(false);
    }
  }

  const sourceJobs = jobs.filter((j) => j.source === selected);
  const previewJob =
    sourceJobs.find((j) => j.id === activePreviewJobId && j.status === "selesai") ||
    sourceJobs.find((j) => j.status === "selesai");

  return (
    <section className="panel history">
      <div className="bar">
        <h2>Simple Mode · Buat Klip Otomatis dalam 4 Langkah</h2>
        <small>SIMPLE MODE</small>
      </div>
      <div className="body">
        <input
          hidden
          ref={filePicker}
          type="file"
          accept=".mp4,.mov"
          onChange={(e) => {
            onUploadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {/* LANGKAH 1: SUMBER */}
        <div className="version-card">
          <strong>1. Pilih Video, Unggah MP4, atau Tempel URL YouTube</strong>
          <div className="actions">
            <label>
              Video tersimpan
              <select
                value={selected}
                onChange={(e) => onSelectSource(e.target.value)}
                disabled={busy}
              >
                <option value="" disabled>
                  Pilih video
                </option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="soft"
              disabled={busy}
              onClick={() => filePicker.current?.click()}
            >
              ＋ Unggah MP4 / MOV Baru
            </button>
          </div>
          <details>
            <summary>Atau tempel tautan YouTube berizin</summary>
            <div className="fields">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                />
                Saya memiliki izin untuk mengunduh dan menggunakan video ini.
              </label>
              <button
                type="button"
                className="soft"
                disabled={busy || !ytUrl || !rights}
                onClick={importYouTubeSimple}
              >
                Unduh Video YouTube
              </button>
              <YouTubeProgress status={youtube.status} />
            </div>
          </details>
        </div>

        {/* LANGKAH 2 & 3: TUJUAN, JUMLAH, DURASI */}
        <div className="grid-3">
          <label>
            2. Pilih tujuan klip
            <select value={goal} onChange={(e) => setGoal(e.target.value)} disabled={busy}>
              {Object.entries(GOALS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            3. Durasi per klip
            <select value={min} onChange={(e) => setMin(+e.target.value)} disabled={busy}>
              <option value={15}>15–30 detik</option>
              <option value={30}>30–60 detik</option>
              <option value={60}>60–90 detik</option>
            </select>
          </label>
          <label>
            Jumlah klip (3–10)
            <input
              type="number"
              min={3}
              max={10}
              value={count}
              onChange={(e) => setCount(+e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Fokus kamera 9:16
            <select value={cameraFocus} onChange={(e) => setCameraFocus(e.target.value as any)} disabled={busy}>
              <option value="auto">🎯 Otomatis Ikuti Orang yang Bicara</option>
              <option value="right">👉 Kunci Pembicara Sisi Kanan</option>
              <option value="left">👈 Kunci Pembicara Sisi Kiri</option>
              <option value="center">⏹️ Fokus Tengah Frame</option>
            </select>
          </label>
          <label>
            Watermark (opsional)
            <input
              type="text"
              maxLength={48}
              placeholder="Contoh: @namachannel"
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Kredit sumber (opsional)
            <input
              type="text"
              maxLength={90}
              placeholder="Contoh: Sumber: Podcast Close The Door"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <p>{GOALS[goal]?.description}</p>

        {/* LANGKAH 4: GENERATE */}
        <div className="actions">
          <label className="check">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              disabled={busy}
            />
            Mode cepat 360p (matikan untuk Full HD 1080p)
          </label>
          <button type="button" disabled={busy || !selected} onClick={generateSimple}>
            {busy ? "Sedang Memproses…" : "4. Generate Klip Sekarang"}
          </button>
        </div>

        {stageText && <p role="status">{stageText}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {/* LANGKAH 5 & 6: PREVIEW & DOWNLOAD */}
        {previewJob && (
          <div className="version-card">
            <strong>5. Preview Hasil Klip · {previewJob.settings?.title || "Klip Selesai"}</strong>
            <video
              controls
              playsInline
              src={"/api/job/" + previewJob.id + "/video"}
              style={{ width: "min(100%, 300px)", margin: "0 auto", borderRadius: 10 }}
            />
            <div className="actions" style={{ justifyContent: "center" }}>
              <a href={"/api/job/" + previewJob.id + "/video?download=1"}>
                6. Download MP4 ↓
              </a>
            </div>
          </div>
        )}

        {!!sourceJobs.length && (
          <div className="fields">
            <strong>Daftar Klip Video Ini ({sourceJobs.length})</strong>
            {sourceJobs.slice(0, 8).map((j) => (
              <div className="version-card" key={j.id}>
                <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{j.settings?.title || "Klip"}</strong>
                    <p>
                      {fmtTime(j.settings.start)} – {fmtTime(j.settings.end)} ·{" "}
                      {j.settings.preset || "Auto"} · Status: <strong>{j.status}</strong>
                      {j.status === "berjalan" ? ` (${j.progress}%)` : ""}
                      {j.qcStatus ? ` · QC: ${j.qcStatus}` : ""}
                    </p>
                    {j.status === "gagal" && <p className="error">{j.error}</p>}
                  </div>
                  <div className="actions">
                    {["menunggu", "berjalan", "dijeda"].includes(j.status) && (
                      <button
                        type="button"
                        className="soft"
                        onClick={() => onControlJob(j.id, "cancel")}
                      >
                        Batalkan
                      </button>
                    )}
                    {j.status === "gagal" && (
                      <button type="button" onClick={() => onRetryJob(j.id)}>
                        Ulangi
                      </button>
                    )}
                    {j.status === "selesai" && (
                      <>
                        <button
                          type="button"
                          className="soft"
                          onClick={() => setActivePreviewJobId(j.id)}
                        >
                          Lihat Preview
                        </button>
                        <a href={"/api/job/" + j.id + "/video?download=1"}>Download MP4 ↓</a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
