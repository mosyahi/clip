"""Siapkan sembilan sampel ujaran FLEURS (Google, CC BY 4.0) untuk tes studio."""
import csv
import io
import tarfile
import urllib.request
from pathlib import Path

root = Path("data/bukti")
root.mkdir(parents=True, exist_ok=True)
base = "https://huggingface.co/datasets/google/fleurs/resolve/main/data/id_id/"
with urllib.request.urlopen(base + "dev.tsv", timeout=60) as response:
    rows = csv.reader(io.StringIO(response.read().decode("utf-8")), delimiter="\t")
    reference = {row[1]: row[2] for row in rows}

names = []
with urllib.request.urlopen(base + "audio/dev.tar.gz", timeout=90) as response:
    with tarfile.open(fileobj=response, mode="r|gz") as archive:
        for item in archive:
            name = Path(item.name).name
            if name not in reference or not item.isfile():
                continue
            (root / ("fleurs-" + name)).write_bytes(archive.extractfile(item).read())
            names.append(name)
            if len(names) == 9:
                break

(root / "gabung.txt").write_text("\n".join("file 'fleurs-" + n + "'" for n in names))
(root / "fleurs-rujukan.txt").write_text("\n".join(n + " " + reference[n] for n in names), encoding="utf-8")

