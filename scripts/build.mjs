import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const id = randomUUID();
const dir = ".cache/web-builds/" + id;
mkdirSync(".cache/web-builds", { recursive: true });
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", "--webpack"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", STUDIO_NEXT_DIST: dir },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const pending = ".cache/web-builds/" + id + ".txt";
writeFileSync(pending, id);
renameSync(pending, ".cache/web-builds/current.txt");
