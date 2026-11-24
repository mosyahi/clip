import { useEffect, useState } from "react";
import { api } from "./Analysis";
import { styles, controlPresets } from "../server/style-registry.mjs";
import { StyleLibrary } from "./StyleLibrary";
import { VoiceSample } from "./VoiceSample";

const voicePresetDefaults: Record<string, { rate: number; ducking: number; label: string }> = {
  Natural: { rate: 0, ducking: 0.38, label: "Natural · Bahasa Indonesia (Ardi)" },
  Tenang: { rate: -2, ducking: 0.42, label: "Tenang · Kalem & Jelas" },
  Energik: { rate: 2, ducking: 0.32, label: "Energik · Cepat & Antusias" },
  Dokumenter: { rate: -2, ducking: 0.3, label: "Narator Dokumenter Wibawa" },
  Berita: { rate: 1, ducking: 0.34, label: "Pembawa Berita Tegas" },
  Storyteller: { rate: -1, ducking: 0.36, label: "Storyteller Hangat (Gadis)" },
};

export const defaults = {
  preset: "Cinematic",
  narration: "",
  clone: false,
  voiceStyle: "Natural",
  voiceRate: 0,
  voiceVolume: 1,
  ducking: 0.38,
  voiceSync: "intro",
  voiceStart: 0,
  approvedPages: null as string[] | null,
  customStyle: false,
  sourceLabel: "",
  watermark: "",
  watermarkCorner: "Kanan",
  watermarkFont: "Arial",
  watermarkStyle: "Klasik",
  watermarkOpacity: 0.7,
  autoIllustrate: true,
  cameraFocus: "auto",
  color: "#caf784",
  font: "Arial",
  position: "Bawah",
  zoom: 0.5,
  subtitles: true,
  assets: [] as string[],
  controlPreset: "Balanced",
  substyle: "Default",
  animationIntensity: 0.55,
  visualDensity: 0.5,
  subtitleAnimation: "Auto",
  subtitleSize: 70,
  transitionSpeed: 1.0,
  brollFrequency: 0.5,
  collageIntensity: 0.4,
  motionDensity: 0.5,
  bgmVolume: 0.06,
  sfxIntensity: 0.25,
  targetDuration: 30,
  exportQuality: "full-1080p",
  safeArea: "universal",
};

