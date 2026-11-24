import asyncio
import json
import math
import os
import subprocess
import sys
import wave
import av
import numpy as np

PRESET_PROSODY = {
    "Natural": {"voice": "id-ID-ArdiNeural", "rate_offset": 0, "pitch_hz": 0},
    "Tenang": {"voice": "id-ID-ArdiNeural", "rate_offset": -10, "pitch_hz": -3},
    "Energik": {"voice": "id-ID-ArdiNeural", "rate_offset": 12, "pitch_hz": 4},
    "Dokumenter": {"voice": "id-ID-ArdiNeural", "rate_offset": -8, "pitch_hz": -6},
    "Berita": {"voice": "id-ID-ArdiNeural", "rate_offset": 6, "pitch_hz": 0},
    "Storyteller": {"voice": "id-ID-GadisNeural", "rate_offset": -4, "pitch_hz": 2},
}


def load_audio_mono(path, target_sr=24000):
    container = av.open(path)
    resampler = av.AudioResampler(format="flt", layout="mono", rate=target_sr)
    chunks = []
    for frame in container.decode(audio=0):
        for out_frame in resampler.resample(frame):
            arr = out_frame.to_ndarray()
            chunks.append(arr.reshape(-1))
    for out_frame in resampler.resample(None):
        chunks.append(out_frame.to_ndarray().reshape(-1))
    container.close()
    if not chunks:
        return np.zeros(target_sr, dtype=np.float32), target_sr
    y = np.concatenate(chunks).astype(np.float32)
    peak = float(np.max(np.abs(y)))
    if peak > 1.5:
        y = y / 32768.0
    return y, target_sr


def estimate_voice_profile(y, sr):
    win = int(sr * 0.04)
    hop = win // 2
    f0s = []
    spectra = []
    n_fft = 1024
    window = np.hanning(n_fft).astype(np.float32)

    for i in range(0, max(1, len(y) - win), hop):
        seg = y[i : i + win]
        rms = float(np.sqrt(np.mean(seg * seg)))
        if rms < 0.018:
            continue
        seg0 = seg - float(np.mean(seg))
        ac = np.correlate(seg0, seg0, mode="full")[len(seg0) - 1 :]
        lo, hi = int(sr / 340), int(sr / 75)
        if hi < len(ac) and ac[0] > 1e-6:
            pk = lo + int(np.argmax(ac[lo:hi]))
            if ac[pk] > 0.32 * ac[0]:
                if pk * 2 < hi:
                    w2_lo = max(lo, pk * 2 - 6)
                    w2_hi = min(hi, pk * 2 + 7)
                    w2 = ac[w2_lo:w2_hi]
                    if len(w2) and np.max(w2) >= 0.72 * ac[pk]:
                        pk = w2_lo + int(np.argmax(w2))
                f0s.append(float(sr / pk))
                if len(seg0) >= n_fft:
                    spec = np.abs(np.fft.rfft(seg0[:n_fft] * window)) + 1e-7
                    spectra.append(spec)

    median_f0 = float(np.median(f0s)) if f0s else 130.0
    mean_spec = np.mean(np.stack(spectra, axis=0), axis=0) if spectra else None
    character = "Wanita / Cerah" if median_f0 >= 168.0 else "Pria / Hangat" if median_f0 < 148.0 else "Tenor / Natural"
    return {
        "f0Hz": round(median_f0, 1),
        "voicedFrames": len(f0s),
        "durationSec": round(len(y) / float(sr), 2),
        "character": character,
        "spectrum": mean_spec,
    }


def smooth_curve(arr, radius=9):
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / (radius * 0.45)) ** 2)
    kernel = kernel / np.sum(kernel)
    return np.convolve(arr, kernel, mode="same")


