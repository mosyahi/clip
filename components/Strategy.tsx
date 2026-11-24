import { useState } from "react";
import { api } from "./Analysis";
import { parseTime } from "./timecode.mjs";

export function Strategy({ id, start, end, preset, choose }) {
  const [result, show] = useState<any>(null),
    [error, fail] = useState("");
  async function inspect() {
    try {
      fail("");
      show(
        await api("source/" + id + "/strategy", "POST", {
          start: parseTime(start),
          end: parseTime(end),
          preset,
        }),
      );
    } catch (e: any) {
      fail(e.message);
    }
  }
  return (
    <details>
      <summary>Strategi klip dan rekomendasi gaya</summary>
      <div className="fields">
        <button type="button" className="soft" onClick={inspect}>
          Analisis rentang ini
        </button>
        {error && <p role="alert">{error}</p>}
        {result &&
          (result.status === "unavailable" ? (
            <p>Transkripsikan ujaran pada rentang ini terlebih dahulu.</p>
          ) : (
            <>
              <p>
                {result.topic} · {result.tone} · Skor {result.score}/100 · Peluang visual{" "}
                {result.metrics.visual}/100
              </p>
              <p>{result.voiceStrategy}</p>
              {result.directorSummary && (
                <p>
                  <strong>AI Director:</strong> {result.directorSummary.editorialPhilosophy}
                </p>
              )}
              {result.suggestions.map((s: any) => (
                <p key={s.name}>
                  <button type="button" className="soft" onClick={() => choose(s.name)}>
                    {s.name}
                  </button>{" "}
                  {s.reason}
                </p>
              ))}
              <details>
                <summary>Rencana edit dan usulan visual ({result.scenes.length} scene)</summary>
                {result.scenes.map((s: any) => (
                  <p key={s.at}>
                    +{s.at.toFixed(1)} dtk · <strong>[{(s.visualType || "motion").toUpperCase()}]</strong>{" "}
                    {s.veracity === "klaim"
                      ? "(Klaim/Opini) "
                      : s.veracity === "fakta"
                        ? "(Data/Fakta) "
                        : ""}
                    {s.action} · {s.query}
                    {s.recommendedSource ? ` · Sumber: ${s.recommendedSource}` : ""}
                    {s.visualReason ? ` — ${s.visualReason}` : ""}
                  </p>
                ))}
                <a
                  download="strategi-klip.json"
                  href={
                    "data:application/json;charset=utf-8," +
                    encodeURIComponent(JSON.stringify(result, null, 2))
                  }
                >
                  Unduh analisis JSON
                </a>
              </details>
              {result.edl?.length > 0 && (
                <details>
                  <summary>
                    AI Video Director · Edit Decision List ({result.edl.length} beat)
                  </summary>
                  {result.edl.map((b: any) => (
                    <div className="version-card" key={b.index} style={{ marginTop: 6 }}>
                      <strong>
                        #{b.index} · +{b.at}s–{b.end}s · [{b.phase.toUpperCase()}] · {b.editingAction}
                        {b.restraint ? " (Tanpa Efek / Fokus Pembicara)" : ""}
                      </strong>
                      <p>{b.reason}</p>
                      <p>
                        Kata kunci: <strong>{b.emphasisKeywords.join(", ") || "-"}</strong> · Kamera:{" "}
                        {b.camera.motion} (zoom +{Math.round(b.camera.zoomDelta * 100)}%, transisi{" "}
                        {b.camera.transition}) · Audio: {b.audio.sfxCue}
                      </p>
                    </div>
                  ))}
                </details>
              )}
            </>
          ))}
      </div>
    </details>
  );
}
