export function downloadProgress(info) {
  // yt-dlp menghapus requested_formats dari info.json saat beberapa trek digabung.
  const ids = String(info.format_id).split("+");
  const formats = info.requested_formats?.length
    ? info.requested_formats
    : ids.length === 1
      ? [info]
      : ids.map(
          (id) =>
            info.formats?.find((f) => String(f.format_id) === id) || {
              format_id: id,
            },
        );
  const parts = new Map(
    formats.map((f) => [
      String(f.format_id),
      {
        bytes: 0,
        total: Number(f.filesize || f.filesize_approx) || 0,
      },
    ]),
  );
  let highest = 0;
  return (id, downloaded, total) => {
    const part = parts.get(id) || { bytes: 0, total: 0 };
    parts.set(id, part);
    part.bytes = Math.max(part.bytes, Number(downloaded) || 0);
    part.total = Number(total) || part.total;
    const tracks = [...parts.values()];
    const bytes = tracks.reduce((n, t) => n + t.bytes, 0);
    if (!tracks.every((t) => t.total > 0)) return { percent: null, bytes };
    const size = tracks.reduce((n, t) => n + t.total, 0);
    highest = Math.max(highest, Math.min(99, Math.floor((100 * bytes) / size)));
    return { percent: highest, bytes };
  };
}
