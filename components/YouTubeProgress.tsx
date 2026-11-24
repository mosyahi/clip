import { useState } from "react";

type Status = {
  stage: string;
  percent: number | null;
  bytes?: number;
  error?: string;
  id?: string;
};

export function useYouTubeImport() {
  const [status, setStatus] = useState<Status | null>(null);
  async function start(url: string, rights: boolean) {
    setStatus({ stage: "Memeriksa tautan", percent: 0 });
    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ url, rights }),
      });
      if (!response.ok)
        throw Error((await response.json()).error || "Impor gagal.");
      if (!response.body) throw Error("Koneksi progres terputus.");
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let pending = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) throw Error("Koneksi terputus. Periksa daftar video sumber.");
        const lines = (pending + value).split("\n");
        pending = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event: Status = JSON.parse(line);
          if (event.error) throw Error(event.error);
          setStatus(event);
          if (event.id) return event.id;
        }
      }
    } catch (e) {
      setStatus((previous) => ({
        stage: "Impor gagal",
        percent: previous?.percent ?? 0,
        error: e instanceof Error ? e.message : String(e),
      }));
      throw e;
    }
  }
  return { status, start };
}

export function YouTubeProgress({ status }: { status: Status | null }) {
  if (!status) return null;
  return (
    <div className="import-progress">
      <div>
        <span role="status">{status.stage}</span>
        <strong>
          {status.percent === null
            ? ((status.bytes || 0) / 1048576).toFixed(1) + " MB"
            : status.percent + "%"}
        </strong>
      </div>
      <progress
        aria-label="Progres impor YouTube"
        max={100}
        value={status.percent ?? undefined}
      />
      {status.error && (
        <p role="alert" className="error">
          {status.error}
        </p>
      )}
    </div>
  );
}
