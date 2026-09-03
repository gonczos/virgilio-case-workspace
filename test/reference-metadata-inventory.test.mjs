import assert from "node:assert/strict";
import test from "node:test";

import { summarizeReferenceMetadataRows } from "../app/reference-metadata-inventory.mjs";

test("inventory separates validity, normalization changes, and contextual collisions", () => {
  const report = summarizeReferenceMetadataRows([
    { source_field: "bucket.reference_number", source_record_id: "1", raw_value: " ref 1 ", process_context: "A", anchored_occurrence_date: "2020-01-01", binary_state: "linked_binary" },
    { source_field: "bucket.reference_number", source_record_id: "2", raw_value: "REF 1", process_context: "B", anchored_occurrence_date: null, binary_state: "missing_or_no_binary" },
    { source_field: "bucket.reference_number", source_record_id: "3", raw_value: null, process_context: "A", anchored_occurrence_date: null, binary_state: "linked_binary" },
    { source_field: "case_workspace_reference.reference_value", source_record_id: "8", raw_value: "ref 1", process_context: "A", anchored_occurrence_date: null, binary_state: null, field_identifier_type: "external_reference" },
  ], [{ normalized_value: "REF 1", observation_count: 2 }]);
  const bucket = report.field_reports.find((item) => item.source_field === "bucket.reference_number");
  assert.equal(bucket.total_source_records, 3);
  assert.equal(bucket.populated_source_records, 2);
  assert.equal(bucket.validity_counts.empty, 1);
  assert.equal(bucket.normalization_changed_records, 1);
  assert.equal(bucket.within_field_collision_groups, 1);
  assert.equal(bucket.pilot_normalized_overlap_records, 2);
  const collision = report.normalization_collision_summary.groups.find((item) => item.normalized_value === "REF 1");
  assert.deepEqual(collision.source_fields, ["bucket.reference_number", "case_workspace_reference.reference_value"]);
  assert.deepEqual(collision.process_contexts, ["A", "B"]);
  assert.deepEqual(collision.identifier_types, ["external_reference", "occurrence_reference"]);
  assert.deepEqual(collision.source_associations.map((item) => [item.raw_value, item.source_field, item.source_record_id]), [
    [" ref 1 ", "bucket.reference_number", "1"],
    ["REF 1", "bucket.reference_number", "2"],
    ["ref 1", "case_workspace_reference.reference_value", "8"],
  ]);
});

test("inventory reports reuse by separate records within the same field and proceeding", () => {
  const report = summarizeReferenceMetadataRows([
    { source_field: "document.document_procinfo", source_record_id: "4", raw_value: "DOC-4", process_context: "A", anchored_occurrence_date: "2020-01-01" },
    { source_field: "document.document_procinfo", source_record_id: "5", raw_value: "DOC-4", process_context: "A", anchored_occurrence_date: "2020-02-01" },
  ]);
  const overlap = report.contextual_overlap_summary.groups[0];
  assert.equal(overlap.source_record_count, 2);
  assert.deepEqual(overlap.source_associations.map((item) => item.source_record_id), ["4", "5"]);
});

test("inventory reports repeated occurrences of the same source document", () => {
  const report = summarizeReferenceMetadataRows([
    { source_field: "document.document_procinfo", source_record_id: "4", occurrence_record_id: "10", raw_value: "DOC-4", process_context: "A", anchored_occurrence_date: "2020-01-01" },
    { source_field: "document.document_procinfo", source_record_id: "4", occurrence_record_id: "11", raw_value: "DOC-4", process_context: "A", anchored_occurrence_date: "2020-01-01" },
  ]);
  const overlap = report.contextual_overlap_summary.groups[0];
  assert.equal(overlap.source_record_count, 1);
  assert.equal(overlap.source_association_count, 2);
  assert.deepEqual(overlap.source_associations.map((item) => item.occurrence_record_id), ["10", "11"]);
});

test("same raw identifier reused across fields is overlap, not a normalization collision", () => {
  const report = summarizeReferenceMetadataRows([
    { source_field: "bucket.bucket_id", source_record_id: "1", raw_value: "123", process_context: "A" },
    { source_field: "bucket.reference_number", source_record_id: "1", raw_value: "123", process_context: "A" },
  ]);
  assert.equal(report.normalization_collision_summary.group_count, 0);
  assert.equal(report.contextual_overlap_summary.group_count, 1);
});

test("inventory counts repeated document contexts once at source-record level", () => {
  const report = summarizeReferenceMetadataRows([
    { source_field: "document.document_procinfo", source_record_id: "4", raw_value: "DOC-4", process_context: "A", anchored_occurrence_date: "2020-01-01", binary_state: "linked_binary" },
    { source_field: "document.document_procinfo", source_record_id: "4", raw_value: "DOC-4", process_context: "B", anchored_occurrence_date: "2021-01-01", binary_state: "linked_binary" },
  ]);
  const field = report.field_reports.find((item) => item.source_field === "document.document_procinfo");
  assert.equal(field.total_source_records, 1);
  assert.equal(field.process_context_count, 2);
  assert.equal(field.directly_anchored_date_records, 1);
  assert.equal(field.linked_binary_source_records, 1);
  assert.equal(field.provenance_reconstructable_without_inference, "yes");
  assert.equal(field.process_coverage.A.source_records, 1);
  assert.equal(field.process_coverage.B.source_records, 1);
});