def ola_pitch_shift(y, sr, semitones):
    if abs(semitones) < 0.15:
        return y
    ratio = 2.0 ** (semitones / 12.0)
    # Time-stretch by ratio using WSOLA/OLA, then resample by 1/ratio to preserve duration
    win_size = int(sr * 0.035)
    if win_size % 2 == 1:
        win_size += 1
    hop_out = win_size // 4
    hop_in = max(1, int(round(hop_out / ratio)))
    window = np.hanning(win_size).astype(np.float32)

    n_frames = max(1, (len(y) - win_size) // hop_in)
    stretched_len = n_frames * hop_out + win_size
    stretched = np.zeros(stretched_len, dtype=np.float32)
    norm = np.zeros(stretched_len, dtype=np.float32)

    for idx in range(n_frames):
        in_pos = idx * hop_in
        out_pos = idx * hop_out
        frame = y[in_pos : in_pos + win_size]
        if len(frame) < win_size:
            break
        stretched[out_pos : out_pos + win_size] += frame * window
        norm[out_pos : out_pos + win_size] += window * window

    mask = norm > 1e-4
    stretched[mask] /= norm[mask]

    # Resample stretched back to original length len(y)
    src_indices = np.linspace(0, len(stretched) - 1, num=len(y), dtype=np.float32)
    shifted = np.interp(src_indices, np.arange(len(stretched), dtype=np.float32), stretched).astype(np.float32)
    return shifted


def match_voice_timbre(tts_y, sr, sample_path):
    ref_y, _ = load_audio_mono(sample_path, target_sr=sr)
    ref_prof = estimate_voice_profile(ref_y, sr)
    tts_prof = estimate_voice_profile(tts_y, sr)

    out_y = tts_y.copy()
    if ref_prof["f0Hz"] > 0 and tts_prof["f0Hz"] > 0:
        semi = 12.0 * math.log2(ref_prof["f0Hz"] / tts_prof["f0Hz"])
        semi = max(-4.5, min(4.5, semi * 0.75))
        out_y = ola_pitch_shift(out_y, sr, semi)

    if ref_prof["spectrum"] is not None and tts_prof["spectrum"] is not None:
        ref_env = smooth_curve(np.log10(ref_prof["spectrum"] + 1e-6), radius=12)
        tts_env = smooth_curve(np.log10(tts_prof["spectrum"] + 1e-6), radius=12)
        diff_db = 20.0 * (ref_env - tts_env)
        diff_db = diff_db - float(np.median(diff_db))
        diff_db = np.clip(diff_db * 0.65, -7.5, 7.5)

        freqs = np.linspace(0, sr / 2.0, num=len(diff_db))
        # Taper off below 90 Hz and above 7200 Hz
        weight = np.ones_like(freqs)
        weight[freqs < 90] = 0.0
        weight[freqs > 7200] = np.maximum(0.0, 1.0 - (freqs[freqs > 7200] - 7200.0) / 2500.0)
        gain_lin = (10.0 ** ((diff_db * weight) / 20.0)).astype(np.float32)

        # STFT filtering
        n_fft = 1024
        hop = 256
        win = np.hanning(n_fft).astype(np.float32)
        padded = np.pad(out_y, (n_fft, n_fft))
        filtered = np.zeros_like(padded)
        wsum = np.zeros_like(padded)
        for i in range(0, len(padded) - n_fft, hop):
            seg = padded[i : i + n_fft] * win
            spec = np.fft.rfft(seg)
            rec = np.fft.irfft(spec * gain_lin, n=n_fft).astype(np.float32)
            filtered[i : i + n_fft] += rec * win
            wsum[i : i + n_fft] += win * win
        m = wsum > 1e-4
        filtered[m] /= wsum[m]
        out_y = filtered[n_fft : n_fft + len(out_y)]

    peak = float(np.max(np.abs(out_y)))
    if peak > 1e-4:
        out_y = out_y / peak * 0.88
    return out_y


def save_wav(path, y, sr=24000):
    pcm = np.clip(y * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


async def synthesize_edge(text, out_mp3, voice, rate_pct, pitch_hz):
    import edge_tts

    rate_str = f"{rate_pct:+d}%"
    pitch_str = f"{pitch_hz:+d}Hz"
    comm = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
    await comm.save(out_mp3)


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--analyze":
        y, sr = load_audio_mono(sys.argv[2], target_sr=24000)
        prof = estimate_voice_profile(y, sr)
        prof.pop("spectrum", None)
        print(json.dumps(prof))
        return

    text_path = sys.argv[1]
    out_wav = sys.argv[2]
    style = sys.argv[3] if len(sys.argv) > 3 else "Natural"
    rate_slider = int(float(sys.argv[4])) if len(sys.argv) > 4 else 0
    sample_path = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != "none" else None

    with open(text_path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    cfg = PRESET_PROSODY.get(style, PRESET_PROSODY["Natural"]).copy()
    if sample_path and os.path.exists(sample_path):
        try:
            ref_y, ref_sr = load_audio_mono(sample_path, target_sr=24000)
            ref_prof = estimate_voice_profile(ref_y, ref_sr)
            if ref_prof["f0Hz"] >= 165.0:
                cfg["voice"] = "id-ID-GadisNeural"
            else:
                cfg["voice"] = "id-ID-ArdiNeural"
        except Exception:
            pass

    rate_pct = max(-45, min(55, cfg["rate_offset"] + rate_slider * 8))
    pitch_hz = cfg["pitch_hz"]

    temp_mp3 = out_wav + ".mp3"
    synthesized = False
    try:
        asyncio.run(synthesize_edge(text, temp_mp3, cfg["voice"], rate_pct, pitch_hz))
        if os.path.exists(temp_mp3) and os.path.getsize(temp_mp3) > 200:
            y, sr = load_audio_mono(temp_mp3, target_sr=24000)
            synthesized = True
    except Exception:
        synthesized = False
    finally:
        if os.path.exists(temp_mp3):
            try:
                os.remove(temp_mp3)
            except OSError:
                pass

    if not synthesized:
        # Fallback offline ke Windows System.Speech
        ps1 = os.path.abspath("workers/narrate.ps1")
        subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ps1,
                text_path,
                out_wav,
                str(max(-5, min(5, rate_slider))),
                "100",
            ],
            check=True,
        )
        y, sr = load_audio_mono(out_wav, target_sr=24000)

    if sample_path and os.path.exists(sample_path):
        try:
            y = match_voice_timbre(y, sr, sample_path)
        except Exception:
            pass

    save_wav(out_wav, y, sr=24000)


if __name__ == "__main__":
    main()
