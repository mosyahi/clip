import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  assertSafeManagedPath,
  deleteHistoryJobs,
  estimateDeleteSavings,
  getStorageSummary,
  syncStorageAndCleanupTemp,
} from "../server/history.mjs";

function createTestStudio() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clip-history-"));
  const externalFile = path.join(os.tmpdir(), "user-original-" + Date.now() + ".mp4");
  fs.writeFileSync(externalFile, Buffer.alloc(2048, 7));

  const db = new DatabaseSync(path.join(dir, "studio.sqlite"));
  db.exec(`
    create table source(id text primary key,name text,meta text,created integer);
    create table job(id text primary key,source text,settings text,status text,progress integer,error text,created integer);
    create table render_transcript(job text primary key,segments text);
    create table transcript(source text primary key,status text,progress integer,error text,content text);
    create table asset(id text primary key,source text,name text);
  `);
  return { dir, db, externalFile };
}

test("keamanan path: menolak penghapusan di luar folder data dan file sistem yang dilindungi", () => {
  const { dir, db, externalFile } = createTestStudio();
  try {
    assert.throws(() => assertSafeManagedPath(dir, externalFile), /di luar folder/);
    assert.throws(() => assertSafeManagedPath(dir, path.join(dir, "..", "outside.mp4")), /di luar folder/);
    assert.throws(() => assertSafeManagedPath(dir, path.join(dir, "studio.sqlite")), /dilindungi/);
    assert.throws(() => assertSafeManagedPath(dir, path.join(dir, "bukti", "sample.mp4")), /dilindungi/);
  } finally {
    db.close();
    fs.rmSync(externalFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("penghapusan single (Mode A & B), bulk, all (Mode C), pembatalan active job, dan perlindungan sumber bersama", async () => {
  const { dir, db, externalFile } = createTestStudio();
  try {
    // Siapkan 2 sumber dan 4 pekerjaan
    db.prepare("insert into source values(?,?,?,?)").run("src1", "Podcast 1.mp4", '{"duration":60}', Date.now());
    db.prepare("insert into source values(?,?,?,?)").run("src2", "Podcast 2.mp4", '{"duration":90}', Date.now());
    fs.writeFileSync(path.join(dir, "src1.source"), Buffer.alloc(5000, 1));
    fs.writeFileSync(path.join(dir, "src1.json"), '{"segments":[]}');
    fs.writeFileSync(path.join(dir, "src2.source"), Buffer.alloc(6000, 2));

    for (const [id, src, st] of [
      ["job1", "src1", "selesai"],
      ["job2", "src1", "selesai"],
      ["job3", "src2", "berjalan"],
      ["job4", "src2", "selesai"],
    ]) {
      db.prepare("insert into job values(?,?,?,?,?,?,?)").run(id, src, '{"start":0,"end":15}', st, 50, "", Date.now());
      db.prepare("insert into render_transcript values(?,?)").run(id, '[{"text":"halo"}]');
      fs.writeFileSync(path.join(dir, id + ".mp4"), Buffer.alloc(3000, 3));
      fs.writeFileSync(path.join(dir, id + ".mp4.assets.json"), "[]");
    }

    // 1. Tolak tanpa konfirmasi
    await assert.rejects(() =>
      deleteHistoryJobs({ db, rootDir: dir, jobIds: ["job1"], mode: "B", confirm: false }),
    );

    // 2. Mode A (Single): hapus catatan job1 saja, file job1.mp4 tetap ada
    const delA = await deleteHistoryJobs({
      db,
      rootDir: dir,
      jobIds: ["job1"],
      mode: "A",
      confirm: true,
    });
    assert.equal(delA.deletedJobsCount, 1);
    assert.equal(fs.existsSync(path.join(dir, "job1.mp4")), true);

    // 3. Mode B (Single): hapus job2 beserta file render-nya, tetapi src1.source tetap aman
    const estB = estimateDeleteSavings(db, dir, ["job2"], "B");
    assert.ok(estB.estimatedFreeBytes >= 3000);
    const delB = await deleteHistoryJobs({
      db,
      rootDir: dir,
      jobIds: ["job2"],
      mode: "B",
      confirm: true,
    });
    assert.equal(delB.deletedJobsCount, 1);
    assert.equal(fs.existsSync(path.join(dir, "job2.mp4")), false);
    assert.equal(fs.existsSync(path.join(dir, "src1.source")), true);

    // 4. Active job + Shared source di Mode C (Bulk/Single):
    // Hapus job3 (sedang 'berjalan') dengan Mode C, pastikan stopActiveJob dipanggil,
    // tetapi src2.source TIDAK dihapus karena job4 masih memakainya!
    let stoppedId = null;
    await assert.rejects(() =>
      deleteHistoryJobs({
        db,
        rootDir: dir,
        jobIds: ["job3"],
        mode: "C",
        confirm: true,
        confirmSourceDelete: false,
      }),
    );
    const delC1 = await deleteHistoryJobs({
      db,
      rootDir: dir,
      jobIds: ["job3"],
      mode: "C",
      confirm: true,
      confirmSourceDelete: true,
      stopActiveJob: async (id) => {
        stoppedId = id;
      },
    });
    assert.equal(stoppedId, "job3");
    assert.equal(delC1.deletedJobsCount, 1);
    assert.equal(delC1.deletedSourcesCount, 0);
    assert.equal(fs.existsSync(path.join(dir, "src2.source")), true);

    // 5. Delete All dengan Mode C: menghapus job4 DAN src2.source karena tidak ada job lain yang memakainya
    const delAll = await deleteHistoryJobs({
      db,
      rootDir: dir,
      deleteAll: true,
      mode: "C",
      confirm: true,
      confirmSourceDelete: true,
    });
    assert.equal(delAll.deletedJobsCount, 1);
    assert.equal(delAll.deletedSourcesCount, 1);
    assert.equal(fs.existsSync(path.join(dir, "src2.source")), false);
    // File asli pengguna di luar folder data tidak pernah tersentuh
    assert.equal(fs.existsSync(externalFile), true);

    // 6. Sinkronisasi membersihkan file sementara .partial.json & .wav
    fs.writeFileSync(path.join(dir, "temp.partial.json"), "{}");
    const sync = syncStorageAndCleanupTemp({ db, rootDir: dir });
    assert.ok(sync.cleanedFiles >= 1);
    assert.equal(fs.existsSync(path.join(dir, "temp.partial.json")), false);
    assert.ok(getStorageSummary(db, dir).totalManagedBytes >= 0);
  } finally {
    db.close();
    fs.rmSync(externalFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
