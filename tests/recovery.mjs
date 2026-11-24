import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const dir = fs.mkdtempSync(path.resolve(".cache/recovery-")),
  port = Number(process.env.TEST_PORT || 34219),
  base = "http://127.0.0.1:" + port + "/api/";
if (
  await fetch(base + "state")
    .then(() => true)
    .catch(() => false)
)
  throw Error("Port uji sedang digunakan.");
let proc;
const sleep = () => new Promise((r) => setTimeout(r, 250));
async function start() {
  proc = spawn(process.execPath, ["server/index.mjs", "--production"], {
    env: { ...process.env, DATA_DIR: dir, PORT: String(port) },
    windowsHide: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) throw Error("Server uji gagal dimulai.");
    try {
      if ((await fetch(base + "state")).ok) return;
    } catch {}
    await sleep();
  }
  throw Error("Server uji belum siap.");
}
async function stop() {
  if (proc?.exitCode === null && proc.signalCode === null) {
    const closed = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await closed;
  }
}
async function post(route, body) {
  return fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function job(id, status) {
  for (let i = 0; i < 240; i++) {
    const j = (await (await fetch(base + "state")).json()).jobs.find(
      (j) => j.id === id,
    );
    if (j.status === status) return j;
    await sleep();
  }
  throw Error("Status tidak tercapai: " + status);
}
try {
  await start();
  const conflict = spawn(
    process.execPath,
    ["server/index.mjs", "--production"],
    {
      env: { ...process.env, DATA_DIR: dir, PORT: String(port + 1) },
      windowsHide: true,
      stdio: "ignore",
    },
  );
  const conflictExit = await new Promise((r) => conflict.once("exit", r));
  assert.notEqual(conflictExit, 0);
  assert.equal(
    (await post("youtube", { url: "https://example.com", rights: true }))
      .status,
    400,
  );
  assert.equal(
    (
      await post("youtube", {
        url: "https://youtu.be/BaW_jenozKc",
        rights: false,
      })
    ).status,
    400,
  );
  const fake = new FormData();
  fake.append("video", new Blob(["teks"]), "rusak.mp4");
  assert.equal(
    (await fetch(base + "source", { method: "POST", body: fake })).status,
    400,
  );
  const form = new FormData();
  form.append(
    "video",
    new Blob([fs.readFileSync("data/bukti/sumber-sintetis.mp4")]),
    "Uji.mp4",
  );
  const { id } = await (
    await fetch(base + "source", { method: "POST", body: form })
  ).json();
  assert.equal(
    (
      await post("render", {
        source: id,
        clips: [
          { start: 0, end: 2 },
          { start: -1, end: 2 },
        ],
      })
    ).status,
    400,
  );
  assert.equal((await (await fetch(base + "state")).json()).jobs.length, 0);
  const src = path.join(dir, id + ".source"),
    hold = path.join(dir, "sumber-uji.tmp");
  fs.renameSync(src, hold);
  const j = await (
    await post("render", { source: id, start: 0, end: 1, preview: true })
  ).json();
  assert.ok((await job(j.id, "gagal")).error);
  fs.renameSync(hold, src);
  assert.ok((await post("job/" + j.id + "/retry", {})).ok);
  await job(j.id, "selesai");
  const batch=await (await post("render",{source:id,clips:[{start:0,end:3},{start:0,end:2}],preset:"Cinematic",preview:true})).json();
  const [active,waiting]=batch.ids;
  const ctrl=async (jid,action)=>assert.ok((await post("job/"+jid+"/control",{action})).ok);
  await ctrl(active,"pause");await job(active,"dijeda");
  await ctrl(waiting,"pause");await ctrl(waiting,"resume");await ctrl(waiting,"cancel");
  await ctrl(active,"resume");await job(active,"berjalan");await ctrl(active,"cancel");
  await job(active,"dibatalkan");await job(waiting,"dibatalkan");
  assert.equal((await fetch(base+"job/"+active+"/video")).status,404);
  await stop();
  const db = new DatabaseSync(path.join(dir, "studio.sqlite"));
  db.prepare("update job set status='berjalan' where id=?").run(j.id);
  db.close();
  await start();
  assert.match((await job(j.id, "gagal")).error, /terhenti|berhenti/);
  assert.ok((await post("job/" + j.id + "/retry", {})).ok);
  await job(j.id, "selesai");
  console.log(
    "Lulus input rusak, izin/domain, batch atomik, retry serta pemulihan setelah restart.",
  );
} finally {
  await stop();
  fs.rmSync(dir, { force: true, recursive: true, maxRetries: 4 });
}
