import test from "node:test";
import assert from "node:assert/strict";
import { buildEditDecisionList } from "../server/director.mjs";
import { styles } from "../server/style-registry.mjs";

test("AI Video Director menyusun EDL lengkap dengan hook, build-up, climax, payoff, momen restraint tanpa efek, pergantian pembicara, dan keyword emphasis", () => {
  const segments = [
    { start: 0, end: 4, text: "Mengapa 80% proyek gagal di kuartal pertama?" },
    { start: 4.8, end: 9, text: "Namun ketika kita melihat data pengeluaran bulan lalu," },
    { start: 9.2, end: 14, text: "Jujur saya merasa sedih dan menyesal atas keputusan pribadi itu." },
    { start: 14.3, end: 19, text: "Ternyata kuncinya adalah memangkas biaya server sebesar 45%!" },
    { start: 19.4, end: 24, text: "Jadi mulai sekarang fokuslah pada kebutuhan pengguna." },
  ];
  const financeStyle = styles.find((s) => s.type === "finance");
  const { edl, directorSummary } = buildEditDecisionList(segments, 0, 24, financeStyle);

  assert.equal(edl.length, 5);
  assert.equal(edl[0].phase, "hook");
  assert.equal(edl[0].editingAction, "hook-punch");
  assert.ok(edl[0].emphasisKeywords.includes("80%"));

  // Beat ke-2 memiliki jeda 0.8s dan kata "Namun" -> topicShift & speakerTurn terdeteksi
  assert.equal(edl[1].speakerTurn, true);
  assert.equal(edl[1].topicShift, true);

  // Beat ke-3 bersifat reflektif ("Jujur saya merasa sedih...") -> wajib restraint (tanpa efek)
  assert.equal(edl[2].restraint, true);
  assert.equal(edl[2].editingAction, "speaker-focus-clean");
  assert.equal(edl[2].suggestedBroll.needed, false);

  // Beat ke-4 memiliki "Ternyata kuncinya..." & "45%!" -> climax atau graphic-callout
  assert.ok(["climax", "build-up"].includes(edl[3].phase));
  assert.equal(edl[3].suggestedBroll.needed, true);

  // Beat ke-5 adalah payoff penutup -> kembali fokus bersih pada pembicara
  assert.equal(edl[4].phase, "payoff");
  assert.equal(edl[4].restraint, true);
  assert.ok(directorSummary.visualBeatsCount >= 2);
  assert.ok(directorSummary.restraintBeatsCount >= 2);
});