export function Look({
  id,
  value,
  set,
  quickActions,
}: {
  id: string;
  value: typeof defaults;
  set: (v: typeof defaults) => void;
  quickActions?: React.ReactNode;
}) {
  const [assets, A] = useState<{ id: string; name: string }[]>([]),
    [error, F] = useState(""),
    [voicePreviewUrl, setVoicePreviewUrl] = useState(""),
    [voiceBusy, setVoiceBusy] = useState(false);
  const url = "source/" + id + "/assets";

  useEffect(() => {
    return () => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    };
  }, [voicePreviewUrl]);

  async function previewVoice() {
    if (!value.narration.trim()) return F("Isi teks narasi terlebih dahulu untuk pratinjau suara.");
    setVoiceBusy(true);
    F("");
    try {
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value.narration,
          voiceStyle: value.voiceStyle,
          voiceRate: value.voiceRate,
          source: id,
          clone: value.clone,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw Error(d.error || "Pratinjau suara gagal.");
      }
      const blob = await res.blob();
      setVoicePreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e: any) {
      F(e.message);
    } finally {
      setVoiceBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    if (id)
      api(url)
        .then((v) => alive && A(v))
        .catch((e) => alive && F(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const applyPreset = (preset: string) => {
    const matched = styles.find((s) => s.name === preset);
    if (matched && !value.customStyle) {
      set({ ...value, preset, font: matched.font, color: matched.color, zoom: matched.zoom });
    } else {
      set({ ...value, preset });
    }
  };

  return (
    <>
      <label>
        Gaya editing
        <select value={value.preset} onChange={(e) => applyPreset(e.target.value)}>
          {["Manual", "Cinematic", "Stack Pop", "Otomatis", ...styles.map((s) => s.name)].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>

      <label>
        Fokus kamera 9:16 (Landscape → Vertikal)
        <select
          value={value.cameraFocus || "auto"}
          onChange={(e) => set({ ...value, cameraFocus: e.target.value })}
        >
          <option value="auto">🎯 Otomatis Ikuti Orang yang Bicara</option>
          <option value="right">👉 Kunci Pembicara Sisi Kanan</option>
          <option value="left">👈 Kunci Pembicara Sisi Kiri</option>
          <option value="center">⏹️ Fokus Tengah Frame</option>
        </select>
      </label>

      {quickActions}

      <div className="divider-label">PENGATURAN TAMBAHAN (KLIK UNTUK MEMBUKA)</div>

      <StyleLibrary preset={value.preset} apply={applyPreset} />

      {value.preset !== "Manual" && (
        <details>
          <summary>
            Voice Studio · Suara Bahasa Indonesia & Kemiripan WAV{value.clone ? " (Sampel Aktif)" : ""}
          </summary>
          <div className="fields">
            <label>
              Teks narasi voice-over (Bahasa Indonesia)
              <textarea
                maxLength={500}
                placeholder="Contoh: Halo teman-teman, simak pembahasan penting dalam cuplikan podcast berikut ini."
                value={value.narration}
                onChange={(e) => set({ ...value, narration: e.target.value })}
              />
            </label>
            <div className="pair">
              <label>
                Preset narator Indonesia
                <select
                  value={value.voiceStyle}
                  onChange={(e) => {
                    const presetName = e.target.value;
                    const vp = voicePresetDefaults[presetName] || voicePresetDefaults.Natural;
                    set({ ...value, voiceStyle: presetName, voiceRate: vp.rate, ducking: vp.ducking });
                  }}
                >
                  {Object.entries(voicePresetDefaults).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Waktu muncul suara
                <select value={value.voiceSync} onChange={(e) => set({ ...value, voiceSync: e.target.value })}>
                  <option value="intro">Di awal video (0 dtk)</option>
                  <option value="hook">Saat kalimat pertama mulai</option>
                  <option value="scene">Saat scene visual pertama</option>
                  <option value="custom">Detik khusus</option>
                </select>
              </label>
            </div>
            {value.voiceSync === "custom" && (
              <label>
                Mulai voice-over (detik)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={value.voiceStart}
                  onChange={(e) => set({ ...value, voiceStart: Math.max(0, +e.target.value || 0) })}
                />
              </label>
            )}
            <label>
              Kecepatan bicara · {value.voiceRate > 0 ? "+" + value.voiceRate : value.voiceRate}
              <input
                type="range"
                min="-5"
                max="5"
                step="1"
                value={value.voiceRate}
                onChange={(e) => set({ ...value, voiceRate: +e.target.value })}
              />
            </label>
            <div className="pair">
              <label>
                Volume narasi · {Math.round(value.voiceVolume * 100)}%
                <input
                  type="range"
                  min="0.4"
                  max="1.5"
                  step="0.05"
                  value={value.voiceVolume}
                  onChange={(e) => set({ ...value, voiceVolume: +e.target.value })}
                />
              </label>
              <label>
                Suara video asli saat narasi · {Math.round(value.ducking * 100)}%
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={value.ducking}
                  onChange={(e) => set({ ...value, ducking: +e.target.value })}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={voiceBusy || !value.narration.trim()}
              onClick={previewVoice}
            >
              {voiceBusy
                ? "Menyiapkan suara Bahasa Indonesia…"
                : value.clone
                  ? "🔊 Dengarkan preview suara (Kemiripan WAV Aktif)"
                  : "🔊 Dengarkan preview suara Bahasa Indonesia"}
            </button>
            {voicePreviewUrl && <audio controls src={voicePreviewUrl} style={{ width: "100%" }} />}
            {id && <VoiceSample id={id} enabled={value.clone} select={(clone) => set({ ...value, clone })} />}
          </div>
        </details>
      )}

      {value.preset !== "Manual" && (
        <details>
          <summary>Tampilan dan gerak</summary>
          <div className="fields">
            <label className="check">
              <input
                type="checkbox"
                checked={value.autoIllustrate}
                onChange={(e) => set({ ...value, autoIllustrate: e.target.checked })}
              />
              Cari ilustrasi dokumenter dari topik transkrip
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.subtitles}
                onChange={(e) => set({ ...value, subtitles: e.target.checked })}
              />
              Subtitle dari transkrip
            </label>
            {(value.preset.startsWith("Clipper") || value.preset === "Otomatis") && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={value.customStyle}
                  onChange={(e) => set({ ...value, customStyle: e.target.checked })}
                />
                Gunakan font, aksen, dan intensitas zoom pilihan sendiri
              </label>
            )}
            <div className="pair">
              <label>
                Preset intensitas & kepadatan
                <select
                  value={value.controlPreset}
                  onChange={(e) => {
                    const pName = e.target.value;
                    const cp = (controlPresets as any)[pName];
                    if (cp) set({ ...value, ...cp, customStyle: true });
                  }}
                >
                  {Object.keys(controlPresets).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Substyle visual
                <select
                  value={value.substyle}
                  onChange={(e) => set({ ...value, substyle: e.target.value })}
                >
                  {["Default", "Minimal", "Bold", "Editorial", "Neon"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="pair">
              <label>
                Font
                <select value={value.font} onChange={(e) => set({ ...value, font: e.target.value, customStyle: true })}>
                  {["Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Aksen
                <input
                  type="color"
                  value={value.color}
                  onChange={(e) => set({ ...value, color: e.target.value, customStyle: true })}
                />
              </label>
            </div>
            <div className="pair">
              <label>
                Posisi subtitle
                <select value={value.position} onChange={(e) => set({ ...value, position: e.target.value })}>
                  <option>Bawah</option>
                  <option>Tengah</option>
                  <option>Atas</option>
                </select>
              </label>
              <label>
                Gaya animasi subtitle
                <select
                  value={value.subtitleAnimation}
                  onChange={(e) => set({ ...value, subtitleAnimation: e.target.value })}
                >
                  <option value="Auto">Otomatis sesuai style</option>
                  {["blok", "karaoke", "tinta", "angka", "muncul", "frasa", "baris"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="pair">
              <label>
                Ukuran font subtitle · {value.subtitleSize}px
                <input
                  type="range"
                  min="44"
                  max="92"
                  step="2"
                  value={value.subtitleSize}
                  onChange={(e) => set({ ...value, subtitleSize: +e.target.value })}
                />
              </label>
              <label>
                Safe area platform
                <select value={value.safeArea} onChange={(e) => set({ ...value, safeArea: e.target.value })}>
                  <option value="universal">Universal 9:16</option>
                  <option value="tiktok">TikTok (Hindari tombol kanan)</option>
                  <option value="reels">Instagram Reels</option>
                  <option value="shorts">YouTube Shorts</option>
                </select>
              </label>
            </div>
            <div className="pair">
              <label>
                Intensitas zoom dan animasi · {Math.round(value.zoom * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={value.zoom}
                  onChange={(e) => set({ ...value, zoom: +e.target.value, customStyle: true })}
                />
              </label>
              <label>
                Intensitas gerak overlay · {Math.round(value.animationIntensity * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={value.animationIntensity}
                  onChange={(e) => set({ ...value, animationIntensity: +e.target.value })}
                />
              </label>
            </div>
            <div className="pair">
              <label>
                Kepadatan scene visual · {Math.round(value.visualDensity * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={value.visualDensity}
                  onChange={(e) => set({ ...value, visualDensity: +e.target.value })}
                />
              </label>
              <label>
                Kecepatan transisi · {value.transitionSpeed.toFixed(2)}×
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={value.transitionSpeed}
                  onChange={(e) => set({ ...value, transitionSpeed: +e.target.value })}
                />
              </label>
            </div>
            <div className="pair">
              <label>
                Frekuensi B-roll · {Math.round(value.brollFrequency * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={value.brollFrequency}
                  onChange={(e) => set({ ...value, brollFrequency: +e.target.value })}
                />
              </label>
              <label>
                Kepadatan motion graphics · {Math.round(value.motionDensity * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={value.motionDensity}
                  onChange={(e) => set({ ...value, motionDensity: +e.target.value })}
                />
              </label>
            </div>
            <div className="pair">
              <label>
                Intensitas kolase foto · {Math.round(value.collageIntensity * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={value.collageIntensity}
                  onChange={(e) => set({ ...value, collageIntensity: +e.target.value })}
                />
              </label>
              <label>
                Kualitas ekspor
                <select
                  value={value.exportQuality}
                  onChange={(e) => set({ ...value, exportQuality: e.target.value })}
                >
                  <option value="full-1080p">Full HD 1080×1920</option>
                  <option value="hd-720p">HD Cepat 720×1280</option>
                  <option value="preview-360p">Preview Cepat 360×640</option>
                </select>
              </label>
            </div>
            <div className="pair">
              <label>
                Volume musik latar (BGM) · {Math.round(value.bgmVolume * 100)}%
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.02"
                  value={value.bgmVolume}
                  onChange={(e) => set({ ...value, bgmVolume: +e.target.value })}
                />
              </label>
              <label>
                Intensitas sound effect (SFX) · {Math.round(value.sfxIntensity * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={value.sfxIntensity}
                  onChange={(e) => set({ ...value, sfxIntensity: +e.target.value })}
                />
              </label>
            </div>
            <div
              className="live-preview-box"
              aria-label="Pratinjau instan tata letak & safe area"
              style={{
                position: "relative",
                aspectRatio: "9 / 16",
                width: "min(100%, 195px)",
                margin: "4px auto",
                borderRadius: 10,
                background: "radial-gradient(circle at 50% 40%, #243331, #0c1112)",
                border: "2px solid " + value.color,
                overflow: "hidden",
                fontFamily: value.font,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset:
                    value.safeArea === "tiktok"
                      ? "8% 13% 19% 7%"
                      : value.safeArea === "reels"
                        ? "8% 11% 18% 7%"
                        : "6% 7% 15% 7%",
                  border: "1px dashed rgba(255,255,255,0.28)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "6%",
                  left: "7%",
                  fontSize: 9,
                  color: value.color,
                  fontWeight: 700,
                }}
              >
                {value.controlPreset.toUpperCase()} · {value.safeArea.toUpperCase()}
              </div>
              {value.subtitles && (
                <div
                  style={{
                    position: "absolute",
                    left: "8%",
                    right: value.safeArea === "tiktok" ? "14%" : "8%",
                    top: value.position === "Atas" ? "16%" : undefined,
                    bottom: value.position === "Tengah" ? "43%" : value.position === "Bawah" ? "19%" : undefined,
                    textAlign: "center",
                    fontSize: Math.round(value.subtitleSize * 0.17),
                    fontWeight: 800,
                    color: "white",
                    background: "rgba(0,0,0,0.55)",
                    padding: "4px 6px",
                    borderRadius: 6,
                    borderBottom: "2px solid " + value.color,
                  }}
                >
                  Contoh <span style={{ color: value.color }}>Subtitle</span> Aktif
                </div>
              )}
            </div>
            {(value.preset === "Stack Pop" ||
              value.preset.startsWith("Clipper") ||
              value.preset === "Otomatis") &&
              id && (
                <>
                  <label>
                    Foto b-roll berizin
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const form = new FormData();
                          form.append("image", f);
                          const r = await api(url, "POST", form);
                          A(await api(url));
                          if (value.assets.length < 3) set({ ...value, assets: [...value.assets, r.id] });
                          F("");
                        } catch (err: any) {
                          F(err.message);
                        }
                      }}
                    />
                  </label>
                  <label>
                    Tambahkan foto dari folder lokal
                    <input
                      type="file"
                      multiple
                      {...{ webkitdirectory: "" }}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []).filter((f) =>
                          /\.(jpe?g|png)$/i.test(f.name),
                        );
                        try {
                          for (const image of files.slice(0, 30)) {
                            const form = new FormData();
                            form.append("image", image);
                            await api(url, "POST", form);
                          }
                          F(files.length > 30 ? "30 foto pertama ditambahkan." : "");
                        } catch (err: any) {
                          F(err.message);
                        } finally {
                          A(await api(url));
                        }
                      }}
                    />
                  </label>
                  <p>Foto pilihan diprioritaskan sebagai ilustrasi. Stack Pop menampilkannya sebagai kartu.</p>
                  {assets.map((a) => (
                    <label className="check" key={a.id}>
                      <input
                        type="checkbox"
                        checked={value.assets.includes(a.id)}
                        disabled={!value.assets.includes(a.id) && value.assets.length >= 3}
                        onChange={(e) =>
                          set({
                            ...value,
                            assets: e.target.checked
                              ? [...value.assets, a.id]
                              : value.assets.filter((x) => x !== a.id),
                          })
                        }
                      />
                      {a.name}
                    </label>
                  ))}
                </>
              )}
          </div>
        </details>
      )}

      <details>
        <summary>Kredit sumber dan watermark</summary>
        <div className="fields">
          <label>
            Sumber video
            <input
              maxLength={90}
              placeholder="Nama kanal atau podcast"
              value={value.sourceLabel}
              onChange={(e) => set({ ...value, sourceLabel: e.target.value })}
            />
          </label>
          <label>
            Watermark teks
            <input
              maxLength={48}
              placeholder="@namakanal"
              value={value.watermark}
              onChange={(e) => set({ ...value, watermark: e.target.value })}
            />
          </label>
          <label>
            Posisi watermark
            <select
              value={value.watermarkCorner}
              onChange={(e) => set({ ...value, watermarkCorner: e.target.value })}
            >
              <option value="Kanan">Kanan atas</option>
              <option value="Kiri">Kiri atas</option>
              {["Tengah atas", "Kiri bawah", "Tengah bawah", "Kanan bawah"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="pair">
            <label>
              Font watermark
              <select
                value={value.watermarkFont}
                onChange={(e) => set({ ...value, watermarkFont: e.target.value })}
              >
                {["Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Gaya watermark
              <select
                value={value.watermarkStyle}
                onChange={(e) => set({ ...value, watermarkStyle: e.target.value })}
              >
                {["Klasik", "Label", "Editorial"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Opasitas watermark · {Math.round(value.watermarkOpacity * 100)}%
            <input
              type="range"
              min=".2"
              max="1"
              step=".05"
              value={value.watermarkOpacity}
              onChange={(e) => set({ ...value, watermarkOpacity: +e.target.value })}
            />
          </label>
        </div>
      </details>

      {error && <p className="error">{error}</p>}
    </>
  );
}
