import fs from "node:fs/promises";
import path from "node:path";
import { stockShot } from "./stock.mjs";
import { analyze } from "./content-intelligence.mjs";
import { createHash } from "node:crypto";

// Padanan objek konkret membantu pencarian Commons untuk ujaran Indonesia.
const objects = {
  medieval: "barbute",
  "abad pertengahan": "barbute",
  parfum: "perfume bottle",
  gamepad: "game controller",
  "mesin tik": "typewriter",
  radio: "transistor radio",
  "kereta api": "railway train",
  sawah: "rice terrace",
  "gunung berapi": "volcano",
  pesawat: "fighter aircraft",
  kopi: "coffee beans",
  gempa: "seismograph",
  kamera: "camera",
  mikroskop: "microscope",
  teleskop: "telescope",
  sepeda: "bicycle",
  kompas: "compass",
  "rumah gadang": "Rumah Gadang",
  hutan: "forest",
  peta: "map",
  penyu: "sea turtle",
  candi: "Indonesian temple",
  tambang: "mining",
  satelit: "satellite",
  kapal: "ship",
  "terumbu karang": "coral reef",
  bursa: "stock exchange",
  uang: "banknote",
  inflasi: "money currency",
  parlemen: "parliament building",
  mikrofon: "studio microphone",
  podcast: "microphone",
  ponsel: "smartphone",
  laptop: "laptop computer",
  server: "server rack",
  dokumen: "archival document",
  pengadilan: "courthouse",
  "jam tangan": "wristwatch",
  kota: "city skyline",
  pabrik: "factory",
  mobil: "automobile",
  buku: "old book",
  "area 51": "Area 51",
  "piring terbang": "flying saucer",
  ufo: "UFO",
  roswell: "Roswell UFO incident",
  "google map": "satellite map",
  "google maps": "satellite map",
  "pangkalan udara": "air base",
  "pesawat tempur": "fighter aircraft",
  "rekayasa balik": "reverse engineering",
  "perang dingin": "Cold War",
  alien: "extraterrestrial",
  kriptid: "Bigfoot",
  kriptit: "Bigfoot",
  bigfoot: "Bigfoot",
  piramida: "Egyptian pyramids",
  roket: "rocket launch",
  nuklir: "nuclear weapon",
  "kapal selam": "submarine",
  radar: "radar",
};

