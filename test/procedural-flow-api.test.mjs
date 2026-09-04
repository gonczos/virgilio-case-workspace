import assert from "node:assert/strict";
import test from "node:test";
import { buildBucketExpansion, buildProceduralFlow } from "../app/procedural-flow-api.mjs";

test("procedural flow keeps source cases as lanes and buckets as dated events", () => {
  const result = buildProceduralFlow([
    { case_file_id: 1, process_number: "P", is_base_case: true, bucket_id: 10,
      reference_number: "R1", bucket_date: "2020-01-01", linked_document_count: 1,
      available_binary_count: 1 },
    { case_file_id: 2, process_number: "P-A", parent_case_file_id: 1, bucket_id: 20,
      reference_number: "R2", bucket_date: null, linked_document_count: 1,
      available_binary_count: 0 },
  ]);
  assert.equal(result.lanes.length, 2);
  assert.equal(result.buckets[0].occurrence_date, "2020-01-01");
  assert.equal(result.buckets[1].file_availability, "missing");
  assert.match(result.coverage.date_semantics, /Recorded court-system/u);
});

test("bucket expansion preserves documents, binaries, and reused occurrences", () => {
  const sha256 = "a".repeat(64);
  const result = buildBucketExpansion(10, [{ document_id: 4, document_name: "Order",
    file_binary_id: 8, sha256, related_bucket_id: 20, related_case_file_id: 2,
    related_process_number: "P-A", related_reference_number: "R2",
    related_bucket_date: "2020-02-01" }]);
  assert.ok(result.nodes.some((node) => node.id === "document:4"));
  assert.ok(result.nodes.some((node) => node.id === `binary:${sha256}`));
  assert.ok(result.nodes.some((node) => node.id === "bucket:20"));
  assert.ok(result.edges.some((edge) => edge.kind === "same_binary_occurs_in"));
  assert.equal(result.nodes.find((node) => node.kind === "binary").open_action.href, `/binaries/${sha256}`);
});

test("missing documents do not gain binary nodes or open actions", () => {
  const result = buildBucketExpansion(10, [{ document_id: 4, document_name: "Missing",
    file_binary_id: null, sha256: null, related_bucket_id: null }]);
  assert.equal(result.nodes.some((node) => node.kind === "binary"), false);
  assert.equal(result.nodes.some((node) => node.open_action), false);
});
