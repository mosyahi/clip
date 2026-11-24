import { parseTime, timecode } from "../components/timecode.mjs";
import { Analysis, api } from "../components/Analysis";
import { Look, defaults } from "../components/Look";
import {
  useYouTubeImport,
  YouTubeProgress,
} from "../components/YouTubeProgress";
import Head from "next/head";
import { Strategy } from "../components/Strategy";
import { References } from "../components/References";
import { AutoClipper } from "../components/AutoClipper";
import { Guide } from "../components/Guide";
import { HistoryManager, StorageSummary } from "../components/HistoryManager";
import { SimpleMode } from "../components/SimpleMode";
import { styles } from "../server/style-registry.mjs";
import { useEffect, useState, useRef } from "react";

export type Source = {
  id: string;
  name: string;
  meta: {
    duration: number;
    width: number;
    height: number;
    audio: boolean;
    size: number;
    codec: string;
  };
};
type Job = {
  id: string;
  source: string;
  status: string;
  progress: number;
  illustrationCount?: number;
  error: string;
  settings: {
    start: number;
    end: number;
    preview: boolean;
    title?: string;
    autoIllustrate?: boolean;
    preset?: string;
  };
};
const time = (n: number) =>
  Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");

export default function Studio() {
  const youtube = useYouTubeImport();
  const [sources, S] = useState<Source[]>([]),
    [jobs, J] = useState<Job[]>([]),
    [selected, select] = useState(""),
    [active, A] = useState(""),
    [start, B] = useState("0:00"),
    [end, E] = useState("0:00"),
    [pending, P] = useState(""),
    [error, F] = useState(""),
    [viewMode, setViewMode] = useState<"all" | "simple" | "auto" | "manual" | "transcript" | "guide">("all");
  const [look, V] = useState(defaults),
    [yt, Y] = useState(""),
    [rights, R] = useState(false),
    [provider, Q] = useState(false),
    [storage, setStorage] = useState<StorageSummary | null>(null);
  const picker = useRef<HTMLInputElement>(null),
    player = useRef<HTMLVideoElement>(null);
  const src = sources.find((s) => s.id === selected),
    output = jobs.find((j) => j.id === active && j.status === "selesai");

  async function refresh() {
    const data = await api("state");
    S(data.sources);
    J(data.jobs);
    if (data.storage) setStorage(data.storage);
    return data;
  }
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const d = await api("state");
        if (mounted) {
          S(d.sources);
          J(d.jobs);
          Q(d.provider);
          if (d.storage) setStorage(d.storage);
          select((old) => old || d.sources[0]?.id || "");
        }
      } catch (e: any) {
        if (mounted) F(e.message);
      }
    }
    void poll();
    const timer = setInterval(poll, 1700);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    B("0:00");
    E(timecode(Math.min(30, src?.meta.duration || 0)));
    V(defaults);
  }, [selected, src?.meta.duration]);
  async function work(label: string, fn: () => Promise<void>) {
    P(label);
    F("");
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      F(e.message);
    } finally {
      P("");
    }
  }
  function upload(file?: File) {
    if (!file) return;
    void work("Mengimpor video…", async () => {
      const data = new FormData();
      data.append("video", file);
      const r = await api("source", "POST", data);
      A("");
      select(r.id);
    });
  }
  async function render(preview: boolean, variants = false) {
    await work("Mengantrekan…", async () => {
      const r = await api("render", "POST", {
        source: selected,
        start: parseTime(start),
        end: parseTime(end),
        preview,
        variants,
        ...look,
      });
      A(r.id);
    });
  }
  return (
    <>
      <Head>
        <title>AI Clipper Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header>
        <div className="brand">
          <i>◩</i> AI Clipper Studio
        </div>
        <span className="local">
          <b /> Studio lokal
        </span>
      </header>
      <main>
        <div className="intro">
          <div>
            <h1>Studio klip</h1>
            <p>Pilih video sumber, lalu gunakan Super Auto Clipper otomatis atau potong manual di kanan.</p>
          </div>
          <button onClick={() => picker.current?.click()} disabled={!!pending}>
            ＋ Impor video
          </button>
        </div>

        <div className="mode-bar" role="navigation" aria-label="Filter tampilan kerja">
          {(
            [
              ["all", "🎛️ Advanced Mode (Semua Panel)"],
              ["simple", "✨ Simple Mode (1-Klik Cepat)"],
              ["auto", "⚡ Fokus Super Auto Clipper"],
              ["manual", "✂️ Fokus Edit & Voice Manual"],
              ["transcript", "📝 Fokus Transkrip & Highlight"],
              ["guide", "📖 Panduan Pemakaian"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={viewMode === key ? "" : "soft"}
              onClick={() => setViewMode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <Guide key={viewMode === "guide" ? "guide-open" : "guide-closed"} defaultOpen={viewMode === "guide"} />

        {viewMode === "simple" && (
          <SimpleMode
            sources={sources}
            selected={selected}
            onSelectSource={(id) => {
              A("");
              select(id);
            }}
            jobs={jobs}
            onUploadFile={upload}
            onRefresh={refresh}
            onControlJob={(jobId, action) =>
              work("Memperbarui antrean…", () =>
                api("job/" + jobId + "/control", "POST", { action }),
              )
            }
            onRetryJob={(jobId) =>
              work("Mengulangi…", () => api("job/" + jobId + "/retry", "POST"))
            }
          />
        )}

        <input
          hidden
          ref={picker}
          type="file"
          accept=".mp4,.mov"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {pending && <p role="status">{pending}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {viewMode !== "simple" && (
        <div className="gridstudio">
          <section className="panel">
            <div className="bar">
              <h2>Monitor video</h2>
              <small>{output ? "HASIL RENDER" : "SUMBER"}</small>
            </div>
            <div
              className="monitor"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                upload(e.dataTransfer.files[0]);
              }}
            >
              {src ? (
                <video
                  ref={player}
                  controls
                  playsInline
                  src={
                    output
                      ? "/api/job/" + output.id + "/video"
                      : "/api/source/" + src.id + "/video"
                  }
                />
              ) : (
                <div className="drop">
                  <i>↥</i>
                  <h3>Masukkan video podcast</h3>
                  <p>Seret MP4 atau MOV ke sini, hingga 4 GB.</p>
                  <button
                    className="soft"
                    onClick={() => picker.current?.click()}
                  >
                    Pilih file
                  </button>
                </div>
              )}
            </div>
            {src && (
              <div className="details">
                <strong>{src.name}</strong>
                <p>
                  {src.meta.width} × {src.meta.height} ·{" "}
                  {time(src.meta.duration)} · {src.meta.codec.toUpperCase()} ·{" "}
                  {(src.meta.size / 1048576).toFixed(1)} MB
                </p>
                {output && (
                  <button className="soft" onClick={() => A("")}>
                    Kembali ke sumber
                  </button>
                )}
              </div>
            )}
          </section>
          <aside className="panel">
            <div className="bar">
              <h2>Pengaturan klip</h2>
              <small>9:16 · 1080×1920</small>
            </div>
            <div className="body">
              <label>
                Video sumber
                <select
                  value={selected}
                  onChange={(e) => {
                    A("");
                    select(e.target.value);
                  }}
                >
                  <option value="" disabled>
                    Pilih video
                  </option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pair">
                {[
                  ["Mulai", start, B],
                  ["Selesai", end, E],
                ].map(([name, v, set]: any) => (
                  <label key={name}>
                    {name} (mm:ss atau detik)
                    <input
                      type="text"
                      value={v}
                      onChange={(e) => set(e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <Look
                key={selected}
                id={selected}
                value={look}
                set={V}
                quickActions={
                  <div className="quick-render">
                    <div className="pair">
                      <button
                        disabled={!src || !!pending}
                        onClick={() => render(false)}
                      >
                        Render MP4
                      </button>
                      <button
                        className="soft"
                        disabled={!src || !!pending}
                        onClick={() => render(true)}
                      >
                        Render preview 360p
                      </button>
                    </div>
                    {src && (
                      <button
                        type="button"
                        className="soft"
                        disabled={!!pending}
                        onClick={() => render(true, true)}
                      >
                        Buat 3 versi preview
                      </button>
                    )}
                  </div>
                }
              />
              {src && look.autoIllustrate && (
                <References
                  key={["assets", selected, start, end].join("/")}
                  id={selected}
                  start={start}
                  end={end}
                  pages={look.approvedPages}
                  choose={(approvedPages) => V({ ...look, approvedPages })}
                />
              )}
              <Strategy
                key={[selected, start, end, look.preset].join("/")}
                id={selected}
                start={start}
                end={end}
                preset={look.preset}
                choose={(preset) => V({ ...look, preset })}
              />
            </div>
          </aside>
        </div>
        )}

        {viewMode !== "simple" && (
        <details className="panel history import">
          <summary>Impor dari YouTube</summary>
          <div className="body">
            <label>
              Tautan video
              <input
                type="url"
                value={yt}
                placeholder="https://www.youtube.com/watch?v=…"
                onChange={(e) => Y(e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={rights}
                onChange={(e) => R(e.target.checked)}
              />
              Saya memiliki izin untuk mengunduh dan menggunakan video ini.
            </label>
            <button
              disabled={!yt || !rights || !!pending}
              onClick={() =>
                work("Mengunduh video YouTube…", async () => {
                  const id = await youtube.start(yt, rights);
                  A("");
                  select(id);
                  Y("");
                  R(false);
                })
              }
            >
              Impor dari tautan
            </button>
            <YouTubeProgress status={youtube.status} />
          </div>
        </details>
        )}

        {src && (viewMode === "all" || viewMode === "auto") && (
          <AutoClipper
            key={"auto-" + src.id}
            id={src.id}
            provider={provider}
            sharedLook={{
              sourceLabel: look.sourceLabel,
              watermark: look.watermark,
              watermarkCorner: look.watermarkCorner,
              watermarkFont: look.watermarkFont,
              watermarkStyle: look.watermarkStyle,
              watermarkOpacity: look.watermarkOpacity,
              assets: look.assets,
              clone: look.clone,
            }}
            onQueued={async (jobId) => {
              A(jobId);
              await refresh();
            }}
          />
        )}

        {src && (viewMode === "all" || viewMode === "transcript") && (
          <Analysis
            key={src.id}
            id={src.id}
            duration={src.meta.duration}
            provider={provider}
            onUse={(a, b, styleName) => {
              A("");
              B(timecode(a));
              E(timecode(b));
              if (styleName) {
                const matched = styles.find((s) => s.name === styleName);
                V((prev) =>
                  matched && !prev.customStyle
                    ? {
                        ...prev,
                        preset: styleName,
                        font: matched.font,
                        color: matched.color,
                        zoom: matched.zoom,
                      }
                    : { ...prev, preset: styleName },
                );
              }
              if (player.current) player.current.currentTime = a;
              window.scrollTo(0, 0);
            }}
            onBatch={async (clips) => {
              await api("render", "POST", { source: selected, clips, ...look });
              await refresh();
            }}
          />
        )}

        <HistoryManager
          jobs={jobs}
          sources={sources}
          selectedSource={selected}
          storage={storage}
          pending={pending}
          onPlay={(j) => {
            if (selected !== j.source) {
              select(j.source);
              A(j.id);
            } else A(j.id);
            window.scrollTo(0, 0);
          }}
          onControl={(jobId, action) =>
            work("Memperbarui antrean…", () =>
              api("job/" + jobId + "/control", "POST", { action }),
            )
          }
          onRetry={(jobId) =>
            work("Mengulangi…", () => api("job/" + jobId + "/retry", "POST"))
          }
          onRefresh={refresh}
        />
      </main>
    </>
  );
}
