import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { parseTime } from "../components/timecode.mjs";

const base = "http://127.0.0.1:" + (process.env.PORT || 3210);
const state = await (await fetch(base + "/api/state")).json();
let source, range;
for (const s of state.sources) {
  const t = await (
    await fetch(base + "/api/source/" + s.id + "/transcript")
  ).json();
  if (t.status !== "selesai") continue;
  const r = await (
    await fetch(base + "/api/source/" + s.id + "/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min: 15, count: 3 }),
    })
  ).json();
  if (r.clips?.length) {
    source = s;
    range = r.clips[0];
    break;
  }
}
assert.ok(source, "Siapkan sumber yang telah ditranskripsikan.");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
try {
  const page = await browser.newPage();
  await page.goto(base);
  await page.getByLabel("Video sumber").selectOption(source.id);
  await page.getByLabel("Cari bagian menarik dari").selectOption("range");
  const lo = Math.floor(range.start),
    hi = Math.ceil(range.end);
  await page
    .getByLabel("Dari (mm:ss)", { exact: true })
    .fill(Math.floor(lo / 60) + ":" + String(lo % 60).padStart(2, "0"));
  await page.getByLabel("Sampai (mm:ss)", { exact: true }).fill(String(hi));
  const result = page.waitForResponse((r) => r.url().endsWith("/highlights"));
  await page.getByRole("button", { name: "Cari highlight" }).click();
  const clips = (await (await result).json()).clips;
  assert.ok(clips.length && clips.every((c) => c.start >= lo && c.end <= hi));
  await page.getByRole("button", { name: "Buka di editor" }).first().click();
  assert.equal(
    parseTime(await page.getByLabel("Mulai (mm:ss atau detik)").inputValue()),
    clips[0].start,
  );
  assert.equal(
    parseTime(await page.getByLabel("Selesai (mm:ss atau detik)").inputValue()),
    clips[0].end,
  );
  console.log(
    "Lulus pencarian terbatas dan pemindahan timestamp ke editor.",
    source.name,
    lo,
    hi,
  );
} finally {
  await browser.close();
}
