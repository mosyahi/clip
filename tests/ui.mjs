import { chromium } from "playwright-core";
import path from "node:path";
import assert from "node:assert/strict";
process.env.TMP = process.env.TEMP = path.resolve(".cache");
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
try {
  const page = await browser.newPage({
      viewport: { width: 1320, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:" + (process.env.PORT || 3210));
  await page.getByRole("heading", { name: "Studio klip" }).waitFor();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("data/bukti/sumber-sintetis.mp4");
  await page.waitForFunction(
    () =>
      document.querySelector(".details strong")?.textContent ===
      "sumber-sintetis.mp4",
  );
  await page.getByLabel("Mulai (mm:ss atau detik)", { exact: true }).fill("0.5");
  await page.getByLabel("Selesai (mm:ss atau detik)", { exact: true }).fill("0:02");
  await page.getByRole("button", { name: "Render preview 360p" }).click();
  const v = page.locator("video");
  await page.waitForFunction(
    () => document.querySelector("video")?.src.includes("/api/job/"),
    {},
    { timeout: 60000 },
  );
  await v.evaluate(async (el) => {
    el.muted = true;
    await el.play();
  });
  await page.waitForFunction(
    () => document.querySelector("video").currentTime > 0,
  );
  assert.equal(await v.evaluate((el) => el.videoWidth), 360);
  await page.screenshot({ path: "data/bukti/dashboard.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log("Lulus unggah, trim, preview 360p, playback dan lebar seluler.");
} finally {
  await browser.close();
}

