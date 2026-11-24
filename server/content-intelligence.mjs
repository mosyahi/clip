import { recommendStyles, styles } from "./style-registry.mjs";
import { classifySceneAction, classifyVeracity, enrichSceneVisual } from "./style-timeline.mjs";
import { buildEditDecisionList } from "./director.mjs";

const stop = new Set(
  "yang dengan pada dari untuk bahwa adalah karena kalau dalam sudah bisa akan tidak jadi saya kita kamu mereka juga lebih itu ini ada dan terus kayak banget namun tapi lalu maka saat baru saja aja gitu gini selamat terima kasih langsung lagi dulu".split(
    " ",
  ),
);

function keywords(text) {
  const counts = new Map();
  for (const word of text.toLowerCase().match(/[\p{L}\d]{3,}/gu) || [])
    if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

const tones = [
  ["lucu", /lucu|ketawa|haha|ngakak|kocak/i],
  ["dramatis", /tiba-tiba|menegangkan|mengejutkan|ternyata|seram/i],
  ["investigatif", /bukti|misteri|konspirasi|kronologi|rumor|diduga/i],
  ["emosional", /sedih|takut|bahagia|haru|nangis|kecewa|marah/i],
  ["agresif", /marah|serang|bantah|keras|lawan/i],
  ["formal", /hadirin|terhormat|kebijakan|pemerintah|undang-undang/i],
  ["edukatif", /langkah|contoh|belajar|cara|konsep|rumus/i],
  ["serius", /risiko|penting|bahaya|krisis|dampak/i],
];

export function detectEmotion(text) {
  const match = tones.find(([, r]) => r.test(text));
  if (!match) return "santai";
  return {
    lucu: "lucu",
    dramatis: "tegang",
    investigatif: "penasaran",
    emosional: "emosional",
    agresif: "antusias",
    formal: "serius",
    edukatif: "inspiratif",
    serius: "serius",
  }[match[0]] || "santai";
}

export function analyze(segments, start, end) {
  const excerpt = segments.filter((s) => s.end > start && s.start < end);
  const text = excerpt.map((s) => s.text).join(" ");
  const suggestions = recommendStyles(text);
  const keys = keywords(text);
  const scenes = [];
  for (const s of excerpt) {
    const at = Math.max(0, s.start - start);
    const words = keywords(s.text);
    if (!words.length || at < (scenes.at(-1)?.end ?? -4) + 3) continue;
    const until = Math.min(end - start - 1, s.end - start, at + 3);
    if (until - at < 1) continue;
    const action = classifySceneAction(s.text);
    const veracity = classifyVeracity(s.text, action, suggestions[0].type);
    const topBehavior = styles.find((v) => v.type === suggestions[0].type)?.assetBehavior;
    const visual = enrichSceneVisual(s.text, action, veracity, scenes.length, topBehavior);
    scenes.push({
      at,
      end: until,
      query: words.slice(0, 3).join(" "),
      label: s.text.trim().split(/\s+/).slice(0, 12).join(" "),
      action,
      veracity,
      ...visual,
    });
  }
  const metrics = {
    hook: /\?|ternyata|mengapa|kenapa|rahasia|hati-hati/i.test(excerpt[0]?.text || "") ? 90 : 45,
    emotion: tones.some(([, r]) => r.test(text)) ? 78 : 32,
    tension: /tetapi|namun|konflik|ternyata|padahal/i.test(text) ? 80 : 35,
    novelty: /pertama|ternyata|baru|rahasia|jarang/i.test(text) ? 75 : 35,
    clarity: /[.!?]["”']?$/.test(text.trim()) ? 82 : 40,
    controversy: /debat|kontroversi|bantah|klaim|diduga/i.test(text) ? 80 : 22,
    education: /karena|contoh|langkah|cara|misalnya/i.test(text) ? 85 : 35,
    visual: Math.min(95, scenes.length * 20),
    replay: /tips|cara|rahasia|kunci|intinya/i.test(text) ? 82 : 40,
  };
  const pauses = excerpt.flatMap((s, i) =>
    i && s.start - excerpt[i - 1].end > 0.65
      ? [{ at: excerpt[i - 1].end - start, end: s.start - start }]
      : [],
  );
  const voiceStrategy =
    metrics.education > 70
      ? "Narasi singkat untuk memperkenalkan langkah pertama."
      : "Pertahankan suara pembicara dan jeda alaminya.";
  const subtopics = [...new Set(scenes.map((s) => s.query))];
  const score = text
    ? Math.round(
        Object.values(metrics).reduce((a, b) => a + b, 0) /
          Object.keys(metrics).length,
      )
    : 0;
  const topStyle = styles.find((v) => v.type === suggestions[0].type) || styles[0];
  const director = text
    ? buildEditDecisionList(segments, start, end, topStyle)
    : { edl: [], directorSummary: null };
  return {
    status: text ? "experimental" : "unavailable",
    topic: keys.slice(0, 3).join(" · "),
    keywords: keys,
    subtopics,
    voiceStrategy,
    pauses,
    tone: tones.find(([, r]) => r.test(text))?.[0] || "santai",
    emotion: detectEmotion(text),
    type: suggestions[0].type,
    suggestions,
    metrics,
    score,
    scenes,
    edl: director.edl,
    directorSummary: director.directorSummary,
  };
}
