import { useEffect, useState } from "react";
import { parseTime, timecode } from "./timecode.mjs";
export type Clip = {
  start: number;
  end: number;
  title: string;
  reason: string;
  topic?: string;
  tone?: string;
  emotion?: string;
  style?: string;
  score: number;
  hook: string;
  punchline?: string;
  hookScore?: number;
  punchlineScore?: number;
  emotionScore?: number;
  contextScore?: number;
  retentionScore?: number;
  retentionLevel?: string;
};
type Segment = { start: number; end: number; text: string };
type Transcript = {
  status: string;
  progress?: number;
  error?: string;
  segments?: Segment[];
};
export async function api(url: string, method = "GET", body?: any) {
  const form = body instanceof FormData;
  const res = await fetch("/api/" + url, {
    method,
    headers: body && !form ? { "Content-Type": "application/json" } : {},
    body: form ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw Error("Respons server bukan JSON (HTTP " + res.status + "). Mulai ulang server studio untuk memuat endpoint baru.");
  }
  if (!res.ok) throw Error(data.error || "Permintaan gagal.");
  return data;
}
export function Analysis({
  id,
  duration,
  provider,
  onUse,
  onBatch,
}: {
  id: string;
  duration: number;
  provider: boolean;
  onUse: (a: number, b: number, style?: string) => void;
  onBatch: (clips: Clip[]) => Promise<void>;
}) {
  const [tr, T] = useState<Transcript>({ status: "baru" }),
    [lang, L] = useState("id"),
    [clips, C] = useState<Clip[]>([]),
    [checked, K] = useState<number[]>([]),
    [min, M] = useState(15),
    [count, N] = useState(3),
    [useLLM, U] = useState(false),
    [mode, D] = useState(""),
    [error, F] = useState(""),
    [busy, B] = useState(false);
  const base = "source/" + id + "/";
  const [limited, setLimited] = useState(false);
  const [from, setFrom] = useState("0:00"),
    [until, setUntil] = useState(() => timecode(duration));
  function clearResults() {
    C([]);
    K([]);
    D("");
    F("");
  }
  async function refresh() {
    T(await api(base + "transcript"));
  }
  useEffect(() => {
    let alive = true;
    async function read() {
      try {
        const t = await api(base + "transcript");
        if (alive) T(t);
      } catch (e: any) {
        if (alive) F(e.message);
      }
    }
    void read();
    return () => {
      alive = false;
    };
  }, [id]);
  useEffect(() => {
    if (tr.status === "berjalan") {
      const t = setInterval(() => refresh().catch((e) => F(e.message)), 1600);
      return () => clearInterval(t);
    }
  }, [id, tr.status]);
  async function act(fn: () => Promise<void>) {
    B(true);
    F("");
    try {
      await fn();
    } catch (e: any) {
      F(e.message);
    } finally {
      B(false);
    }
  }
  async function suggest() {
    const r = await api(base + "highlights", "POST", {
      min,
      count,
      provider: useLLM,
      ...(limited
        ? { range: { start: parseTime(from), end: parseTime(until) } }
        : {}),
    });
    C(r.clips);
    K(r.clips.map((_: Clip, i: number) => i));
    D(r.mode);
  }
  return (
    <section className="panel history">
      <div className="bar">
        <h2>Transkrip dan highlight</h2>
        <small>WHISPER LOKAL</small>
      </div>
      <div className="body">
        <div className="actions">
          <label>
            Bahasa ujaran
            <select value={lang} onChange={(e) => L(e.target.value)}>
              <option value="id">Bahasa Indonesia</option>
              <option value="auto">Deteksi otomatis</option>
              <option value="en">Bahasa Inggris</option>
            </select>
          </label>
          <button
            disabled={busy || tr.status === "berjalan"}
            onClick={() =>
              act(async () => {
                await api(base + "transcript", "POST", { language: lang });
                await refresh();
                C([]);
                D("");
              })
            }
          >
            {tr.status === "berjalan"
              ? "Transkripsi " + tr.progress + "%"
              : tr.status === "baru"
                ? "Transkripsikan"
                : "Ulangi transkripsi"}
          </button>
        </div>
        {tr.status === "gagal" && <p className="error">{tr.error}</p>}
        {tr.status === "selesai" && (
          <>
            <details>
              <summary>Koreksi subtitle · {tr.segments?.length} segmen</summary>
              {tr.segments?.length === 0 && <p>Ujaran tidak terdeteksi.</p>}
              {tr.segments?.map((s, i) => (
                <form
                  key={i + s.text}
                  className="actions"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = new FormData(e.currentTarget).get("text");
                    void act(async () => {
                      await api(base + "transcript", "PUT", { index: i, text });
                      await refresh();
                      C([]);
                      D("");
                    });
                  }}
                >
                  <label>
                    {s.start.toFixed(2)} – {s.end.toFixed(2)} dtk
                    <textarea name="text" defaultValue={s.text} required />
                  </label>
                  <button className="soft" disabled={busy}>
                    Simpan
                  </button>
                </form>
              ))}
              <a href={"/api/" + base + "subtitles"}>Unduh SRT ↓</a>
            </details>
            <label>
              Cari bagian menarik dari
              <select
                disabled={busy}
                value={limited ? "range" : "all"}
                onChange={(e) => {
                  clearResults();
                  setLimited(e.target.value === "range");
                }}
              >
                <option value="all">Seluruh video</option>
                <option value="range">Rentang waktu pilihan</option>
              </select>
            </label>
            {limited && (
              <div className="pair">
                <label>
                  Dari (mm:ss)
                  <input
                    disabled={busy}
                    value={from}
                    onChange={(e) => {
                      clearResults();
                      setFrom(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Sampai (mm:ss)
                  <input
                    disabled={busy}
                    value={until}
                    onChange={(e) => {
                      clearResults();
                      setUntil(e.target.value);
                    }}
                  />
                </label>
              </div>
            )}
            <div className="actions">
              <label>
                Durasi
                <select value={min} onChange={(e) => M(+e.target.value)}>
                  {[
                    [15, 30],
                    [30, 60],
                    [60, 90],
                  ].map(([a, b]) => (
                    <option key={a} value={a}>
                      {a}–{b} detik
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jumlah klip
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={count}
                  onChange={(e) => N(+e.target.value)}
                />
              </label>
              {provider && (
                <label>
                  <input
                    type="checkbox"
                    checked={useLLM}
                    onChange={(e) => U(e.target.checked)}
                  />
                  Kirim teks ke provider LLM
                </label>
              )}
              <button
                className="soft"
                disabled={busy}
                onClick={() => act(suggest)}
              >
                Cari highlight
              </button>
            </div>
          </>
        )}
        {mode && (
          <p>
            {mode} · {clips.length} potongan sesuai durasi dan konteks.
          </p>
        )}
        {clips.map((c, i) => (
          <div className="candidate" key={i}>
            <label>
              <input
                type="checkbox"
                checked={checked.includes(i)}
                onChange={(e) =>
                  K(
                    e.target.checked
                      ? [...checked, i]
                      : checked.filter((x) => x !== i),
                  )
                }
              />
              <strong>{c.title}</strong>
            </label>
            <p>
              {timecode(c.start)} – {timecode(c.end)}
            </p>
            <p>Hook: “{c.hook}”</p>
            {c.punchline && <p>Penutup: “{c.punchline}”</p>}
            <p>
              Skor {c.score} · Retensi {c.retentionLevel || "Kuat"}
              {c.retentionScore !== undefined ? ` (${c.retentionScore})` : ""} ·
              Hook {c.hookScore ?? "-"} · Konteks {c.contextScore ?? "-"} · Emosi:{" "}
              {c.emotion || c.tone || "-"}
            </p>
            <p>
              {c.reason} {[c.topic, c.style].filter(Boolean).join(" · ")}
            </p>
            <div className="actions">
              {(["start", "end"] as const).map((field, k) => (
                <label key={field}>
                  {k ? "Selesai" : "Mulai"} (dtk)
                  <input
                    type="number"
                    step=".01"
                    value={c[field]}
                    onChange={(e) =>
                      C(
                        clips.map((x, n) =>
                          n === i ? { ...x, [field]: +e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <button className="soft" onClick={() => onUse(c.start, c.end)}>
                Buka di editor
              </button>
              {c.style && (
                <button
                  className="soft"
                  onClick={() => onUse(c.start, c.end, c.style)}
                >
                  Buka & pakai gaya
                </button>
              )}
            </div>
          </div>
        ))}
        {!!clips.length && (
          <button
            disabled={busy || !checked.length}
            onClick={() =>
              act(() => onBatch(clips.filter((_, i) => checked.includes(i))))
            }
          >
            Render pilihan ({checked.length})
          </button>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