export function cleanAttribution(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

export function isAcceptableCommonsLicense(license, creator) {
  if (!license || typeof license !== "string") return false;
  const norm = license.trim();
  if (["Public domain", "CC0", "PD"].includes(norm)) return true;
  if (/^CC[- ]BY(?:[- ]SA)?(?:\s+\d+(?:\.\d+)?)?$/i.test(norm)) {
    return Boolean(creator && creator.trim().length >= 2);
  }
  return false;
}

export function cues(segments, start, end, concepts = new Map()) {
  const found = [],
    seen = new Set();
  for (const s of segments) {
    if (s.end <= start || s.start >= end) continue;
    const words = (s.words || []).filter(
      (w) => w.start >= start && w.start < end,
    );
    const text = words.length
      ? words.map((w) => w.text).join(" ")
      : s.start >= start && s.end <= end
        ? s.text
        : "";
    const object = Object.keys(objects).find((k) =>
      new RegExp("\\b" + k + "\\b", "i").test(text),
    );
    const normalized = text.toLowerCase().match(/[\p{L}\d]+/gu) || [];
    const concept = normalized
      .flatMap((_, i) => [
        normalized.slice(i, i + 4).join(" "),
        normalized.slice(i, i + 3).join(" "),
        normalized.slice(i, i + 2).join(" "),
        normalized[i],
      ])
      .find((key) => concepts.has(key));
    const topic = object || concept;
    if (!topic || seen.has(topic.toLowerCase())) continue;
    const word = words.find((w) =>
      w.text.toLowerCase().includes(topic.split(" ")[0].toLowerCase()),
    );
    const at = Math.max(0, (word?.start ?? s.start) - start);
    if (end - start - at < 1) continue;
    const conceptInfo = concepts.get(topic.toLowerCase());
    found.push({
      at,
      topic,
      query: objects[topic] || conceptInfo?.query,
      fileTitle: conceptInfo?.fileTitle,
      visualType: object ? "foto" : "ilustrasi",
      ...(conceptInfo?.wikiTitle ? { wikiTitle: conceptInfo.wikiTitle } : {}),
      ...(conceptInfo?.wikiExtract ? { wikiExtract: conceptInfo.wikiExtract } : {}),
    });
    seen.add(topic.toLowerCase());
  }
  return found;
}

const headers = {
  "User-Agent": "PodcastAIEditor/1.0 (local documentary illustration search)",
};

async function illustratedConcepts(segments, start, end) {
  const nouns = new Map(),
    concepts = new Map();
  const stop =
    /^(saya|aku|kamu|kita|mereka|punya|dengan|kalau|untuk|seperti|bukan|karena|sudah|akan|yang|lagi|dari|pada|terus|banget|bisa|jadi|juga|rumahnya|dalam|waktu|sampai|ketika|tapi|setelah|masih|orang|adalah|sama|tidak|kayak|salah|lihat|begitu|malah|banyak|memang|berarti|hewan|barang|tahun|dunia|tempat|negara|bagian|masalah|cerita|percaya|bikin|bilang|sebelum|sesudah|depan|belakang|bawah|atas|semua|sendiri|sekarang|kemarin|besok)$/;
  for (const seg of segments) {
    if (seg.start < start || seg.end > end) continue;
    const words = seg.text.toLowerCase().match(/[\p{L}\d-]+/gu) || [];
    for (const phrase of seg.text.match(
      /\b[A-Z][a-z0-9]+(?:\s+[A-Z0-9][a-z0-9]+){1,3}\b/g,
    ) || []) {
      nouns.set(phrase, (nouns.get(phrase) || 0) + 4);
    }
    for (let i = 0; i < words.length; i++) {
      if (words[i].length < 3 || stop.test(words[i])) continue;
      for (const term of [
        words[i].length >= 4 ? words[i] : "",
        words[i + 1] && !stop.test(words[i + 1])
          ? words.slice(i, i + 2).join(" ")
          : "",
      ]) {
        if (term) nouns.set(term, (nouns.get(term) || 0) + 1);
      }
    }
  }
  const titles = [...nouns]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([term]) => term);
  if (!titles.length) return concepts;
  const qs = new URLSearchParams({
    action: "query",
    format: "json",
    redirects: "1",
    titles: titles.join("|"),
    prop: "pageimages|langlinks|pageprops|extracts",
    piprop: "name",
    lllang: "en",
    lllimit: "50",
    ppprop: "disambiguation",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
  });
  try {
    const r = await fetch("https://id.wikipedia.org/w/api.php?" + qs, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok)
      for (const p of Object.values((await r.json()).query?.pages || {})) {
        const titleLower = (p.title || "").toLowerCase();
        const rawText = typeof p.extract === "string" ? p.extract.replace(/\s+/g, " ").trim() : "";
        const rawExtract = rawText.length > 235 ? rawText.slice(0, 235).replace(/\s+\S*$/, "") : rawText;
        const hasValidImage = Boolean(p.pageimage && p.pageprops?.disambiguation === undefined && p.langlinks?.length);
        const hasKnownObjectExtract = Boolean(rawExtract.length > 40 && p.pageprops?.disambiguation === undefined && objects[titleLower]);
        if (hasValidImage || hasKnownObjectExtract)
          if (
            !/^(rumah|malam|tidur|tengah malam|hari|hidup|suara|keluarga|pintu|jalan|waktu|dengar|arah|mata|tangan|kepala|hewan|manusia|bumi|dunia|tahun|air|api|tanah|udara|orang|negara|kota)$/i.test(
              p.title,
            )
          ) {
            concepts.set(titleLower, {
              query: p.langlinks?.[0]?.["*"] || objects[titleLower] || p.title,
              fileTitle: p.pageimage ? "File:" + p.pageimage.replaceAll("_", " ") : undefined,
              wikiTitle: p.title,
              wikiExtract: rawExtract,
            });
          }
      }
  } catch {}
  return concepts;
}

