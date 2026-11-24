export function parseTime(value) {
  const text = String(value).trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (
    !/^\d+:[0-5]\d(\.\d+)?$/.test(text) &&
    !/^\d+:[0-5]\d:[0-5]\d(\.\d+)?$/.test(text)
  )
    throw Error("Gunakan waktu seperti 12:30, 1:02:30, atau jumlah detik.");
  return text
    .split(":")
    .reduce((seconds, part) => seconds * 60 + Number(part), 0);
}
export function timecode(n) {
  const ms = Math.round(n * 1000);
  const minutes = Math.floor(ms / 60000);
  const seconds = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  const fraction = String(ms % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return minutes + ":" + seconds + (fraction ? "." + fraction : "");
}
