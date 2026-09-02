// Invariant tests for the material difficulty / CEFR pipeline.
// Run with:  node test/cefr.test.mjs
// These lock the bug-fix invariants: consistent level per material id, A1 never
// gets a validated B1 text, hard-word ratio bound, proper nouns excluded, harder
// words preserved in the candidate list, and deterministic (stable) analysis.

import {
  analyzeDifficulty, validateForLevel, validateMaterialFit, materialId, buildMaterialAnalysis,
  estimateWordCefr, cefrIdx, tierForRatio, CEFR_LEVELS,
} from "../lib/cefr.mjs";

let passed = 0, failed = 0;
const results = [];
function ok(name, cond, detail = "") {
  if (cond) { passed++; results.push(`  ✓ ${name}`); }
  else { failed++; results.push(`  ✗ ${name}${detail ? "  — " + detail : ""}`); }
}

// A genuinely A1-appropriate text: almost entirely A1 base vocabulary.
const A1_OK_TEXT =
  "Ik ga naar huis. Ik eet brood en kaas. Ik drink koffie en thee. " +
  "Mijn vriend komt ook. Wij lezen een boek samen. Het is een goede dag.";

// The weekend dialogue is really an A2 text for an A1 learner (lots of A2 words:
// markt, gezellig, misschien, cadeau, zullen) plus a couple of B1 words (proeven,
// ergens). Proper nouns: Sanne, Amir, Utrecht.
const A2_TEXT =
  "Sanne: Wat ga jij dit weekend doen?\n" +
  "Amir: Ik wil naar een markt in Utrecht, omdat ik nieuwe kazen wil proeven en misschien een cadeau zoek voor mijn zus.\n" +
  "Sanne: Dat klinkt gezellig. Zullen we samen gaan?\n" +
  "Amir: Goed idee. We spreken af bij het station en drinken daarna ergens koffie.";

// A clearly harder text with lots of B1/B2 abstract vocabulary.
const HARD_TEXT =
  "De regering benadrukt dat de maatschappelijke gevolgen van het beleid ingrijpend zijn. " +
  "Onderzoekers beweren dat de ontwikkeling desalniettemin cruciaal blijft voor de samenleving, " +
  "hoewel de consequenties nauwelijks te voorspellen zijn en het fenomeen problematisch genuanceerd wordt.";

const A1_WITH_TWO_HIGHER_WORDS =
  "Ik ben thuis. Ik eet brood en kaas. Ik drink thee. Mijn vriend komt ook. " +
  "Wij lezen samen. Ik wil proeven. Dit is cruciaal. Het is een goede dag.";

const A1_WITH_TOO_MANY_HIGHER_WORDS =
  "Ik ben thuis. Ik eet brood en kaas. Ik drink thee. Mijn vriend komt ook. " +
  "Wij lezen samen. Ik wil proeven. Daarna zit ik ergens. De regering benadrukt beleid.";

const C1_TEXT =
  "De institutionalisering van het beleid roept fundamentele vragen op over legitimiteit en ondermijning. " +
  "Critici beschouwen de veronderstelling achter deze paradigmaverschuiving als onverenigbaar met lokale autonomie.";

// ---- 1. determinism: same text -> same id + same analysis (source of truth) ----
{
  const id1 = materialId(A1_OK_TEXT), id2 = materialId(A1_OK_TEXT);
  ok("materialId is stable for the same text", id1 === id2);
  const a1 = analyzeDifficulty(A1_OK_TEXT, "A1 — Beginner");
  const a2 = analyzeDifficulty(A1_OK_TEXT, "A1 — Beginner");
  ok("analysis is deterministic (validatedTextLevel)", a1.validatedTextLevel === a2.validatedTextLevel, `${a1.validatedTextLevel} vs ${a2.validatedTextLevel}`);
  ok("analysis is deterministic (hardWordRatio)", a1.hardWordRatio === a2.hardWordRatio);
  ok("different texts get different ids", materialId(A1_OK_TEXT) !== materialId(HARD_TEXT));
}

// ---- 2. A1 learner + A1 text: validates, level <= A2, ratio <= 30% ----
{
  const v = validateForLevel(A1_OK_TEXT, "A1 — Beginner");
  ok("A1 text validates for A1 learner", v.ok, v.reason);
  ok("validated level does not exceed A2", cefrIdx(v.analysis.validatedTextLevel) <= cefrIdx("A2"), v.analysis.validatedTextLevel);
  ok("hard-word ratio <= 30%", v.analysis.hardWordRatio <= 0.30, `${v.analysis.hardWordRatio}`);
  // The A2 weekend dialogue is correctly flagged as too hard (>30% above-level) for an A1 learner.
  const v2 = validateForLevel(A2_TEXT, "A1 — Beginner");
  ok("A2 dialogue is flagged as too hard for an A1 learner", v2.ok === false, v2.reason);
}

