import { useEffect, useState } from "react";
import { api } from "./Analysis";
import { timecode } from "./timecode.mjs";
import { modes, styles } from "../server/style-registry.mjs";

type Stage = { id: string; label: string; status: string };

type PlanScene = {
  at: number;
  end: number;
  action: string;
  query: string;
  label?: string;
  headline?: string;
  visualType?: string;
  visualReason?: string;
  veracity?: string;
  recommendedSource?: string;
};

type PlanVersion = {
  versionIndex: number;
  preset: string;
  type: string;
  reason: string;
  scenes: PlanScene[];
  visualSummary: Record<string, number>;
  narration: string;
  voiceStyle: string;
  selected: boolean;
};

type PlanClip = {
  clipIndex: number;
  selected?: boolean;
  excerptText?: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  punchline?: string;
  reason?: string;
  score: number;
  hookScore?: number;
  contextScore?: number;
  retentionLevel?: string;
  retentionScore?: number;
  emotion?: string;
  topic?: string;
  versions: PlanVersion[];
};

type PlanResult = {
  source: string;
  sourceName: string;
  highlightMode: string;
  editMode: string;
  versionCount: number;
  transcriptSummary?: {
    totalSegments: number;
    eligibleSegments: number;
    duration: number;
  };
  stages: Stage[];
  clips: PlanClip[];
};

const defaultStages: Stage[] = [
  { id: "input", label: "Input Media", status: "selesai" },
  { id: "transcript", label: "Transkripsi", status: "siap" },
  { id: "highlight", label: "AI Highlight", status: "siap" },
  { id: "style", label: "Rekomendasi Style", status: "siap" },
  { id: "visual", label: "Visual Planning", status: "siap" },
  { id: "render", label: "Render MP4", status: "siap" },
];

