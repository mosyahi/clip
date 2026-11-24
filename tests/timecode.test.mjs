import test from "node:test";
import assert from "node:assert/strict";
import { parseTime, timecode } from "../components/timecode.mjs";

test("waktu editor menerima detik, menit:detik, jam:menit:detik dan pecahan", () => {
  for (const [value, seconds] of [
    ["12:30", 750],
    ["1:02:03.45", 3723.45],
    ["62:03,45", 3723.45],
    ["1.25", 1.25],
  ]) {
    assert.equal(parseTime(value), seconds);
    assert.equal(parseTime(timecode(seconds)), seconds);
  }
});
test("waktu kosong dan format rusak ditolak", () => {
  for (const value of ["", "-1", "12:70", "x", "1:70:01"])
    assert.throws(() => parseTime(value));
});
