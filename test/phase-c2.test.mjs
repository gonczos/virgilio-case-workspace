import test from "node:test";
import assert from "node:assert/strict";

import {
  buildComparisonObservation,
  collectImportantTokens,
  normalizeComparisonText,
} from "../app/phase-c2-compare.mjs";

test("normalizeComparisonText removes superficial whitespace noise only", () => {
  const value = " A\r\n\r\nB\t\tC \n";
  assert.equal(normalizeComparisonText(value), "A\n\nB C");
});

test("collectImportantTokens preserves identifier-bearing tokens", () => {
  const tokens = collectImportantTokens("Proc. 824/13.7T8SNT-A em 2020-08-13.");
  assert.deepEqual(tokens, ["2020-08-13", "824/13.7T8SNT-A"]);
});

test("buildComparisonObservation surfaces one-character identifier drift", () => {
  const observation = buildComparisonObservation({
    leftEngine: "docling",
    rightEngine: "xberg",
    leftText: "Processo 824/13.7T8SNT-A",
    rightText: "Processo 824/13.7TBSNT-A",
  });

  assert.equal(observation.exact_normalized_match, false);
  assert.equal(observation.disagreement_level, "high");
  assert.deepEqual(observation.important_tokens_only.docling, ["824/13.7T8SNT-A"]);
  assert.deepEqual(observation.important_tokens_only.xberg, ["824/13.7TBSNT-A"]);
});
