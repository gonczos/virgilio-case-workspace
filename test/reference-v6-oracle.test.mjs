import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const hash = (path) => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");

test("v6 oracle faithfully encodes the corrected human audit", () => {
  const oracle = read("docs/evaluation/reference-v5-corpus-rollout/v6-audit-oracle-v1.json");
  const review = read("docs/evaluation/reference-v5-corpus-rollout/audit-review-v1.json");
  assert.equal(oracle.source.review_sha256, hash(oracle.source.review_path));
  assert.equal(oracle.source.sample_sha256, hash(oracle.source.sample_path));
  assert.deepEqual(oracle.summary, {
    source_predictions: 180,
    expected_exact: 170,
    expected_absent: 8,
    expected_recall_additions: 4,
    unscored_preserved: 2,
    no_prediction_controls: 30,
    protected_negatives: 50,
    protected_ambiguous: 3,
  });
  assert.equal(review.summary.confirmed, 162);
  assert.equal(review.summary.rejected, 16);
  assert.equal(review.summary.needs_original_pdf_verification, 2);
  assert.equal(oracle.cases.length, 184);
  assert.equal(oracle.no_prediction_controls.length, 30);
  assert.ok(oracle.cases.every((item) => item.expected?.target_resolution !== "resolved"));
  assert.ok(oracle.cases.every((item) => item.expected?.relationship_resolution !== "resolved"));
  const corrected133 = oracle.cases.find((item) => item.source_prediction_number === 133);
  assert.equal(corrected133.expected.raw_value, "Doc nº5- A");
  assert.equal(corrected133.expected.rule_key, "local-attachment-doc-v2");
});

test("saved v6 evaluation passes every bounded gate", () => {
  const result = read("docs/evaluation/reference-v5-corpus-rollout/labelled-reference-v6-evaluation.json");
  assert.equal(result.passed, true);
  assert.equal(result.audit.summary.cases_passed, 184);
  assert.equal(result.audit.summary.controls_passed, 30);
  assert.deepEqual(result.pending_original_pdf_verification.map((item) => item.source_prediction_number), [8, 115]);
  for (const fixture of [result.foundation, result.expansion]) {
    assert.equal(fixture.summary.exact, fixture.summary.positive_count);
    assert.equal(fixture.summary.missed, 0);
    assert.equal(fixture.summary.spurious, 0);
    assert.equal(fixture.summary.negative_overlaps, 0);
    assert.equal(fixture.summary.ambiguous_overlaps, 0);
  }
});
