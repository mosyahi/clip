import React from "react";
import {Callout} from "./Callout";
import {StyleLayer} from "./StyleLayer";
import {
  AbsoluteFill,
  Composition,
  OffthreadVideo,
  Audio,
  Img,
  Sequence,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

function Film({
  url,
  voice, voiceDuration=0, voiceOffset=0, voiceVolume=1, ducking=0.38,
  bgm, bgmVolume=0,
  groups = [],
  track = [],
  cards = [],
  shots = [],
  settings = {},
  aspect = 16 / 9,
}) {
  const frame = useCurrentFrame(),
    config = useVideoConfig(),
    t = frame / config.fps;
  const remaining = (config.durationInFrames - frame) / config.fps;
  const lastGroup = groups.at(-1);
  const group =
    groups.find((g) => g[0].start <= t && g[g.length - 1].end >= t) ||
    (remaining < 1 &&
    lastGroup &&
    t >= lastGroup.at(-1).end &&
    t - lastGroup.at(-1).end < 0.5
      ? lastGroup
      : null);
  const style=settings.style;
  const scene=settings.plan?.scenes.find(s=>t>=s.at && t<s.end);
  const pop = settings.preset === "Stack Pop" || (style && style.words<=3);
  const manual = settings.preset === "Manual";
  const grammar=style?.overlayVocabulary;
  const shotDuration=Math.min(2.8, grammar?style.pacingRules.hold:2.8);
  const shot = shots.find(
    (s) =>
      t >= s.at &&
      t < Math.min(s.at + shotDuration, config.durationInFrames / config.fps - 1.2),
  );
  const intensity = manual ? 0 : (settings.zoom ?? 0.5);
  const focus=style && settings.plan?.scenes.find(s=>["statistik","pertanyaan","perbandingan","klaim","fakta"].includes(s.action));
  const ease = Math.min(1,Math.max(0,(t-(focus?.at||0))/(style?.tempo==="cepat"?3:8)));
  const totalSec = Math.max(1, config.durationInFrames / config.fps);
  const clipProgress = Math.min(1, Math.max(0, t / totalSec));
  const scenePulse = scene ? Math.sin(Math.min(1, Math.max(0, (t - scene.at) / 0.45)) * Math.PI) : 0;
  const cam = style?.visualTreatment?.cameraMotion;
  let scale = 1 + intensity * 0.065 * ease * ease * (3 - 2 * ease);
  let panX = 0;
  if (!manual && cam) {
    if (cam === "still") scale = 1 + intensity * 0.025 * ease;
    else if (cam === "slow-drift") scale = 1 + intensity * 0.085 * clipProgress;
    else if (cam === "beat-punch") scale = 1 + intensity * (0.045 * ease + 0.055 * scenePulse);
    else if (cam === "dramatic-snap") scale = 1 + intensity * (0.08 * Math.min(1, t / 0.45) + 0.045 * scenePulse);
    else if (cam === "creep-zoom") scale = 1 + intensity * 0.115 * clipProgress;
    else if (cam === "step-push") {
      const steps = settings.plan?.scenes?.filter((s) => t >= s.at).length || 0;
      scale = 1 + intensity * Math.min(0.11, 0.03 * steps + 0.03 * ease);
    } else if (cam === "editorial-pan") {
      scale = 1 + intensity * 0.065;
      panX = Math.sin(clipProgress * Math.PI) * 14 * intensity;
    } else if (cam === "handheld-jitter") {
      scale = 1 + intensity * (0.05 + 0.04 * scenePulse + 0.012 * Math.sin(t * 7));
    }
  }
  const pos = Math.min(Math.floor(t * 2), track.length - 1),
    a = track[pos] || [0, 0.5, 0.36],
    b = track[pos + 1] || a;
  const isSpeakerCut = Math.abs((b[1] ?? 0.5) - (a[1] ?? 0.5)) >= 0.16;
  const follow = (i) =>
    isSpeakerCut
      ? a[i]
      : a[i] + (b[i] - a[i]) * Math.min(1, Math.max(0, (t - a[0]) * 2));
  const box = 9 / 16;
  const coord = (value, visible) =>
    visible >= 1
      ? 50
      : Math.min(
          100,
          Math.max(0, ((value - visible / 2) / (1 - visible)) * 100),
        );
  const at =
    coord(follow(1), box / aspect) +
    "% " +
    coord(follow(2), aspect / box) +
    "%";
  const collageAmp = settings.collageIntensity ?? 0.5;
  const transSpeed = settings.transitionSpeed ?? 1.0;
  const showCards =
    !grammar && pop && collageAmp > 0.05 && cards.length > 0 && remaining > 1.4 && t % 10 >= 2 && t % 10 < 2 + 2.5 * collageAmp;
  const mosaic = cards.length > 1 && Math.floor(t / 10) % 2 === 1;
  const opacity = Math.min(1, (frame + 1) / 5);
  return (
    <AbsoluteFill
      style={{
        background: "#090c0c",
        overflow: "hidden",
        fontFamily: settings.font || "Arial",
      }}
    >
      <AbsoluteFill style={{ opacity: manual ? 1 : opacity }}>
        {bgm && bgmVolume > 0 && <Audio src={bgm} volume={bgmVolume} />}
        {voice && (
          <Sequence from={Math.max(0, Math.round(voiceOffset * config.fps))}>
            <Audio src={voice} volume={voiceVolume} />
          </Sequence>
        )}
        <OffthreadVideo
          volume={voice ? (f) => {
            const sec = f / config.fps;
            if (sec < voiceOffset) return 1;
            if (sec < voiceOffset + 0.15) return 1 - (1 - ducking) * ((sec - voiceOffset) / 0.15);
            if (sec <= voiceOffset + voiceDuration) return ducking;
            return Math.min(1, ducking + (1 - ducking) * ((sec - (voiceOffset + voiceDuration)) * 4));
          } : 1}
          src={url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: at,
            transformOrigin: "50% 34%",
            filter:
              shot && !["fullscreen-broll", "fullscreen-circle"].includes(shot.displayMode)
                ? "blur(18px) brightness(0.68)"
                : !manual && style?.visualTreatment?.filter
                  ? style.visualTreatment.filter
                  : undefined,
            transform: `translateX(${panX}px) scale(${scale})`,
          }}
        />
        {!manual && style?.visualTreatment?.vignette && (
          <AbsoluteFill style={{ background: style.visualTreatment.vignette, pointerEvents: "none" }} />
        )}
        <AbsoluteFill
          style={{
            background: (!manual && style?.visualTreatment?.backdrop) || "linear-gradient(transparent 48%,rgba(0,0,0,.34))",
            pointerEvents: "none",
          }}
        />
        {shot && (
          <AbsoluteFill
            style={{
              pointerEvents: "none",
              opacity: grammar && style.transitionGrammar==="potong"?1:Math.min(
                1,
                (t - shot.at) * 6 * transSpeed,
                (shot.at + shotDuration - t) * 6 * transSpeed,
                (remaining - 1.2) * 6,
              ),
            }}
          >
            {["fullscreen-broll", "fullscreen-circle"].includes(shot.displayMode) ? (
              <AbsoluteFill style={{ background: "#090c0c", overflow: "hidden" }}>
                <Img
                  src={shot.url}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scale(" + (1 + 0.045 * (t - shot.at)) + ")",
                  }}
                />
                {shot.displayMode === "fullscreen-circle" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "38%",
                      left: "22%",
                      width: 340,
                      height: 340,
                      borderRadius: "50%",
                      border: "12px solid #dc2626",
                      boxShadow: "0 0 24px rgba(0,0,0,0.65)",
                      transform: `scale(${0.92 + 0.08 * Math.min(1, (t - shot.at) * 4)})`,
                    }}
                  />
                )}
              </AbsoluteFill>
            ) : shot.displayMode === "wiki-card" && shot.wikiExtract ? (
              <div
                style={{
                  position: "absolute",
                  top: "40%",
                  left: "7%",
                  right: "7%",
                  background: "#ffffff",
                  color: "#111111",
                  padding: "16px 22px",
                  borderRadius: 4,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.78)",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 23,
                  lineHeight: 1.38,
                  textAlign: "left",
                }}
              >
                <strong>{shot.wikiTitle || shot.topic}</strong>{" "}
                {shot.wikiExtract.replace(new RegExp("^" + (shot.wikiTitle || shot.topic), "i"), "").trim()}
                <sup style={{ color: "#0645ad", fontWeight: 700, marginLeft: 3 }}>[1]</sup>
              </div>
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: settings.position === "Atas" ? "36%" : "30%",
                  left: "8%",
                  width: "84%",
                  height: "28%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Img
                  src={shot.url}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: 4,
                    boxShadow: "0 18px 44px rgba(0,0,0,0.82)",
                    transform: "scale(" + (1 + 0.015 * (t - shot.at)) + ")",
                  }}
                />
              </div>
            )}
          </AbsoluteFill>
        )}
        {showCards && !shot && (
          <div
            style={{
              position: "absolute",
              top: "10%",
              left: "7%",
              display: mosaic ? "grid" : "flex",
              gridTemplateColumns: "290px 200px",
              gridAutoRows: "116px",
              gap: mosaic ? 8 : 0,
              opacity: Math.min(1, ((t % 10) - 2) * 5, (5 - (t % 10)) * 5),
              transformOrigin: "left top",
            }}
          >
            {cards.slice(0, 3).map((_, i) => (
              <Img
                key={i}
                src={cards[(i + Math.floor(t / 10)) % cards.length]}
                style={{
                  width: mosaic ? "100%" : 245,
                  height: mosaic ? "100%" : 205,
                  gridRow: mosaic && i === 0 ? "span 2" : undefined,
                  objectFit: "cover",
                  marginLeft: !mosaic && i ? -45 : 0,
                  border: mosaic ? "3px solid white" : "9px solid white",
                  borderBottomWidth: mosaic ? 3 : 24,
                  transform: mosaic
                    ? "none"
                    : "translateY(" +
                      i * 32 +
                      "px) rotate(" +
                      (-8 + i * 8) +
                      "deg)",
                  boxShadow: "0 12px 22px #0009",
                }}
              />
            ))}
          </div>
        )}
        {grammar && <StyleLayer style={style} scene={shot?null:scene} group={group} time={t} settings={settings}/>}
        {!grammar && scene && style && !shot && style.type!=="podcast" && <Callout scene={scene} style={style} time={t}/>} 
        {!grammar && !manual && settings.subtitles !== false && group && (
          <div
            style={{
              position: "absolute",
              left: "6%",
              right: "6%",
              top: settings.position === "Atas" ? "16%" : "54%",
              textAlign: "center",
              fontSize: 54,
              fontWeight: 900,
              lineHeight: 1.18,
              letterSpacing: -0.5,
              textTransform: "uppercase",
              color: "#ffffff",
              WebkitTextStroke: "10px #000000",
              paintOrder: "stroke fill",
              textShadow: "0 4px 14px rgba(0,0,0,0.92)",
            }}
          >
            {group.map((w, i) => {
              const active = t >= w.start && t < w.end;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    margin: "0 7px",
                    color: active && pop ? settings.color || "#ffffff" : "#ffffff",
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
        )}
        {settings.sourceLabel && (
          <div
            style={{
              position: "absolute",
              bottom:
                settings.watermark &&
                settings.watermarkCorner?.endsWith("bawah")
                  ? "12%"
                  : "9%",
              left: "7%",
              maxWidth: "78%",
              fontSize: 30,
              color: "white",
              background: "#101417cc",
              borderRadius: 8,
              padding: "6px 15px",
              overflowWrap: "anywhere",
            }}
          >
            Sumber · {settings.sourceLabel}
          </div>
        )}
        {settings.watermark && (
          <div
            style={{
              position: "absolute",
              [settings.watermarkCorner?.endsWith("bawah") ? "bottom" : "top"]:
                "6%",
              ...(settings.watermarkCorner?.startsWith("Tengah")
                ? { left: "50%", transform: "translateX(-50%)" }
                : {
                    [settings.watermarkCorner?.startsWith("Kiri")
                      ? "left"
                      : "right"]: "7%",
                  }),
              fontFamily: settings.watermarkFont || "Arial",
              ...(settings.watermarkStyle === "Label"
                ? {
                    background: "#101418df",
                    borderRadius: 24,
                    padding: "6px 20px",
                    border: "2px solid #ffffff80",
                  }
                : settings.watermarkStyle === "Editorial"
                  ? {
                      borderLeft: "5px solid " + settings.color,
                      paddingLeft: 14,
                      letterSpacing: 2,
                      fontStyle: "italic",
                    }
                  : {}),
              maxWidth: "80%",
              fontSize: 36,
              fontWeight: 700,
              color: "white",
              textShadow: "0 2px 6px #000",
              overflowWrap: "anywhere",
              opacity: settings.watermarkOpacity,
            }}
          >
            {settings.watermark}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
const Root = () => (
  <Composition
    id="Podcast"
    component={Film}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={{ frames: 30, url: "" }}
    calculateMetadata={({ props }) => ({ durationInFrames: props.frames })}
  />
);
registerRoot(Root);
