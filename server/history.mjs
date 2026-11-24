import fs from "node:fs";
import path from "node:path";

const PROTECTED_NAMES = new Set([
  "studio.sqlite",
  "studio.sqlite-wal",
  "studio.sqlite-shm",
  "studio.lock.sqlite",
  "studio.lock.sqlite-journal",
  "bukti",
]);

export function assertSafeManagedPath(rootDir, targetPath) {
  if (!rootDir || !targetPath || typeof targetPath !== "string") {
    throw Error("Path penghapusan tidak valid.");
  }
  const absRoot = path.resolve(rootDir);
  const absTarget = path.resolve(targetPath);
  const rel = path.relative(absRoot, absTarget);
  if (
    !rel ||
    rel.startsWith("..") ||
    path.isAbsolute(rel) ||
    rel.includes(".." + path.sep)
  ) {
    throw Error("Akses ditolak: dilarang menghapus file di luar folder data studio.");
  }
  const topSegment = rel.split(/[\\/]/)[0];
  if (PROTECTED_NAMES.has(topSegment) || rel.includes(path.sep)) {
    throw Error("Akses ditolak: file sistem, model, atau fixture dilindungi.");
  }
  return absTarget;
}

export function safeFileSize(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() ? st.size : 0;
  } catch {
    return 0;
  }
}

export function safeDeleteFile(rootDir, targetPath) {
  const absTarget = assertSafeManagedPath(rootDir, targetPath);
  try {
    if (!fs.existsSync(absTarget)) return 0;
    const st = fs.statSync(absTarget);
    if (!st.isFile()) return 0;
    const size = st.size;
    fs.unlinkSync(absTarget);
    return size;
  } catch (e) {
    throw Error("Gagal menghapus file " + path.basename(absTarget) + ": " + e.message);
  }
}

export function getSourceStorageBytes(db, rootDir, sourceId) {
  if (!sourceId) return { sourceBytes: 0, assetIds: [] };
  const exts = [".source", ".json", ".srt", ".wav", ".partial.json", ".voice.wav", ".voice.json"];
  let bytes = 0;
  for (const ext of exts) {
    bytes += safeFileSize(path.join(rootDir, sourceId + ext));
  }
  let assetRows = [];
  try {
    assetRows = db.prepare("select id from asset where source=?").all(sourceId);
  } catch {
    assetRows = [];
  }
  for (const a of assetRows) {
    bytes += safeFileSize(path.join(rootDir, a.id + ".image"));
  }
  return { sourceBytes: bytes, assetIds: assetRows.map((a) => a.id) };
}

export function getJobStorageDetails(db, rootDir, jobRow) {
  const id = jobRow.id;
  const renderBytes = safeFileSize(path.join(rootDir, id + ".mp4"));
  const assetsJsonBytes = safeFileSize(path.join(rootDir, id + ".mp4.assets.json"));
  const qcJsonBytes = safeFileSize(path.join(rootDir, id + ".qc.json"));
  const revJsonBytes = safeFileSize(path.join(rootDir, id + ".rev.json"));
  const trRow = db.prepare("select length(segments) as len from render_transcript where job=?").get(id);
  const transcriptSnapshotBytes = Number(trRow?.len || 0);
  const fileBytes = renderBytes + assetsJsonBytes + qcJsonBytes + revJsonBytes;
  const jobTotalBytes = fileBytes + transcriptSnapshotBytes;
  const sharedJobs = Number(
    db.prepare("select count(*) as c from job where source=?").get(jobRow.source)?.c || 1,
  );
  const { sourceBytes } = getSourceStorageBytes(db, rootDir, jobRow.source);
  return {
    renderBytes,
    metaBytes: assetsJsonBytes + qcJsonBytes + revJsonBytes,
    transcriptSnapshotBytes,
    fileBytes,
    jobTotalBytes,
    sourceBytes,
    sourceSharedJobs: sharedJobs,
    hasRenderFile: renderBytes > 0,
  };
}

