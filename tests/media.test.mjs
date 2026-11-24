import test from "node:test";
import assert from "node:assert/strict";
import { bounds } from "../server/media.mjs";
test("rentang di dalam media", () => bounds(0, 4, 4));
test("menolak rentang di luar media, kosong, atau tidak numerik", () => {
  for (const [a, b] of [
    [-1, 1],
    [1, 1],
    [0, 5],
    [0, NaN],
    ["0", 1],
  ])
    assert.throws(() => bounds(a, b, 4));
});
