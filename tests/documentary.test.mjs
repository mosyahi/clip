import test from "node:test";
import assert from "node:assert/strict";
import { cues, isAcceptableCommonsLicense, cleanAttribution } from "../server/documentary.mjs";
test("istilah tema dalam kata gabungan mengikuti timestamp ucapan",()=>{
  const found=cues([{start:4,end:7,text:"game medieval-favorit?",words:[{text:"game",start:4},{text:"medieval",start:4.8},{text:"-favorit?",start:5.3}]}],4,7);
  assert.equal(found[0].topic,"medieval");
  assert.ok(Math.abs(found[0].at-.8)<1e-6);
});

test("ilustrasi mengikuti waktu kata dan hanya muncul sekali untuk topik yang sama", () => {
  const result = cues(
    [
      {
        start: 4,
        end: 9,
        text: "suara radio",
        words: [
          { text: "suara", start: 4 },
          { text: "radio", start: 7 },
        ],
      },
      { start: 15, end: 17, text: "radio" },
      { start: 21, end: 25, text: "kereta api" },
    ],
    5,
    20,
  );
  assert.deepEqual(
    result.map(({ at, query }) => [at, query]),
    [[2, "transistor radio"]],
  );
});
test("konsep ensiklopedis terikat ke foto artikel, narasi tanpa topik dilewati", () => {
  const map = new Map([
    ["angklung", { query: "Angklung", fileTitle: "File:Angklung.jpg" }],
  ]);
  const result = cues(
    [
      { start: 0, end: 2, text: "Begitulah ceritanya" },
      { start: 8, end: 12, text: "Bunyi angklung terdengar" },
    ],
    0,
    15,
    map,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].fileTitle, "File:Angklung.jpg");
});

test("lisensi terbuka Wikimedia CC BY/CC BY-SA memerlukan kreator dan menolak tanpa atribusi", () => {
  assert.equal(isAcceptableCommonsLicense("Public domain", ""), true);
  assert.equal(isAcceptableCommonsLicense("CC0", ""), true);
  assert.equal(isAcceptableCommonsLicense("CC BY 4.0", "Budi Santoso"), true);
  assert.equal(isAcceptableCommonsLicense("CC-BY-SA 3.0", "Museum Nasional"), true);
  assert.equal(isAcceptableCommonsLicense("CC BY 4.0", ""), false);
  assert.equal(isAcceptableCommonsLicense("All rights reserved", "Budi"), false);
  assert.equal(cleanAttribution('<a href="x">Fotografer Uji</a>'), "Fotografer Uji");
});