export function getStorageSummary(db, rootDir) {
  let renderBytes = 0;
  let sourceBytes = 0;
  let transcriptAndAssetBytes = 0;
  let databaseBytes = 0;
  let orphanBytes = 0;
  let orphanFilesCount = 0;

  const knownJobs = new Set(db.prepare("select id from job").all().map((r) => r.id));
  const knownSources = new Set(db.prepare("select id from source").all().map((r) => r.id));
  let knownAssets = new Set();
  try {
    knownAssets = new Set(db.prepare("select id from asset").all().map((r) => r.id));
  } catch {}

  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {}

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const full = path.join(rootDir, name);
    const size = safeFileSize(full);
    if (name.startsWith("studio.")) {
      databaseBytes += size;
      continue;
    }
    if (name.endsWith(".mp4") || name.endsWith(".mp4.assets.json") || name.endsWith(".qc.json") || name.endsWith(".rev.json")) {
      renderBytes += size;
      const jobId = name.split(".")[0];
      if (!knownJobs.has(jobId)) {
        orphanBytes += size;
        orphanFilesCount++;
      }
    } else if (name.endsWith(".source")) {
      sourceBytes += size;
      const srcId = name.slice(0, -".source".length);
      if (!knownSources.has(srcId)) {
        orphanBytes += size;
        orphanFilesCount++;
      }
    } else if (name.endsWith(".image")) {
      transcriptAndAssetBytes += size;
      const assetId = name.slice(0, -".image".length);
      if (!knownAssets.has(assetId)) {
        orphanBytes += size;
        orphanFilesCount++;
      }
    } else if (
      name.endsWith(".json") ||
      name.endsWith(".srt") ||
      name.endsWith(".voice.wav") ||
      name.endsWith(".wav")
    ) {
      transcriptAndAssetBytes += size;
    }
  }

  return {
    totalManagedBytes: renderBytes + sourceBytes + transcriptAndAssetBytes + databaseBytes,
    renderBytes,
    sourceBytes,
    transcriptAndAssetBytes,
    databaseBytes,
    orphanBytes,
    orphanFilesCount,
    jobCount: knownJobs.size,
    sourceCount: knownSources.size,
  };
}

export function estimateDeleteSavings(db, rootDir, jobIds, mode = "B") {
  if (!["A", "B", "C"].includes(mode)) throw Error("Mode penghapusan harus A, B, atau C.");
  const uniqueIds = [...new Set(Array.isArray(jobIds) ? jobIds : [])];
  if (!uniqueIds.length) {
    return { estimatedFreeBytes: 0, filesToDeleteCount: 0, sourcesToDeleteCount: 0, mode };
  }
  const idSet = new Set(uniqueIds);
  const rows = db
    .prepare("select * from job")
    .all()
    .filter((r) => idSet.has(r.id));

  let estimatedFreeBytes = 0;
  let filesToDeleteCount = 0;
  const affectedSources = new Set();

  for (const row of rows) {
    const det = getJobStorageDetails(db, rootDir, row);
    affectedSources.add(row.source);
    if (mode === "A") {
      estimatedFreeBytes += det.transcriptSnapshotBytes + 256;
    } else {
      estimatedFreeBytes += det.fileBytes + det.transcriptSnapshotBytes;
      for (const ext of [".mp4", ".mp4.assets.json", ".qc.json", ".rev.json"]) {
        if (safeFileSize(path.join(rootDir, row.id + ext)) > 0) filesToDeleteCount++;
      }
    }
  }

  let sourcesToDeleteCount = 0;
  if (mode === "C") {
    const allJobs = db.prepare("select id, source from job").all();
    for (const srcId of affectedSources) {
      if (!srcId) continue;
      const remainingForSource = allJobs.some((j) => j.source === srcId && !idSet.has(j.id));
      if (!remainingForSource && db.prepare("select id from source where id=?").get(srcId)) {
        const { sourceBytes, assetIds } = getSourceStorageBytes(db, rootDir, srcId);
        estimatedFreeBytes += sourceBytes;
        sourcesToDeleteCount++;
        filesToDeleteCount += 1 + assetIds.length;
      }
    }
  }

  return {
    estimatedFreeBytes,
    filesToDeleteCount,
    sourcesToDeleteCount,
    targetJobsCount: rows.length,
    mode,
  };
}

