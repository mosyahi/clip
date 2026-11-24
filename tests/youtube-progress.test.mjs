import assert from "node:assert/strict";
import test from "node:test";
import { downloadProgress } from "../server/youtube-progress.mjs";

test("menggabungkan byte video dan audio hingga file siap divalidasi", () => {
  const update = downloadProgress({
    requested_formats: [
      { format_id: "v", filesize: 80 },
      { format_id: "a", filesize_approx: 20 },
    ],
  });
  assert.equal(update("v", 40, 80).percent, 40);
  assert.equal(update("v", 80, 80).percent, 80);
  assert.equal(update("a", 5, 20).percent, 85);
  assert.equal(update("a", 20, 20).percent, 99);
});
test("ukuran belum diketahui menampilkan byte, estimasi baru tidak memundurkan bar", () => {
  const update = downloadProgress({ format_id: "mux" });
  assert.deepEqual(update("mux", 100, "NA"), { percent: null, bytes: 100 });
  assert.equal(update("mux", 500, 1000).percent, 50);
  assert.equal(update("mux", 550, 1500).percent, 50);
});
test("info.json bersih memakai ukuran trek terpilih tanpa menghitung gabungan dua kali", () => {
  const update = downloadProgress({
    format_id: "399+140",
    filesize_approx: 100,
    formats: [
      { format_id: "399", filesize: 80 },
      { format_id: "140", filesize: 20 },
    ],
  });
  assert.equal(update("399", 80, 80).percent, 80);
  assert.equal(update("140", 20, 20).percent, 99);
});
