import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const samplePath = "docs/evaluation/reference-v5-corpus-rollout/audit-sample-v1.json";
const reviewPath = "docs/evaluation/reference-v5-corpus-rollout/audit-review-v1.json";

test("completed v5 corpus audit preserves the frozen sample and failed gate", () => {
  const sampleBytes = fs.readFileSync(samplePath);
  const sample = JSON.parse(sampleBytes);
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));

  assert.equal(
    crypto.createHash("sha256").update(sampleBytes).digest("hex"),
    review.sample.sha256,
  );
  assert.equal(review.prediction_reviews.length, 180);
  assert.deepEqual(
    review.prediction_reviews.map((item) => item.observation_key),
    sample.prediction_sample.map((item) => item.observation_key),
  );
  assert.equal(new Set(review.prediction_reviews.map((item) => item.observation_key)).size, 180);
  const sessionObservationKeys = review.review_sessions
    .filter((session) => session.session_id.startsWith("corpus-v5-guided-human-review-batch-"))
    .flatMap((session) => session.observation_keys ?? []);
  assert.deepEqual(sessionObservationKeys, sample.prediction_sample.map((item) => item.observation_key));
  const sessionControlIds = review.review_sessions
    .flatMap((session) => session.control_segment_ids ?? []);
  assert.deepEqual(
    sessionControlIds,
    sample.no_prediction_segment_controls.map((item) => item.document_segment_id),
  );

  const decisions = Object.groupBy(review.prediction_reviews, (item) => item.decision);
  assert.equal(decisions.confirmed.length, 162);
  assert.equal(decisions.rejected.length, 16);
  assert.equal(decisions.needs_original_pdf_verification.length, 2);
  for (const item of review.prediction_reviews) {
    assert.equal(item.target_resolution, "unresolved");
    assert.equal(item.relationship_resolution, "unresolved");
  }

  assert.equal(review.no_prediction_control_reviews.length, 30);
  assert.deepEqual(
    review.no_prediction_control_reviews.map((item) => item.document_segment_id),
    sample.no_prediction_segment_controls.map((item) => item.document_segment_id),
  );
  assert.ok(review.no_prediction_control_reviews.every(
    (item) => item.decision === "passed_no_missed_in_scope_v5_form"
      && item.confirmed_missed_in_scope_v5_forms.length === 0,
  ));
  assert.equal(review.recall_error_observations.length, 4);
  assert.ok(review.recall_error_observations.every(
    (item) => item.scoring === "separate_recall_error_analysis_not_sampled_false_positive"
      && item.target_resolution === "unresolved"
      && item.relationship_resolution === "unresolved",
  ));
  assert.deepEqual(
    review.recall_error_observations.map((item) => item.missed_raw_span),
    ["26v.", "7", "838", "1103"],
  );
  assert.ok(review.recall_error_observations.every(
    (item) => Number.isInteger(item.segment_char_start)
      && item.segment_char_end > item.segment_char_start
      && item.segment_char_start === item.representation_char_start
      && item.segment_char_end === item.representation_char_end,
  ));

  assert.equal(review.summary.sampled_false_positive_rate, 16 / 180);
  assert.equal(review.summary.human_gate_passed, false);
  assert.equal(review.summary.human_gate_state, "failed_complete_audit");
  assert.equal(review.summary.write_authorized, false);
  assert.deepEqual(review.summary.human_gate_failure_reasons, [
    "prediction_false_positive_count_exceeds_3",
    "prediction_false_positive_rate_exceeds_0.02",
  ]);
});