export async function deleteHistoryJobs({
  db,
  rootDir,
  jobIds = [],
  deleteAll = false,
  mode = "B",
  confirm = false,
  confirmSourceDelete = false,
  stopActiveJob = async () => {},
  illustrationCounts = null,
}) {
  if (confirm !== true) {
    throw Error("Konfirmasi penghapusan diperlukan sebelum menghapus riwayat.");
  }
  if (!["A", "B", "C"].includes(mode)) {
    throw Error("Pilih mode penghapusan A, B, atau C.");
  }
  if (mode === "C" && confirmSourceDelete !== true) {
    throw Error("Mode C memerlukan konfirmasi khusus untuk menghapus video sumber yang dikelola aplikasi.");
  }

  const targetRows = deleteAll
    ? db.prepare("select * from job").all()
    : db
        .prepare("select * from job")
        .all()
        .filter((r) => jobIds.includes(r.id));

  if (!targetRows.length) {
    return {
      deletedJobsCount: 0,
      deletedSourcesCount: 0,
      deletedFilesCount: 0,
      freedBytes: 0,
      mode,
    };
  }

  // 1. Hentikan pekerjaan yang sedang berjalan atau dijeda terlebih dahulu dan tunggu berhenti
  for (const row of targetRows) {
    if (["berjalan", "dijeda", "menunggu"].includes(row.status)) {
      db.prepare("update job set status='dibatalkan' where id=?").run(row.id);
      await stopActiveJob(row.id);
    }
  }

  const targetIdSet = new Set(targetRows.map((r) => r.id));
  const affectedSources = new Set(targetRows.map((r) => r.source).filter(Boolean));
  let freedBytes = 0;
  let deletedFilesCount = 0;

  // 2. Jika Mode B atau C, hapus file output yang khusus milik pekerjaan tersebut
  if (mode === "B" || mode === "C") {
    for (const row of targetRows) {
      for (const ext of [".mp4", ".mp4.assets.json", ".qc.json", ".rev.json"]) {
        const p = path.join(rootDir, row.id + ext);
        if (fs.existsSync(p)) {
          freedBytes += safeDeleteFile(rootDir, p);
          deletedFilesCount++;
        }
      }
      illustrationCounts?.delete(row.id);
    }
  }

  // 3. Hapus catatan pekerjaan dari database SQLite dalam transaksi
  db.exec("begin");
  try {
    const delTranscript = db.prepare("delete from render_transcript where job=?");
    const delJob = db.prepare("delete from job where id=?");
    for (const row of targetRows) {
      const trLen = Number(
        db.prepare("select length(segments) as len from render_transcript where job=?").get(row.id)?.len || 0,
      );
      freedBytes += trLen;
      delTranscript.run(row.id);
      delJob.run(row.id);
    }
    db.exec("commit");
  } catch (e) {
    db.exec("rollback");
    throw e;
  }

  // 4. Jika Mode C, hapus data sumber yang tidak lagi digunakan oleh pekerjaan lain
  let deletedSourcesCount = 0;
  if (mode === "C") {
    for (const srcId of affectedSources) {
      const stillUsed = Number(
        db.prepare("select count(*) as c from job where source=?").get(srcId)?.c || 0,
      );
      if (stillUsed > 0) continue;
      const srcExists = db.prepare("select id from source where id=?").get(srcId);
      if (!srcExists) continue;

      let assetRows = [];
      try {
        assetRows = db.prepare("select id from asset where source=?").all(srcId);
      } catch {}

      for (const a of assetRows) {
        const imgPath = path.join(rootDir, a.id + ".image");
        if (fs.existsSync(imgPath)) {
          freedBytes += safeDeleteFile(rootDir, imgPath);
          deletedFilesCount++;
        }
      }
      for (const ext of [".source", ".json", ".srt", ".wav", ".partial.json", ".voice.wav", ".voice.json"]) {
        const p = path.join(rootDir, srcId + ext);
        if (fs.existsSync(p)) {
          freedBytes += safeDeleteFile(rootDir, p);
          deletedFilesCount++;
        }
      }

      db.exec("begin");
      try {
        try {
          db.prepare("delete from asset where source=?").run(srcId);
        } catch {}
        try {
          db.prepare("delete from transcript where source=?").run(srcId);
        } catch {}
        db.prepare("delete from source where id=?").run(srcId);
        db.exec("commit");
        deletedSourcesCount++;
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
    }
  }

  return {
    deletedJobsCount: targetRows.length,
    deletedSourcesCount,
    deletedFilesCount,
    freedBytes,
    mode,
    remainingJobsCount: Number(db.prepare("select count(*) as c from job").get()?.c || 0),
  };
}

export function syncStorageAndCleanupTemp({ db, rootDir, activeJobId = null }) {
  let cleanedBytes = 0;
  let cleanedFiles = 0;

  // Bersihkan baris render_transcript yatim
  const orphanTr = db
    .prepare("select job from render_transcript where job not in (select id from job)")
    .all();
  for (const r of orphanTr) {
    db.prepare("delete from render_transcript where job=?").run(r.job);
  }

  // Bersihkan file sementara transkripsi jika tidak ada transkripsi berjalan
  const activeTr = db.prepare("select source from transcript where status='berjalan'").get();
  if (!activeTr) {
    let entries = [];
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch {}
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(".partial.json") || entry.name.endsWith(".wav")) {
        if (entry.name.endsWith(".voice.wav")) continue;
        const p = path.join(rootDir, entry.name);
        cleanedBytes += safeDeleteFile(rootDir, p);
        cleanedFiles++;
      }
    }
  }

  // Bersihkan folder kerja sementara .cache/job-* jika tidak ada worker aktif
  if (!activeJobId && fs.existsSync(".cache")) {
    try {
      for (const entry of fs.readdirSync(".cache", { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith("job-")) {
          fs.rmSync(path.resolve(".cache", entry.name), { recursive: true, force: true });
          cleanedFiles++;
        }
      }
    } catch {}
  }

  return {
    cleanedBytes,
    cleanedFiles,
    orphanTranscriptsRemoved: orphanTr.length,
  };
}

