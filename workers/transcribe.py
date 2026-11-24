import json
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HOME", str(Path(".cache/huggingface").resolve()))
from faster_whisper import WhisperModel

audio, language, destination = sys.argv[1:]
model_name = os.environ.get("WHISPER_MODEL", "base")
local = Path(".cache/models") / model_name
model = WhisperModel(str(local) if (local / "model.bin").exists() else model_name,
                     device="cpu", compute_type="int8", cpu_threads=4,
                     download_root=".cache/models")
segments, info = model.transcribe(audio, language=None if language == "auto" else language,
                                  word_timestamps=True, vad_filter=True)
result = []
for seg in segments:
    text = seg.text.strip()
    if not text:
        continue
    words = [{"text": w.word.strip(), "start": w.start, "end": w.end} for w in seg.words or [] if w.word.strip()]
    result.append({"start": seg.start, "end": seg.end, "text": text, "words": words})
    print(round(100 * seg.end / max(info.duration, .01)), flush=True)
Path(destination).write_text(json.dumps({"language": info.language, "segments": result}, ensure_ascii=False), encoding="utf-8")