async function findPhoto(cue) {
  const cache = path.resolve(".cache", "documentary");
  await fs.mkdir(cache, { recursive: true });
  const key = createHash("sha256")
    .update(cue.fileTitle || cue.query)
    .digest("hex");
  const photo = path.join(cache, key + ".jpg"),
    record = path.join(cache, key + ".json");
  try {
    await fs.access(photo);
    return { ...JSON.parse(await fs.readFile(record, "utf8")), photo };
  } catch {}
  const qs = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: '"' + cue.query.replaceAll('"', "") + '" filetype:bitmap',
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "960",
    iiextmetadatafilter: "LicenseShortName|Restrictions|ImageDescription|Artist|Attribution|Credit",
  });
  if (cue.fileTitle) {
    for (const key of ["generator", "gsrnamespace", "gsrlimit", "gsrsearch"])
      qs.delete(key);
    qs.set("titles", cue.fileTitle);
  }
  const r = await fetch("https://commons.wikimedia.org/w/api.php?" + qs, {
    headers,
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error("Commons HTTP " + r.status);
  const pages = Object.values((await r.json()).query?.pages || {}).sort(
    (a, b) => a.index - b.index,
  );
  for (const page of pages) {
    const im = page.imageinfo?.[0],
      license = im?.extmetadata?.LicenseShortName?.value;
    const creator =
      cleanAttribution(im?.extmetadata?.Artist?.value) ||
      cleanAttribution(im?.extmetadata?.Attribution?.value) ||
      cleanAttribution(im?.extmetadata?.Credit?.value);
    if (
      !isAcceptableCommonsLicense(license, creator) ||
      im?.extmetadata?.Restrictions?.value ||
      im?.mime !== "image/jpeg"
    )
      continue;
    const title = page.title.replace(/^File:/, "").replace(/\.jpe?g$/i, "");
    const description = (im.extmetadata.ImageDescription?.value || "").replace(
      /<[^>]+>/g,
      " ",
    );
    const searchable = (title + " " + description).toLowerCase();
    if (
      !cue.fileTitle &&
      !cue.query
        .split(" ")
        .every((token) => searchable.includes(token.toLowerCase()))
    )
      continue;
    const url = new URL(im.thumburl || im.url);
    if (
      url.protocol !== "https:" ||
      !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname)
    )
      continue;
    const response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (
      !response.ok ||
      response.headers.get("content-type")?.split(";")[0] !== "image/jpeg"
    )
      continue;
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 ** 2) break;
      chunks.push(chunk);
    }
    if (!bytes || bytes > 8 * 1024 ** 2) continue;
    const data = Buffer.concat(chunks);
    if (data.readUInt16BE(0) !== 0xffd8) continue;
    const meta = {
      title,
      license,
      creator: creator || "Wikimedia Commons",
      page: im.descriptionurl,
      sourceType: "Wikimedia Commons",
      visualType: cue.visualType || "ilustrasi",
    };
    await fs.writeFile(photo, data);
    await fs.writeFile(record, JSON.stringify(meta));
    return { ...meta, photo };
  }
}

export async function documentary(segments, start, end, dir) {
  const shots = [];
  const concepts = await illustratedConcepts(segments, start, end);
  for (const cue of cues(segments, start, end, concepts)) {
    if (cue.at < (shots.at(-1)?.at ?? -10) + 4.0) continue;
    const hasWiki = Boolean(cue.wikiExtract && cue.wikiExtract.length > 35);
    const idx = shots.length;
    try {
      let match = await findPhoto(cue);
      if (!match && cue.fileTitle && cue.query) {
        match = await findPhoto({ ...cue, fileTitle: undefined });
      }
      if (match) {
        const name = "illustration-" + idx + ".jpg";
        await fs.copyFile(match.photo, path.join(dir, name));
        const displayMode =
          hasWiki && idx % 3 === 1
            ? "wiki-card"
            : idx % 3 === 0
              ? "cutout-blur"
              : idx % 4 === 2
                ? "fullscreen-circle"
                : "fullscreen-broll";
        shots.push({
          ...cue,
          name,
          title: match.title,
          license: match.license,
          creator: match.creator,
          page: match.page,
          sourceType: match.sourceType,
          visualType: match.visualType,
          displayMode,
        });
        continue;
      }
    } catch (e) {
      console.warn("Ilustrasi dilewati:", cue.query, e.message);
    }
    if (hasWiki) {
      shots.push({
        ...cue,
        name: "",
        title: cue.wikiTitle || cue.topic,
        license: "CC BY-SA 4.0",
        creator: "Wikipedia bahasa Indonesia",
        page: "https://id.wikipedia.org/wiki/" + encodeURIComponent((cue.wikiTitle || cue.topic).replaceAll(" ", "_")),
        sourceType: "Wikipedia",
        visualType: "ilustrasi",
        displayMode: "wiki-card",
      });
    }
  }
  if (!shots.length && process.env.STOCK_SEARCH_URL) {
    for (const scene of analyze(segments, start, end).scenes.slice(0, 3)) {
      const item = await stockShot(
        scene.query,
        dir,
        "stock-" + shots.length + ".jpg",
      );
      if (item)
        shots.push({
          ...item,
          at: scene.at,
          query: scene.query,
          sourceType: "Stok Berizin",
          visualType: "b-roll",
        });
    }
  }
  return shots;
}
