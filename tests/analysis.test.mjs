import test from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../server/highlights.mjs";
import { youtubeURL } from "../server/imports.mjs";
import { subtitleWords } from "../server/transcript.mjs";
test("tautan pendek dan watch menjadi URL kanonis", () => {
  for (const s of [
    "https://youtu.be/BaW_jenozKc",
    "https://www.youtube.com/watch?v=BaW_jenozKc&list=x",
  ])
    assert.equal(youtubeURL(s), "https://www.youtube.com/watch?v=BaW_jenozKc");
});
test("domain lain, kredensial, skema selain HTTPS dan playlist ditolak", () => {
  for (const s of [
    "file:///video",
    "https://youtube.com.example/watch?v=BaW_jenozKc",
    "https://x@youtube.com/watch?v=BaW_jenozKc",
    "https://youtube.com/playlist?list=1",
    "https://youtu.be/a/b",
  ])
    assert.throws(() => youtubeURL(s));
});
test("fallback kata mempertahankan batas segmen", () => {
  const w = subtitleWords({ text: "selamat pagi semua", start: 4, end: 7 });
  assert.equal(w[0].start, 4);
  assert.equal(w[2].end, 7);
});
test("seleksi mempertahankan konteks, batas segmen, durasi, dan jarak antarklip", async () => {
  const texts = [
    "Kopi berasal dari biji tanaman.",
    "Pengeringan menentukan rasa seduhan.",
    "Kereta listrik membawa penumpang.",
    "Jadwal keberangkatan tersedia setiap pagi.",
    "Penyu bertelur di pantai.",
    "Konservasi menjaga habitat dan ekosistem.",
  ];
  const segments = texts.map((text, i) => ({
    text,
    start: i * 10,
    end: i * 10 + 9,
  }));
  const r = await recommend(segments, { min: 15, count: 3 });
  assert.equal(r.clips.length, 3);
  for (const c of r.clips) {
    assert.ok(c.end - c.start >= 15 && c.end - c.start <= 30);
    assert.ok(segments.some((s) => s.start === c.start));
    assert.ok(segments.some((s) => s.end === c.end));
    assert.equal(
      r.clips.filter((x) => x.start < c.end && c.start < x.end).length,
      1,
    );
  }
  assert.equal(
    (await recommend(segments.slice(0, 1), { min: 15, count: 3 })).clips.length,
    0,
  );
});

test("anti-kalimat terputus, deteksi hook/punchline/emosi/retensi, dan anti-duplikat ketat", async () => {
  const block1 = [
    { start: 0, end: 5, text: "dan waktu itu kami masih bingung dengan" },
    { start: 5.5, end: 13, text: "Mengapa banyak kedai kopi gagal di tahun pertama?" },
    { start: 13.2, end: 21, text: "Karena margin bahan baku sering tidak dihitung sejak awal," },
    { start: 21.1, end: 27, text: "hasilnya arus kas langsung habis dalam tiga bulan!" },
  ];
  const r1 = await recommend(block1, { min: 15, count: 3 });
  assert.equal(r1.clips.length, 1);
  assert.equal(r1.clips[0].start, 5.5);
  assert.equal(r1.clips[0].end, 27);
  assert.match(r1.clips[0].hook, /Mengapa banyak kedai kopi/);
  assert.match(r1.clips[0].punchline, /habis dalam tiga bulan/);
  assert.ok(r1.clips[0].retentionScore >= 50 && r1.clips[0].hookScore >= 50 && r1.clips[0].contextScore >= 50);
  assert.ok(["Tinggi", "Kuat", "Sedang"].includes(r1.clips[0].retentionLevel));
  assert.ok(typeof r1.clips[0].emotion === "string" && r1.clips[0].emotion.length > 0);

  const withDuplicate = [
    ...block1,
    { start: 30, end: 39, text: "Mengapa banyak kedai kopi bangkrut pada tahun pertama?" },
    { start: 39.2, end: 48, text: "Karena biaya bahan baku sering tidak dihitung di awal." },
  ];
  const r2 = await recommend(withDuplicate, { min: 15, count: 3 });
  // Potongan kedua sangat mirip topik & bigrams-nya dengan potongan pertama sehingga disaring
  assert.equal(r2.clips.length, 1);
});