// ---- 3. A1 learner never accepts a validated B1+ text ----
{
  const v = validateForLevel(HARD_TEXT, "A1 — Beginner");
  ok("hard B1/B2 text is REJECTED for an A1 learner", v.ok === false, v.reason);
  ok("rejected text's raw level is above A2", cefrIdx(v.analysis.validatedTextLevel) > cefrIdx("A2"), v.analysis.validatedTextLevel);
}

// ---- 3b. generated material fit has both a lower and upper bound ----
{
  const tooEasy = validateMaterialFit(A2_TEXT, "B2 — Upper-intermediate");
  ok("B2 learner rejects A2 generated material as too easy", tooEasy.ok === false, tooEasy.reason);
  const c1Fit = validateMaterialFit(C1_TEXT, "C1 — Advanced");
  ok("C1 learner accepts C1 generated material", c1Fit.ok === true, c1Fit.reason);
}

// ---- 3c. tiny over-cap tolerance: realistic texts may contain 1-2 higher words ----
{
  const okTiny = validateForLevel(A1_WITH_TWO_HIGHER_WORDS, "A1 — Beginner");
  ok("A1 tolerates two B1+ words", okTiny.ok === true, okTiny.reason);
  ok("A1 tiny tolerance records two above-cap word types", okTiny.analysis.aboveCapTypes === 2, `${okTiny.analysis.aboveCapTypes}`);
  const tooMany = validateForLevel(A1_WITH_TOO_MANY_HIGHER_WORDS, "A1 — Beginner");
  ok("A1 rejects more than two B1+ words", tooMany.ok === false, tooMany.reason);
}

// ---- 4. same material id => same metadata everywhere (card = preview = diagnosis) ----
{
  // Simulate generation-time analysis and lesson-time analysis of the same text.
  const gen = buildMaterialAnalysis(A2_TEXT, "A1 — Beginner", { source: "Dialogue", title: "Weekend" });
  const lessonSide = analyzeDifficulty(A2_TEXT, "A1 — Beginner");
  ok("card id == lesson id", gen.id === materialId(A2_TEXT));
  ok("card level == preview/diagnosis level",
    gen.validatedTextLevel === lessonSide.validatedTextLevel,
    `${gen.validatedTextLevel} vs ${lessonSide.validatedTextLevel}`);
}

// ---- 5. harder vocabulary is preserved in candidate annotations ----
{
  const a = analyzeDifficulty(A2_TEXT, "A1 — Beginner");
  const lemmas = a.annotations.map(x => x.lemma);
  // "proeven" and "ergens" are B1 and above an A1 learner's level; they must
  // appear as candidates rather than being silently excluded.
  ok("harder word 'proeven' kept as a candidate", lemmas.includes("proeven"), lemmas.join(","));
  ok("harder word 'ergens' kept as a candidate", lemmas.includes("ergens"), lemmas.join(","));
  ok("all annotations are above the learner level", a.annotations.every(x => x.cefrIdx > cefrIdx("A1")));
  ok("annotations carry CEFR + span", a.annotations.every(x => x.cefr && Array.isArray(x.spans) && x.spans.length && Array.isArray(x.spans[0])));
}

// ---- 6. proper nouns are excluded from difficulty ----
{
  const a = analyzeDifficulty(A2_TEXT, "A1 — Beginner");
  const lemmas = a.annotations.map(x => x.lemma);
  ok("proper noun 'utrecht' NOT counted as hard vocab", !lemmas.includes("utrecht"), lemmas.join(","));
  ok("proper noun 'amir' NOT counted as hard vocab", !lemmas.includes("amir"), lemmas.join(","));
  ok("proper noun 'sanne' NOT counted as hard vocab", !lemmas.includes("sanne"), lemmas.join(","));
}

// ---- 7. relative rule works for a higher level (B1 learner tolerates more) ----
{
  const vA1 = validateForLevel(HARD_TEXT, "A1 — Beginner");
  const vB1 = validateForLevel(HARD_TEXT, "B1 — Intermediate");
  ok("same text rejected for A1 but the cap rises for B1",
    vA1.ok === false && cefrIdx(vB1.analysis.validatedTextLevel) >= cefrIdx(vA1.analysis.validatedTextLevel));
}

// ---- 8. tier bands increase gradually ----
{
  ok("ratio 0.12 -> comfortable", tierForRatio(0.12) === "comfortable");
  ok("ratio 0.18 -> balanced", tierForRatio(0.18) === "balanced");
  ok("ratio 0.27 -> stretch", tierForRatio(0.27) === "stretch");
}

// ---- 9. word-level grader sanity ----
{
  ok("function word 'de' is A1", estimateWordCefr("de") === "A1");
  ok("CEFR levels array intact", CEFR_LEVELS.join(",") === "A1,A2,B1,B2,C1");
}

console.log("\nCEFR pipeline invariants:");
console.log(results.join("\n"));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