export function AutoClipper({
  id,
  provider,
  sharedLook,
  onQueued,
}: {
  id: string;
  provider: boolean;
  sharedLook: {
    sourceLabel: string;
    watermark: string;
    watermarkCorner: string;
    watermarkFont: string;
    watermarkStyle: string;
    watermarkOpacity: number;
    assets: string[];
    clone: boolean;
  };
  onQueued: (jobId: string) => Promise<void>;
}) {
  const [workflow, setWorkflow] = useState<"review" | "full-auto">("review");
  const [language, setLanguage] = useState("id");
  const [editMode, setEditMode] = useState("Otomatis");
  const [min, setMin] = useState(15);
  const [count, setCount] = useState(3);
  const [versionCount, setVersionCount] = useState(2);
  const [preview, setPreview] = useState(true);
  const [autoIllustrate, setAutoIllustrate] = useState(true);
  const [autoNarrate, setAutoNarrate] = useState(false);
  const [useLLM, setUseLLM] = useState(false);

  // Pengaturan Branding, Watermark, Kredit Sumber & Fokus Kamera Pembicara langsung di Auto Clipper
  const [cameraFocus, setCameraFocus] = useState<"auto" | "right" | "left" | "center">("auto");
  const [sourceLabel, setSourceLabel] = useState(sharedLook.sourceLabel || "");
  const [watermark, setWatermark] = useState(sharedLook.watermark || "");
  const [watermarkCorner, setWatermarkCorner] = useState(sharedLook.watermarkCorner || "Kanan");
  const [watermarkStyle, setWatermarkStyle] = useState(sharedLook.watermarkStyle || "Klasik");
  const [watermarkOpacity, setWatermarkOpacity] = useState(sharedLook.watermarkOpacity ?? 0.75);
  const [position, setPosition] = useState<"Bawah" | "Tengah" | "Atas">("Bawah");

  const [stages, setStages] = useState<Stage[]>(defaultStages);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPlan(null);
    setStages(defaultStages);
    setActiveStep(1);
    setStatusText("");
    setError("");
  }, [id]);

  function applyPlanResponse(data: any, targetWorkflow: "review" | "full-auto") {
    const nextStages: Stage[] = data.plan?.stages || data.stages || defaultStages;
    setStages(nextStages);
    setPlan(data.plan);
    if (data.status === "queued" || targetWorkflow === "full-auto") {
      setActiveStep(6);
      setStatusText(
        `Full Auto selesai: ${data.ids?.length || 1} versi klip langsung masuk antrean render MP4.`,
      );
    } else {
      setActiveStep(2);
      setStatusText(
        "Tahap 1 selesai. Tinjau hasil tiap tahap secara berurutan (Tahap 2 → 6) atau klik tab tahap di atas.",
      );
    }
  }

  async function requestPlan(targetWorkflow: "review" | "full-auto") {
    setBusy(true);
    setError("");
    setStatusText("Menjalankan pipeline Super Auto Clipper…");
    try {
      const payload = {
        source: id,
        language,
        workflow: targetWorkflow,
        editMode,
        min,
        count,
        versionCount,
        preview,
        autoIllustrate,
        autoNarrate,
        provider: useLLM,
        ...sharedLook,
        cameraFocus,
        sourceLabel,
        watermark,
        watermarkCorner,
        watermarkStyle,
        watermarkOpacity,
        position,
      };
      const res = await fetch("/api/auto-clipper/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw Error(
          "Respons server bukan JSON (HTTP " +
            res.status +
            "). Mulai ulang server studio untuk memuat modul Auto Clipper.",
        );
      }
      if (!res.ok) throw Error(data.error || "Pipeline gagal dijalankan.");

      if (res.status === 202 || data.status === "transcribing") {
        setStages(data.stages || defaultStages);
        setActiveStep(2);
        setStatusText(`Tahap 2 · Transkripsi berjalan (${data.progress || 0}%)…`);
        await new Promise<void>((resolve, reject) => {
          const timer = setInterval(async () => {
            try {
              const tr = await api("source/" + id + "/transcript");
              if (tr.status === "gagal") {
                clearInterval(timer);
                reject(Error(tr.error || "Transkripsi gagal."));
              } else if (tr.status === "selesai") {
                clearInterval(timer);
                resolve();
              } else {
                setStatusText(`Tahap 2 · Transkripsi berjalan (${tr.progress || 0}%)…`);
              }
            } catch (err) {
              clearInterval(timer);
              reject(err);
            }
          }, 1600);
        });
        const retry = await api("auto-clipper/plan", "POST", payload);
        applyPlanResponse(retry, targetWorkflow);
        if (retry.status === "queued") await onQueued(retry.id);
        return;
      }

      applyPlanResponse(data, targetWorkflow);
      if (data.status === "queued") await onQueued(data.id);
    } catch (e: any) {
      setError(e.message);
      setStatusText("");
    } finally {
      setBusy(false);
    }
  }

  async function executeReviewedPlan() {
    if (!plan) return;
    setBusy(true);
    setError("");
    setStatusText("Tahap 6 · Mengantrekan versi terpilih ke render MP4…");
    try {
      const res = await api("auto-clipper/execute", "POST", {
        source: id,
        clips: plan.clips,
        preview,
        autoIllustrate,
        ...sharedLook,
        cameraFocus,
        sourceLabel,
        watermark,
        watermarkCorner,
        watermarkStyle,
        watermarkOpacity,
        position,
      });
      setStages((prev) =>
        prev.map((s) => (s.id === "render" ? { ...s, status: "berjalan" } : { ...s, status: "selesai" })),
      );
      setStatusText(`Tahap 6 · ${res.ids.length} versi edit berhasil diantrekan ke render MP4.`);
      await onQueued(res.id);
    } catch (e: any) {
      setError(e.message);
      setStatusText("");
    } finally {
      setBusy(false);
    }
  }

  function updateClip(clipIdx: number, patch: Partial<PlanClip>) {
    if (!plan) return;
    setPlan({
      ...plan,
      clips: plan.clips.map((c, ci) => (ci === clipIdx ? { ...c, ...patch } : c)),
    });
  }

  function updateVersion(clipIdx: number, verIdx: number, patch: Partial<PlanVersion>) {
    if (!plan) return;
    setPlan({
      ...plan,
      clips: plan.clips.map((c, ci) =>
        ci !== clipIdx
          ? c
          : {
              ...c,
              versions: c.versions.map((v, vi) => (vi === verIdx ? { ...v, ...patch } : v)),
            },
      ),
    });
  }

  const activeClips = plan ? plan.clips.filter((c) => c.selected !== false) : [];
  const selectedVersionCount = activeClips.reduce(
    (acc, c) => acc + c.versions.filter((v) => v.selected).length,
    0,
  );

  return (
    <section className="panel history">
      <div className="bar">
        <h2>Super Auto Clipper · Pipeline End-to-End</h2>
        <small>AUTO CLIPPER</small>
      </div>
      <div className="body">
        <div className="pipeline-steps" role="tablist" aria-label="Tahapan Super Auto Clipper">
          {stages.map((st, idx) => {
            const stepNum = idx + 1;
            const canClick = stepNum === 1 || !!plan;
            const isCurrent = activeStep === stepNum;
            return (
              <button
                type="button"
                key={st.id}
                disabled={!canClick}
                onClick={() => canClick && setActiveStep(stepNum)}
                className={`pipeline-step status-${st.status}${isCurrent ? " step-active" : ""}`}
              >
                {stepNum}. {st.label}
              </button>
            );
          })}
        </div>

        {/* STEP 1: INPUT & KONFIGURASI PIPELINE */}
        {activeStep === 1 && (
          <div className="fields">
            <div className="grid-3">
              <label>
                Mode eksekusi
                <select value={workflow} onChange={(e) => setWorkflow(e.target.value as any)} disabled={busy}>
                  <option value="review">Review Step-by-Step (Tahap 2 → 6)</option>
                  <option value="full-auto">Full Auto (Langsung Render MP4)</option>
                </select>
              </label>
              <label>
                Mode gaya edit
                <select value={editMode} onChange={(e) => setEditMode(e.target.value)} disabled={busy}>
                  <option value="Otomatis">Otomatis sesuai isi transkrip</option>
                  {Object.keys(modes).map((m) => (
                    <option key={m} value={m}>
                      {m} ({modes[m].replace("Clipper ", "")})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Versi per klip
                <select value={versionCount} onChange={(e) => setVersionCount(+e.target.value)} disabled={busy}>
                  <option value={1}>1 Versi Terbaik</option>
                  <option value={2}>2 Versi Edit Berbeda</option>
                  <option value={3}>3 Versi Edit Berbeda</option>
                </select>
              </label>
              <label>
                Durasi klip
                <select value={min} onChange={(e) => setMin(+e.target.value)} disabled={busy}>
                  <option value={15}>15–30 detik</option>
                  <option value={30}>30–60 detik</option>
                  <option value={60}>60–90 detik</option>
                </select>
              </label>
              <label>
                Jumlah highlight (3–10)
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
                Bahasa video
                <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}>
                  <option value="id">Bahasa Indonesia</option>
                  <option value="auto">Deteksi Otomatis</option>
                  <option value="en">Bahasa Inggris</option>
                </select>
              </label>
            </div>

            <div className="version-card" style={{ marginTop: 8 }}>
              <strong>🎯 Fokus Kamera 9:16 (Landscape → Vertikal), Watermark & Kredit Sumber</strong>
              <div className="grid-3" style={{ marginTop: 8 }}>
                <label>
                  Fokus kamera ke pembicara
                  <select value={cameraFocus} onChange={(e) => setCameraFocus(e.target.value as any)} disabled={busy}>
                    <option value="auto">🎯 Otomatis Ikuti Orang yang Bicara</option>
                    <option value="right">👉 Kunci Pembicara Sisi Kanan</option>
                    <option value="left">👈 Kunci Pembicara Sisi Kiri</option>
                    <option value="center">⏹️ Fokus Tengah Frame</option>
                  </select>
                </label>
                <label>
                  Teks watermark (opsional)
                  <input
                    type="text"
                    maxLength={48}
                    value={watermark}
                    placeholder="Contoh: @namachannel"
                    onChange={(e) => setWatermark(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Kredit sumber / channel (opsional)
                  <input
                    type="text"
                    maxLength={90}
                    value={sourceLabel}
                    placeholder="Contoh: Sumber: Podcast Close The Door"
                    onChange={(e) => setSourceLabel(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Posisi watermark
                  <select value={watermarkCorner} onChange={(e) => setWatermarkCorner(e.target.value)} disabled={busy}>
                    {["Kanan", "Kiri", "Tengah atas", "Kanan bawah", "Tengah bawah", "Kiri bawah"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Gaya watermark
                  <select value={watermarkStyle} onChange={(e) => setWatermarkStyle(e.target.value)} disabled={busy}>
                    {["Klasik", "Label", "Editorial"].map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Posisi subtitle
                  <select value={position} onChange={(e) => setPosition(e.target.value as any)} disabled={busy}>
                    <option value="Bawah">Bawah (Safe Area)</option>
                    <option value="Tengah">Tengah</option>
                    <option value="Atas">Atas</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="actions">
              <label className="check">
                <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} disabled={busy} />
                Render preview 360p cepat
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={autoIllustrate}
                  onChange={(e) => setAutoIllustrate(e.target.checked)}
                  disabled={busy}
                />
                Sisipkan foto ilustrasi Wikimedia (PiP di bawah wajah)
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={autoNarrate}
                  onChange={(e) => setAutoNarrate(e.target.checked)}
                  disabled={busy}
                />
                Buat draf narasi pembuka TTS
              </label>
              {provider && (
                <label className="check">
                  <input type="checkbox" checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} disabled={busy} />
                  Gunakan LLM lokal/terkonfigurasi
                </label>
              )}
              <button type="button" disabled={busy || !id} onClick={() => requestPlan(workflow)}>
                {workflow === "full-auto"
                  ? "Jalankan Full Auto (Tahap 1 → 6) → Render MP4"
                  : "Susun Rencana Auto Clipper (Mulai Tahap 1 → 6)"}
              </button>
              {plan && (
                <button type="button" className="soft" onClick={() => setActiveStep(2)}>
                  Lanjut ke Tahap 2: Transkripsi →
                </button>
              )}
            </div>
          </div>
        )}

        {statusText && <p role="status">{statusText}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {/* STEP 2: TRANSKRIPSI */}
        {plan && activeStep === 2 && (
          <div className="fields">
            <h3>Tahap 2 · Hasil Transkripsi Sumber</h3>
            <p>
              Sumber: <strong>{plan.sourceName}</strong> ·{" "}
              <strong>{plan.transcriptSummary?.totalSegments || 0} segmen ujaran</strong> terdeteksi.
            </p>
            {plan.clips.map((c, ci) => (
              <div className="version-card" key={ci}>
                <strong>
                  Cuplikan Transkrip Klip #{ci + 1} ({timecode(c.start)} – {timecode(c.end)})
                </strong>
                <p>{c.excerptText || c.hook}</p>
              </div>
            ))}
            <div className="actions">
              <button type="button" className="soft" onClick={() => setActiveStep(1)}>
                ← Tahap 1: Konfigurasi
              </button>
              <button type="button" onClick={() => setActiveStep(3)}>
                Lanjut ke Tahap 3: AI Highlight ({plan.clips.length} Klip) →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: AI HIGHLIGHT INTELLIGENCE */}
        {plan && activeStep === 3 && (
          <div className="fields">
            <h3>Tahap 3 · AI Highlight Intelligence ({plan.highlightMode})</h3>
            <p>Pilih klip menarik, periksa Hook & Penutup (Punchline), atau sesuaikan batas detik mulai/selesai.</p>
            {plan.clips.map((c, ci) => (
              <div className="candidate" key={ci}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={c.selected !== false}
                    onChange={(e) => updateClip(ci, { selected: e.target.checked })}
                  />
                  <strong>
                    Klip #{ci + 1} · {c.title}
                  </strong>
                </label>
                <p>
                  {timecode(c.start)} – {timecode(c.end)} ({Math.round(c.end - c.start)} dtk) · Skor {c.score} · Retensi{" "}
                  <strong>{c.retentionLevel || "Kuat"}</strong> ({c.retentionScore ?? c.score}) · Hook {c.hookScore ?? "-"} ·
                  Konteks {c.contextScore ?? "-"} · Emosi: <strong>{c.emotion || "-"}</strong>
                </p>
                <p>Hook: “{c.hook}”</p>
                {c.punchline && <p>Penutup: “{c.punchline}”</p>}
                {c.reason && <p>Alasan AI: {c.reason}</p>}
                <div className="actions">
                  <label>
                    Judul klip
                    <input
                      type="text"
                      value={c.title}
                      onChange={(e) => updateClip(ci, { title: e.target.value })}
                    />
                  </label>
                  <label>
                    Mulai (dtk)
                    <input
                      type="number"
                      step="0.1"
                      value={c.start}
                      onChange={(e) => updateClip(ci, { start: +e.target.value })}
                    />
                  </label>
                  <label>
                    Selesai (dtk)
                    <input
                      type="number"
                      step="0.1"
                      value={c.end}
                      onChange={(e) => updateClip(ci, { end: +e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
            <div className="actions">
              <button type="button" className="soft" onClick={() => setActiveStep(2)}>
                ← Tahap 2: Transkripsi
              </button>
              <button type="button" disabled={!activeClips.length} onClick={() => setActiveStep(4)}>
                Lanjut ke Tahap 4: Rekomendasi Style ({activeClips.length} klip aktif) →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REKOMENDASI STYLE & MULTI-VERSI */}
        {plan && activeStep === 4 && (
          <div className="fields">
            <h3>Tahap 4 · Rekomendasi Style & Multi-Versi Edit</h3>
            <p>Setiap highlight dapat dirender dalam 1–3 versi gaya berbeda (typography, pacing, color grading, frame).</p>
            {plan.clips.map((c, ci) =>
              c.selected === false ? null : (
                <div className="candidate" key={ci}>
                  <strong>
                    Klip #{ci + 1} · {c.title} ({timecode(c.start)} – {timecode(c.end)})
                  </strong>
                  <div className="fields">
                    {c.versions.map((v, vi) => (
                      <div className="version-card" key={vi}>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={v.selected}
                            onChange={(e) => updateVersion(ci, vi, { selected: e.target.checked })}
                          />
                          <strong>
                            Versi {v.versionIndex}: {v.preset}
                          </strong>
                          <span>({v.reason})</span>
                        </label>
                        <label>
                          Pilih preset style untuk Versi {v.versionIndex}
                          <select
                            value={v.preset}
                            onChange={(e) => updateVersion(ci, vi, { preset: e.target.value })}
                          >
                            {styles.map((s) => (
                              <option key={s.name} value={s.name}>
                                {s.name} — {s.description}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
            <div className="actions">
              <button type="button" className="soft" onClick={() => setActiveStep(3)}>
                ← Tahap 3: AI Highlight
              </button>
              <button type="button" disabled={!selectedVersionCount} onClick={() => setActiveStep(5)}>
                Lanjut ke Tahap 5: Visual Planning & Voice →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: VISUAL PLANNING & VOICE STUDIO */}
        {plan && activeStep === 5 && (
          <div className="fields">
            <h3>Tahap 5 · Visual Planning per Scene & Voice-Over</h3>
            <p>
              Rincian penempatan visual otomatis (Grafik Data, Motion Graphics, Foto/Ilustrasi Wikimedia/Lokal, B-Roll) dan
              narasi pembuka per versi klip.
            </p>
            {plan.clips.map((c, ci) =>
              c.selected === false ? null : (
                <div className="candidate" key={ci}>
                  <strong>
                    Klip #{ci + 1} · {c.title} ({timecode(c.start)} – {timecode(c.end)})
                  </strong>
                  <div className="fields">
                    {c.versions
                      .map((v, vi) => ({ v, vi }))
                      .filter(({ v }) => v.selected)
                      .map(({ v, vi }) => (
                        <div className="version-card" key={vi}>
                          <strong>
                            Versi {v.versionIndex} · {v.preset}
                          </strong>
                          <p>
                            Ringkasan Visual: Grafik {v.visualSummary.grafik || 0} · Motion{" "}
                            {v.visualSummary.motion || 0} · Foto/Ilustrasi{" "}
                            {(v.visualSummary.foto || 0) + (v.visualSummary.ilustrasi || 0)} · B-Roll{" "}
                            {v.visualSummary["b-roll"] || 0}
                          </p>
                          {v.scenes.length > 0 ? (
                            <div className="fields">
                              {v.scenes.map((sc, si) => (
                                <p key={si}>
                                  +{sc.at.toFixed(1)} dtk ·{" "}
                                  <strong>[{(sc.visualType || "motion").toUpperCase()}]</strong>{" "}
                                  {sc.veracity === "klaim"
                                    ? "(Klaim/Opini) "
                                    : sc.veracity === "fakta"
                                      ? "(Data/Fakta) "
                                      : ""}
                                  {sc.action} · “{sc.headline || sc.label || sc.query}”
                                  {sc.recommendedSource ? ` · ${sc.recommendedSource}` : ""}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p>Fokus pada pembicara & subtitle dinamis tanpa cutaway tambahan.</p>
                          )}
                          <div className="actions">
                            <label>
                              Preset narator TTS
                              <select
                                value={v.voiceStyle}
                                onChange={(e) => updateVersion(ci, vi, { voiceStyle: e.target.value })}
                              >
                                {["Natural", "Tenang", "Energik", "Dokumenter", "Berita", "Storyteller"].map((vs) => (
                                  <option key={vs} value={vs}>
                                    {vs}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Narasi voice-over (kosongkan bila hanya suara asli)
                              <input
                                type="text"
                                maxLength={500}
                                placeholder="Kosongkan untuk memakai audio asli penuh"
                                value={v.narration}
                                onChange={(e) => updateVersion(ci, vi, { narration: e.target.value })}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ),
            )}
            <div className="actions">
              <button type="button" className="soft" onClick={() => setActiveStep(4)}>
                ← Tahap 4: Rekomendasi Style
              </button>
              <button type="button" disabled={!selectedVersionCount} onClick={() => setActiveStep(6)}>
                Lanjut ke Tahap 6: Review Akhir & Render MP4 →
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: EDITING & RENDER MP4 */}
        {plan && activeStep === 6 && (
          <div className="fields">
            <h3>Tahap 6 · Siap Editing & Render MP4 ({selectedVersionCount} Versi Terpilih)</h3>
            <div className="version-card">
              <strong>🎯 Fokus Kamera 9:16, Watermark & Kredit Sumber</strong>
              <div className="grid-3" style={{ marginTop: 8 }}>
                <label>
                  Fokus kamera ke pembicara
                  <select value={cameraFocus} onChange={(e) => setCameraFocus(e.target.value as any)} disabled={busy}>
                    <option value="auto">🎯 Otomatis Ikuti Orang yang Bicara</option>
                    <option value="right">👉 Kunci Pembicara Sisi Kanan</option>
                    <option value="left">👈 Kunci Pembicara Sisi Kiri</option>
                    <option value="center">⏹️ Fokus Tengah Frame</option>
                  </select>
                </label>
                <label>
                  Teks watermark (opsional)
                  <input
                    type="text"
                    maxLength={48}
                    value={watermark}
                    placeholder="Contoh: @namachannel"
                    onChange={(e) => setWatermark(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Kredit sumber / channel (opsional)
                  <input
                    type="text"
                    maxLength={90}
                    value={sourceLabel}
                    placeholder="Contoh: Sumber: Podcast Close The Door"
                    onChange={(e) => setSourceLabel(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Posisi watermark
                  <select value={watermarkCorner} onChange={(e) => setWatermarkCorner(e.target.value)} disabled={busy}>
                    {["Kanan", "Kiri", "Tengah atas", "Kanan bawah", "Tengah bawah", "Kiri bawah"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Gaya watermark
                  <select value={watermarkStyle} onChange={(e) => setWatermarkStyle(e.target.value)} disabled={busy}>
                    {["Klasik", "Label", "Editorial"].map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Posisi subtitle
                  <select value={position} onChange={(e) => setPosition(e.target.value as any)} disabled={busy}>
                    <option value="Bawah">Bawah (Safe Area)</option>
                    <option value="Tengah">Tengah</option>
                    <option value="Atas">Atas</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="actions">
              <label className="check">
                <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} disabled={busy} />
                Render preview 360p cepat (matikan untuk Final 1080p)
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={autoIllustrate}
                  onChange={(e) => setAutoIllustrate(e.target.checked)}
                  disabled={busy}
                />
                Sisipkan foto ilustrasi Wikimedia (PiP di bawah wajah)
              </label>
            </div>
            {plan.clips.map((c, ci) =>
              c.selected === false ? null : (
                <div className="version-card" key={ci}>
                  <strong>
                    Klip #{ci + 1} · {c.title} ({timecode(c.start)} – {timecode(c.end)})
                  </strong>
                  {c.versions
                    .filter((v) => v.selected)
                    .map((v) => (
                      <p key={v.versionIndex}>
                        ✓ <strong>Versi {v.versionIndex}: {v.preset}</strong> · {v.scenes.length} scene visual ·{" "}
                        {v.narration ? `Voice-over (${v.voiceStyle}): “${v.narration}”` : "Audio asli pembicara"} ·{" "}
                        {preview ? "Preview 360p" : "Final 1080p"}
                      </p>
                    ))}
                </div>
              ),
            )}
            <div className="actions">
              <button type="button" className="soft" onClick={() => setActiveStep(5)}>
                ← Tahap 5: Visual Planning
              </button>
              <button
                type="button"
                disabled={busy || !selectedVersionCount}
                onClick={executeReviewedPlan}
              >
                Render Versi Terpilih ({selectedVersionCount})
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