export function registerHistoryRoutes({
  app,
  db,
  root,
  stopActiveJob,
  illustrationCounts,
  getActiveJobId,
}) {
  app.get("/api/history", (_req, res) => {
    const sourcesMap = new Map(
      db
        .prepare("select id, name, meta, created from source")
        .all()
        .map((s) => [s.id, { ...s, meta: JSON.parse(s.meta) }]),
    );
    const items = db
      .prepare("select * from job order by created desc")
      .all()
      .map((j) => {
        const settings = JSON.parse(j.settings);
        const storage = getJobStorageDetails(db, root, j);
        const src = sourcesMap.get(j.source);
        let qc = null;
        try {
          const qcPath = path.join(root, j.id + ".qc.json");
          if (fs.existsSync(qcPath)) qc = JSON.parse(fs.readFileSync(qcPath, "utf8"));
        } catch {}
        return {
          ...j,
          settings,
          sourceName: src?.name || "Sumber telah dihapus",
          sourceExists: !!src,
          storage,
          qcStatus: qc?.status || settings.qcStatus || null,
          qcSummary: qc?.summary || null,
        };
      });
    res.json({
      items,
      storageSummary: getStorageSummary(db, root),
    });
  });

  app.post("/api/history/estimate", (req, res) => {
    const mode = req.body?.mode || "B";
    const deleteAll = req.body?.deleteAll === true;
    const jobIds = deleteAll
      ? db.prepare("select id from job").all().map((r) => r.id)
      : Array.isArray(req.body?.jobIds)
        ? req.body.jobIds
        : [];
    res.json(estimateDeleteSavings(db, root, jobIds, mode));
  });

  app.post("/api/history/delete", async (req, res) => {
    const result = await deleteHistoryJobs({
      db,
      rootDir: root,
      jobIds: Array.isArray(req.body?.jobIds) ? req.body.jobIds : [],
      deleteAll: req.body?.deleteAll === true,
      mode: req.body?.mode || "B",
      confirm: req.body?.confirm === true,
      confirmSourceDelete: req.body?.confirmSourceDelete === true,
      stopActiveJob,
      illustrationCounts,
    });
    res.json({
      ...result,
      storageSummary: getStorageSummary(db, root),
    });
  });

  app.post("/api/history/sync", (_req, res) => {
    const sync = syncStorageAndCleanupTemp({
      db,
      rootDir: root,
      activeJobId: getActiveJobId?.() || null,
    });
    res.json({
      ...sync,
      storageSummary: getStorageSummary(db, root),
    });
  });
}
