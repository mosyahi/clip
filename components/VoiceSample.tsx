import { useEffect, useState } from "react";
import { api } from "./Analysis";

export function VoiceSample({
  id,
  enabled,
  select,
}: {
  id: string;
  enabled: boolean;
  select: (v: boolean) => void;
}) {
  const [consent, agree] = useState(false);
  const [nonImpersonation, setNonImpersonation] = useState(false);
  const [ownerName, setOwnerName] = useState("Pemilik Suara");
  const [relationship, setRelationship] = useState("self");
  const [busy, setBusy] = useState(false);
  const [status, set] = useState<{
    sample: boolean;
    clone: boolean;
    cloneMode?: string;
    downloadsTestWav?: boolean;
    consentMeta?: {
      ownerName?: string;
      relationship?: string;
      sourceFile?: string;
      consentedAt?: string;
      voiceProfile?: { f0Hz?: number; character?: string; durationSec?: number } | null;
    } | null;
  }>({ sample: false, clone: true, consentMeta: null });
  const [error, fail] = useState("");
  const url = "source/" + id + "/voice";

  useEffect(() => {
    if (id)
      api(url)
        .then((s) => {
          set(s);
          if (s.sample) {
            agree(true);
            setNonImpersonation(true);
          }
        })
        .catch((e) => fail(e.message));
  }, [id]);

  const readyToUpload = consent && nonImpersonation && ownerName.trim().length >= 2;

  async function importDownloadsTestWav() {
    if (!readyToUpload) {
      fail("Centang kedua kotak pernyataan izin dan isi nama pemilik suara terlebih dahulu.");
      return;
    }
    setBusy(true);
    fail("");
    try {
      await api(url + "/from-downloads", "POST", {
        consent: "yes",
        nonImpersonation: "yes",
        ownerName: ownerName.trim(),
        relationship,
      });
      const updated = await api(url);
      set(updated);
      select(true);
    } catch (e: any) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSample() {
    try {
      const res = await fetch("/api/" + url, { method: "DELETE" });
      if (!res.ok) throw Error("Gagal menghapus sampel suara.");
      select(false);
      set(await api(url));
      fail("");
    } catch (e: any) {
      fail(e.message);
    }
  }

  const prof = status.consentMeta?.voiceProfile;

  return (
    <div className="voice-box fields">
      <strong>Kemiripan Suara dari Sampel WAV ({status.cloneMode || "Lokal"})</strong>
      <p>
        Menyesuaikan nada dasar (pitch F0) dan warna suara (timbre/EQ) TTS Bahasa Indonesia agar mendekati karakter
        rekaman WAV referensi Anda.
      </p>

      <div className="pair">
        <label>
          1. Nama pemilik suara
          <input
            maxLength={80}
            placeholder="Nama pemilik suara"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </label>
        <label>
          Dasar izin
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            <option value="self">Suara saya sendiri</option>
            <option value="authorized">Pemilik suara memberi izin eksplisit tertulis</option>
          </select>
        </label>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            agree(e.target.checked);
            if (!e.target.checked) select(false);
          }}
        />
        Saya memiliki izin eksplisit pemilik suara untuk memakai sampel WAV ini.
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={nonImpersonation}
          onChange={(e) => {
            setNonImpersonation(e.target.checked);
            if (!e.target.checked) select(false);
          }}
        />
        Saya menyatakan tidak meniru suara orang lain tanpa izin.
      </label>

      {status.downloadsTestWav && (
        <button
          type="button"
          disabled={!readyToUpload || busy}
          onClick={importDownloadsTestWav}
        >
          {busy ? "Memproses Downloads/test.wav…" : "⚡ 2. Pakai Langsung Downloads/test.wav"}
        </button>
      )}

      <label>
        {status.downloadsTestWav ? "Atau pilih file WAV lain (maks. 8 MB)" : "2. Pilih file sampel WAV (maks. 8 MB)"}
        <input
          disabled={!readyToUpload || busy}
          type="file"
          accept=".wav"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              const d = new FormData();
              d.append("sample", f);
              d.append("consent", "yes");
              d.append("nonImpersonation", "yes");
              d.append("ownerName", ownerName.trim());
              d.append("relationship", relationship);
              await api(url, "POST", d);
              set(await api(url));
              select(true);
              fail("");
            } catch (err: any) {
              fail(err.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>

      {status.sample && (
        <div className="version-card">
          <label className="check">
            <input
              type="checkbox"
              disabled={!consent || !nonImpersonation}
              checked={enabled}
              onChange={(e) => select(e.target.checked)}
            />
            <strong>3. Aktifkan kemiripan suara sampel ini pada narasi TTS</strong>
          </label>
          <p>
            Sampel aktif: <strong>{status.consentMeta?.sourceFile || "WAV Tersimpan"}</strong> · Pemilik:{" "}
            <strong>{status.consentMeta?.ownerName || "-"}</strong>
            {prof
              ? ` · Nada Dasar: ${prof.f0Hz} Hz · Karakter: ${prof.character} · Durasi: ${prof.durationSec} dtk`
              : ""}
          </p>
          <button type="button" className="soft" onClick={removeSample}>
            Hapus sampel & cabut izin
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
