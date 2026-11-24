import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

// Uji jaringan dengan film CC BY dari Blender, memakai basis data terpisah.
const dir = fs.mkdtempSync(path.resolve(".cache/tes-progres-"));
const port = String(process.env.TEST_PORT || 34241);
const base = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["server/index.mjs", "--production"], {
  env: { ...process.env, DATA_DIR: dir, PORT: port },
  windowsHide: true,
  stdio: "ignore",
});
let browser;
try {
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw Error("Server uji gagal dijalankan.");
    if (
      await fetch(base + "/api/state")
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((r) => setTimeout(r, 300));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.BROWSER_PATH ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage();
  await page.goto(base);
  await page.getByText("Impor dari YouTube", { exact: true }).click();
  await page.getByLabel("Tautan video").fill("https://youtu.be/YE7VzlLtp-4");
  await page.getByRole("checkbox", { name: /Saya memiliki izin/ }).check();
  await page.evaluate(() => {
    window.samples = [];
    new MutationObserver(() => {
      const bar = document.querySelector(".import-progress progress");
      if (bar && window.samples.at(-1) !== bar.value)
        window.samples.push(bar.value);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
  await page.getByRole("button", { name: "Impor dari tautan" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".import-progress progress")?.value === 100 ||
      document.querySelector(".import-progress [role=alert]"),
    null,
    { timeout: 240000 },
  );
  const samples = await page.evaluate(() => window.samples);
  console.log(samples);
  assert.equal(samples[0], 0);
  assert.ok(
    samples.some((p) => p > 0 && p < 100),
    "Tidak ada progres unduhan parsial",
  );
  assert.equal(samples.at(-1), 100);
  assert.equal(
    (await (await fetch(base + "/api/state")).json()).sources.length,
    1,
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const ended = new Promise((r) => server.once("exit", r));
    server.kill();
    await ended;
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 4 });
}
