import { bundle } from "@remotion/bundler";
import path from "node:path";
await bundle({
  entryPoint: path.resolve("composition/index.jsx"),
  outDir: process.argv[2],
  publicDir: null,
});
