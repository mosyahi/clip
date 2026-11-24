import { createServer } from "node:http";
import assert from "node:assert/strict";
import test from "node:test";
import { recommend, detectLocalLLM } from "../server/highlights.mjs";

test("kontrak provider lokal menyimpan timestamp asli dan memakai metadata penilaian", async () => {
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    assert.equal(request.model, "model-uji");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                clips: [
                  {
                    id: 0,
                    title: "Judul uji",
                    hook: "Hook",
                    reason: "Isi lengkap",
                    score: 89,
                  },
                ],
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const oldUrl = process.env.LLM_BASE_URL,
    oldModel = process.env.LLM_MODEL;
  try {
    process.env.LLM_BASE_URL =
      "http://127.0.0.1:" + server.address().port + "/v1";
    process.env.LLM_MODEL = "model-uji";
    const r = await recommend(
      [{ start: 4, end: 23, text: "Contoh ujaran yang lengkap." }],
      { min: 15, count: 3, provider: true },
    );
    assert.equal(r.clips[0].start, 4);
    assert.equal(r.clips[0].end, 23);
    assert.equal(r.clips[0].title, "Judul uji");
    assert.equal(r.clips[0].score, 89);
  } finally {
    if (oldUrl === undefined) delete process.env.LLM_BASE_URL;
    else process.env.LLM_BASE_URL = oldUrl;
    if (oldModel === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = oldModel;
    await new Promise((r) => server.close(r));
  }
});

test("detectLocalLLM menghormati LLM_MODE=disabled dan local-only", async () => {
  const oldMode = process.env.LLM_MODE, oldUrl = process.env.LLM_BASE_URL, oldModel = process.env.LLM_MODEL;
  try {
    process.env.LLM_MODE = "disabled";
    assert.equal(await detectLocalLLM({ probeOllama: false }), null);
    process.env.LLM_MODE = "local-only";
    process.env.LLM_BASE_URL = "https://api.example.com/v1";
    process.env.LLM_MODEL = "remote";
    assert.equal(await detectLocalLLM({ probeOllama: false }), null);
    process.env.LLM_BASE_URL = "http://127.0.0.1:11434/v1";
    process.env.LLM_MODEL = "qwen2.5";
    const local = await detectLocalLLM({ probeOllama: false });
    assert.equal(local.model, "qwen2.5");
    assert.equal(local.source, "env");
  } finally {
    for (const [k, v] of Object.entries({ LLM_MODE: oldMode, LLM_BASE_URL: oldUrl, LLM_MODEL: oldModel })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
