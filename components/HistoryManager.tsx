import { useEffect, useState } from "react";
import { api } from "./Analysis";
import type { Source } from "../pages/index";

export type JobStorage = {
  renderBytes: number;
  metaBytes: number;
  transcriptSnapshotBytes: number;
  fileBytes: number;
  jobTotalBytes: number;
  sourceBytes: number;
  sourceSharedJobs: number;
  hasRenderFile: boolean;
};

export type StorageSummary = {
  totalManagedBytes: number;
  renderBytes: number;
  sourceBytes: number;
  transcriptAndAssetBytes: number;
  databaseBytes: number;
  orphanBytes: number;
  orphanFilesCount: number;
  jobCount: number;
  sourceCount: number;
};

export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(2) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}

const fmtTime = (n: number) =>
  Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");

export function HistoryManager({
  jobs,
  sources,
  selectedSource,
  storage,
  pending,
  onPlay,
  onControl,
  onRetry,
  onRefresh,
  extraActions,
}: {
  jobs: any[];
  sources: Source[];
  selectedSource: string;
  storage?: StorageSummary | null;
  pending: string;
  onPlay: (job: any) => void;
  onControl: (jobId: string, action: string) => void;
  onRetry: (jobId: string) => void;
  onRefresh: () => Promise<any>;
  extraActions?: (job: any) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [deleteDialog, setDeleteDialog] = useState<{
    jobIds: string[];
    deleteAll: boolean;
    label: string;
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"A" | "B" | "C">("B");
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [confirmSourceCheck, setConfirmSourceCheck] = useState(false);
  const [estimate, setEstimate] = useState<{
    estimatedFreeBytes: number;
    filesToDeleteCount: number;
    sourcesToDeleteCount: number;
    targetJobsCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviseTargetId, setReviseTargetId] = useState<string>("");
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [revisePreview, setRevisePreview] = useState(true);
  const [compareJobId, setCompareJobId] = useState<string>("");

  const now = Date.now();
  const filteredJobs = jobs.filter((j) => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (sourceFilter !== "all" && j.source !== sourceFilter) return false;
    if (dateFilter !== "all" && j.created) {
      const ageMs = now - Number(j.created);
      if (dateFilter === "today" && ageMs > 24 * 3600 * 1000) return false;
      if (dateFilter === "7d" && ageMs > 7 * 24 * 3600 * 1000) return false;
      if (dateFilter === "30d" && ageMs > 30 * 24 * 3600 * 1000) return false;
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const srcName = sources.find((s) => s.id === j.source)?.name || "";
      const hay = [
        j.id,
        j.settings?.title,
        srcName,
        j.settings?.preset,
        j.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => jobs.some((j) => j.id === id)));
  }, [jobs]);

  useEffect(() => {
    if (!deleteDialog) {
      setEstimate(null);
      return;
    }
    let alive = true;
    api("history/estimate", "POST", {
      jobIds: deleteDialog.jobIds,
      deleteAll: deleteDialog.deleteAll,
      mode: deleteMode,
    })
      .then((res) => alive && setEstimate(res))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [deleteDialog, deleteMode]);

  function openDelete(jobIds: string[], deleteAll: boolean, label: string) {
    setDeleteDialog({ jobIds, deleteAll, label });
    setDeleteMode("B");
    setConfirmCheck(false);
    setConfirmSourceCheck(false);
    setError("");
    setMessage("");
  }

  async function executeDelete() {
    if (!deleteDialog) return;
    setBusy(true);
    setError("");
    try {
      const res = await api("history/delete", "POST", {
        jobIds: deleteDialog.jobIds,
        deleteAll: deleteDialog.deleteAll,
        mode: deleteMode,
        confirm: confirmCheck,
        confirmSourceDelete: confirmSourceCheck,
      });
      setDeleteDialog(null);
      setSelectedIds([]);
      setMessage(
        `${res.deletedJobsCount} riwayat dihapus (Mode ${res.mode}) · Ruang dibebaskan: ${formatBytes(res.freedBytes)}` +
          (res.deletedSourcesCount ? ` · ${res.deletedSourcesCount} sumber dihapus.` : "."),
      );
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncStorage() {
    setBusy(true);
    setError("");
    try {
      const res = await api("history/sync", "POST");
      setMessage(
        `Sinkronisasi selesai: ${res.cleanedFiles} file sementara dibersihkan (${formatBytes(res.cleanedBytes)}).`,
      );
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const allFilteredSelected =
    filteredJobs.length > 0 && filteredJobs.every((j) => selectedIds.includes(j.id));

  return (
    <section className="panel history">
      <div className="bar">
        <h2>Antrean dan riwayat</h2>
        <div className="actions">
          {jobs.some((j) => j.source === selectedSource && j.status === "selesai") && (
            <a href={"/api/export/" + selectedSource + "/zip"}>Unduh ZIP sumber ↓</a>
          )}
          <small>{jobs.length} KLIP</small>
        </div>
      </div>

      <div className="body">
        {storage && (
          <div className="version-card">
            <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Penyimpanan Studio: {formatBytes(storage.totalManagedBytes)}</strong>
                <p>
                  Render MP4: {formatBytes(storage.renderBytes)} · Video Sumber:{" "}
                  {formatBytes(storage.sourceBytes)} · Transkrip & Aset:{" "}
                  {formatBytes(storage.transcriptAndAssetBytes)} · Database:{" "}
                  {formatBytes(storage.databaseBytes)}
                </p>
              </div>
              <button type="button" className="soft" disabled={busy || !!pending} onClick={syncStorage}>
                Sinkronkan & Bersihkan Temp
              </button>
            </div>
          </div>
        )}

        <div className="grid-3">
          <label>
            Cari riwayat
            <input
              type="search"
              placeholder="Cari judul, sumber, gaya, atau ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Filter status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Semua status ({jobs.length})</option>
              {["selesai", "berjalan", "menunggu", "dijeda", "gagal", "dibatalkan"].map((st) => (
                <option key={st} value={st}>
                  {st} ({jobs.filter((j) => j.status === st).length})
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter sumber video
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">Semua sumber</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter tanggal
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="all">Semua waktu</option>
              <option value="today">Hari ini (24 jam)</option>
              <option value="7d">7 hari terakhir</option>
              <option value="30d">30 hari terakhir</option>
            </select>
          </label>
        </div>

        {!!jobs.length && (
          <div className="actions">
            <button
              type="button"
              className="soft"
              disabled={!filteredJobs.length}
              onClick={() => {
                if (allFilteredSelected) {
                  const filteredSet = new Set(filteredJobs.map((j) => j.id));
                  setSelectedIds(selectedIds.filter((id) => !filteredSet.has(id)));
                } else {
                  setSelectedIds([...new Set([...selectedIds, ...filteredJobs.map((j) => j.id)])]);
                }
              }}
            >
              {allFilteredSelected ? "Batal Pilih" : `Pilih Semua Tampil (${filteredJobs.length})`}
            </button>
            {!!selectedIds.length && (
              <button
                type="button"
                className="soft"
                disabled={busy}
                onClick={() =>
                  openDelete(selectedIds, false, `${selectedIds.length} riwayat terpilih`)
                }
              >
                Hapus Terpilih ({selectedIds.length})
              </button>
            )}
            <button
              type="button"
              className="soft"
              disabled={busy}
              onClick={() => openDelete([], true, `seluruh ${jobs.length} riwayat pekerjaan`)}
            >
              Hapus Seluruh Riwayat
            </button>
          </div>
        )}

        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {deleteDialog && (
          <div className="voice-box fields" role="dialog" aria-label="Konfirmasi penghapusan riwayat">
            <strong>Konfirmasi Penghapusan Permanen · {deleteDialog.label}</strong>
            <p>
              File asli Anda di luar folder aplikasi tidak akan pernah disentuh. Pilih cakupan data
              yang ingin dihapus dari penyimpanan studio:
            </p>
            <label className="check">
              <input
                type="radio"
                name="delMode"
                checked={deleteMode === "A"}
                onChange={() => setDeleteMode("A")}
              />
              <span>
                <strong>Opsi A · Hapus catatan riwayat saja:</strong> Menghapus daftar dari tabel
                riwayat, tetapi menyimpan file MP4 hasil render di disk.
              </span>
            </label>
            <label className="check">
              <input
                type="radio"
                name="delMode"
                checked={deleteMode === "B"}
                onChange={() => setDeleteMode("B")}
              />
              <span>
                <strong>Opsi B · Hapus riwayat + file render & cache pekerjaan (Direkomendasikan):</strong>{" "}
                Menghapus catatan riwayat, file MP4 render/preview, daftar aset, laporan QC, dan
                snapshot transkrip khusus pekerjaan ini. Video sumber tetap disimpan.
              </span>
            </label>
            <label className="check">
              <input
                type="radio"
                name="delMode"
                checked={deleteMode === "C"}
                onChange={() => setDeleteMode("C")}
              />
              <span>
                <strong>Opsi C · Hapus seluruh data pekerjaan termasuk salinan video sumber:</strong>{" "}
                Menghapus Opsi B ditambah salinan video sumber, transkrip utama, sampel suara, dan
                foto b-roll di aplikasi (hanya untuk sumber yang tidak lagi dipakai pekerjaan lain).
              </span>
            </label>

            {estimate && (
              <p>
                Estimasi ruang yang akan dibebaskan:{" "}
                <strong>{formatBytes(estimate.estimatedFreeBytes)}</strong> ({estimate.filesToDeleteCount}{" "}
                file
                {estimate.sourcesToDeleteCount
                  ? `, termasuk ${estimate.sourcesToDeleteCount} video sumber`
                  : ""}
                ).
              </p>
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={confirmCheck}
                onChange={(e) => setConfirmCheck(e.target.checked)}
              />
              Saya mengerti penghapusan ini bersifat permanen dan tidak dapat dibatalkan.
            </label>

            {deleteMode === "C" && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={confirmSourceCheck}
                  onChange={(e) => setConfirmSourceCheck(e.target.checked)}
                />
                Konfirmasi khusus Opsi C: hapus juga salinan video sumber & transkrip dari penyimpanan
                aplikasi bila tidak ada pekerjaan lain yang memakainya.
              </label>
            )}

            <div className="actions">
              <button
                type="button"
                disabled={
                  busy || !confirmCheck || (deleteMode === "C" && !confirmSourceCheck)
                }
                onClick={executeDelete}
              >
                {busy ? "Menghapus…" : "Konfirmasi Hapus Permanen"}
              </button>
              <button type="button" className="soft" onClick={() => setDeleteDialog(null)}>
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      {!filteredJobs.length ? (
        <p className="details">
          {jobs.length ? "Tidak ada riwayat yang cocok dengan filter." : "Hasil render akan muncul di sini."}
        </p>
      ) : (
        filteredJobs.map((j) => {
          const srcName = sources.find((s) => s.id === j.source)?.name || "Sumber telah dihapus";
          const st: JobStorage | undefined = j.storage;
          const checked = selectedIds.includes(j.id);
          return (
            <article key={j.id}>
              <label className="check" style={{ marginRight: 6 }}>
                <input
                  type="checkbox"
                  aria-label={"Pilih riwayat " + j.id}
                  checked={checked}
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? [...selectedIds, j.id]
                        : selectedIds.filter((id) => id !== j.id),
                    )
                  }
                />
              </label>
              <div>
                <strong>{j.settings.title || srcName}</strong>
                <p>
                  {fmtTime(j.settings.start)} – {fmtTime(j.settings.end)} ·{" "}
                  {j.settings.preview ? "360p" : "1080p"} · {j.settings.preset || "Manual"} ·{" "}
                  {formatBytes(j.sizeBytes ?? st?.jobTotalBytes ?? 0)}
                  {j.qcStatus && (
                    <>
                      {" "}
                      ·{" "}
                      <strong
                        style={{
                          color:
                            j.qcStatus === "Passed"
                              ? "#caf784"
                              : j.qcStatus === "Needs Review"
                                ? "#fbbf24"
                                : "#f87171",
                        }}
                      >
                        QC: {j.qcStatus}
                      </strong>
                    </>
                  )}
                </p>
                <details>
                  <summary>Detail pekerjaan, QC & penyimpanan</summary>
                  <p>
                    ID: <code>{j.id}</code> · Sumber: {srcName} · Dibuat:{" "}
                    {j.created ? new Date(j.created).toLocaleString("id-ID") : "-"}
                  </p>
                  {st && (
                    <p>
                      File MP4: {formatBytes(st.renderBytes)} · Metadata/QC:{" "}
                      {formatBytes(st.metaBytes)} · Snapshot Transkrip:{" "}
                      {formatBytes(st.transcriptSnapshotBytes)} · Sumber Terkait:{" "}
                      {formatBytes(st.sourceBytes)} (dipakai {st.sourceSharedJobs} pekerjaan)
                    </p>
                  )}
                  {j.qc && (
                    <div className="version-card" style={{ marginTop: 8 }}>
                      <strong>Laporan Quality Control · {j.qc.summary}</strong>
                      {j.qc.repairs?.length > 0 && (
                        <p>
                          Perbaikan Otomatis: {j.qc.repairs.join(" | ")}
                        </p>
                      )}
                      {j.qc.checks?.map((c: any) => (
                        <p key={c.id}>
                          <strong>[{c.status}]</strong> {c.label}: {c.detail}
                        </p>
                      ))}
                    </div>
                  )}
                  {j.status === "selesai" && (
                    <div className="actions">
                      <button
                        type="button"
                        className="soft"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api("job/" + j.id + "/qc", "POST");
                            await onRefresh();
                          } catch (e: any) {
                            setError(e.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {j.qc ? "Periksa Ulang QC" : "Jalankan Pemeriksaan QC"}
                      </button>
                      <button
                        type="button"
                        className="soft"
                        onClick={() => {
                          setReviseTargetId(reviseTargetId === j.id ? "" : j.id);
                          setReviseInstruction("");
                        }}
                      >
                        Revisi Cerdas (Tanpa Transkripsi Ulang)
                      </button>
                      {j.settings?.parentJobId &&
                        jobs.some((p) => p.id === j.settings.parentJobId && p.status === "selesai") && (
                          <button
                            type="button"
                            className="soft"
                            onClick={() => setCompareJobId(compareJobId === j.id ? "" : j.id)}
                          >
                            {compareJobId === j.id ? "Tutup Before/After" : "Bandingkan Before/After"}
                          </button>
                        )}
                    </div>
                  )}
                  {j.settings?.changesApplied?.length > 0 && (
                    <p>
                      Riwayat revisi (v{j.settings.versionNumber || 2}):{" "}
                      {j.settings.changesApplied.join(" · ")}
                    </p>
                  )}
                </details>
                {reviseTargetId === j.id && (
                  <div className="voice-box fields" style={{ marginTop: 10 }}>
                    <strong>Smart Revision Engine · Revisi Hasil Render</strong>
                    <p>
                      Mempertahankan transkrip dan highlight tanpa memproses ulang podcast. Klik chip cepat
                      atau tulis instruksi revisi:
                    </p>
                    <div className="pipeline-steps">
                      {[
                        "Fokus kamera ke orang",
                        "Watermark: @channelanda",
                        "Sumber: Nama Podcast",
                        "Perbesar subtitle",
                        "Kurangi zoom",
                        "Tambahkan visual yang relevan",
                        "Buat lebih cinematic",
                        "Kurangi sound effect",
                        "Ubah style menjadi documentary",
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="pipeline-step status-selesai"
                          onClick={() =>
                            setReviseInstruction((old) => (old ? old + ", " + chip : chip))
                          }
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                    <label>
                      Instruksi perubahan (atau koreksi subtitle, misal: Pada 0:05 ubah subtitle menjadi "Teks baru")
                      <input
                        type="text"
                        placeholder="Contoh: Perbesar subtitle, kurangi zoom, ubah style menjadi documentary"
                        value={reviseInstruction}
                        onChange={(e) => setReviseInstruction(e.target.value)}
                      />
                    </label>
                    <div className="actions">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={revisePreview}
                          onChange={(e) => setRevisePreview(e.target.checked)}
                        />
                        Render preview 360p cepat
                      </label>
                      <button
                        type="button"
                        disabled={busy || !reviseInstruction.trim()}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            const r = await api("job/" + j.id + "/revise", "POST", {
                              instruction: reviseInstruction,
                              preview: revisePreview,
                            });
                            setReviseTargetId("");
                            setMessage(
                              `Revisi v${r.versionNumber} masuk antrean: ${r.changesApplied.join(" ")}`,
                            );
                            await onRefresh();
                          } catch (e: any) {
                            setError(e.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Render Revisi Sekarang
                      </button>
                    </div>
                  </div>
                )}
                {compareJobId === j.id && j.settings?.parentJobId && (
                  <div className="voice-box fields" style={{ marginTop: 10 }}>
                    <strong>
                      Perbandingan Before / After (Versi Sebelumnya vs Revisi v
                      {j.settings.versionNumber || 2})
                    </strong>
                    {j.settings.changesApplied && (
                      <p>Perubahan: {j.settings.changesApplied.join(" · ")}</p>
                    )}
                    <div className="pair">
                      <div>
                        <small>BEFORE (VERSI ASAL)</small>
                        <video
                          controls
                          playsInline
                          src={"/api/job/" + j.settings.parentJobId + "/video"}
                          style={{ width: "100%", maxHeight: 320, borderRadius: 8 }}
                        />
                      </div>
                      <div>
                        <small>AFTER (VERSI REVISI v{j.settings.versionNumber || 2})</small>
                        <video
                          controls
                          playsInline
                          src={"/api/job/" + j.id + "/video"}
                          style={{ width: "100%", maxHeight: 320, borderRadius: 8 }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <span>
                {j.status}
                {j.status === "berjalan" ? " " + j.progress + "%" : ""}
              </span>
              {["menunggu", "berjalan", "dijeda"].includes(j.status) &&
                (j.status === "dijeda" ? ["resume", "cancel"] : ["pause", "cancel"]).map(
                  (action) => (
                    <button
                      className="soft"
                      key={action}
                      disabled={!!pending}
                      onClick={() => onControl(j.id, action)}
                    >
                      {action === "pause"
                        ? "Jeda"
                        : action === "resume"
                          ? "Lanjutkan"
                          : "Batalkan"}
                    </button>
                  ),
                )}
              {j.illustrationCount !== undefined && (
                <small>
                  {j.illustrationCount
                    ? j.illustrationCount + " ilustrasi terpasang"
                    : "Tanpa ilustrasi · tidak ada foto cocok yang dipakai"}
                </small>
              )}
              {j.status === "selesai" && (
                <>
                  <button className="soft" onClick={() => onPlay(j)}>
                    Putar
                  </button>
                  <a href={"/api/job/" + j.id + "/video?download=1"}>Unduh MP4 ↓</a>
                  {j.settings.autoIllustrate && (
                    <a href={"/api/job/" + j.id + "/illustrations"}>Sumber ilustrasi ↓</a>
                  )}
                </>
              )}
              {j.status === "gagal" && (
                <>
                  <p className="error">{j.error}</p>
                  <button onClick={() => onRetry(j.id)}>Ulangi</button>
                </>
              )}
              {extraActions?.(j)}
              <button
                type="button"
                className="soft"
                disabled={busy}
                onClick={() =>
                  openDelete([j.id], false, `pekerjaan "${j.settings.title || j.id.slice(0, 8)}"`)
                }
              >
                Hapus
              </button>
            </article>
          );
        })
      )}
    </section>
  );
}
