import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePredictions } from "../app/evaluate-reference-extraction-foundation.mjs";

test("classifies exact, overlapping, missed, spurious, and date-negative predictions", () => {
  const annotations = [
    { id: "p1", label: "court_occurrence_or_citius_reference", polarity: "positive", raw_span: "12345", char_start: 10, char_end: 15 },
    { id: "p2", label: "local_attachment", polarity: "positive", raw_span: "Doc 2", char_start: 20, char_end: 25 },
    { id: "n1", label: "reference_like_negative", polarity: "negative", raw_span: "10.2.2020", char_start: 30, char_end: 39 },
  ];
  const predictions = [
    { raw_value: "12345", char_start: 10, char_end: 15 },
    { raw_value: "Doc", char_start: 20, char_end: 23 },
    { raw_value: "2020", char_start: 35, char_end: 39 },
    { raw_value: "999", char_start: 50, char_end: 53 },
  ];
  const result = evaluatePredictions({ predictions, annotations });
  assert.deepEqual(result.gold_positive_results.map((row) => row.outcome), ["exact", "partial_or_overlapping"]);
  assert.deepEqual(result.predictions.map((row) => row.outcome), ["exact", "partial_or_overlapping", "spurious", "spurious"]);
  assert.equal(result.summary.overall.recall, 1);
  assert.equal(result.summary.overall.exact_span_recall, 0.5);
  assert.equal(result.summary.predictions_overlapping_date_negatives, 1);
  assert.equal(result.summary.spurious_prediction_count, 2);
});