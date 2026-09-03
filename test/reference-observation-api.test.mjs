import assert from "node:assert/strict";
import test from "node:test";

import { parseRecordedReferenceLookup } from "../app/consultation-api.mjs";
import {
  buildRecordedReferenceObservation,
  lookupRecordedReferences,
} from "../app/reference-observation-api.mjs";

const row = (overrides = {}) => ({
  id: "10",
  observation_key: "observation-10",
  raw_value: " Ref 10 ",
  normalized_value: "REF 10",
  raw_label: "document.document_procinfo",
  identifier_type: "source_document_reference",
  effective_origin: "court_metadata",
  lifecycle_state: "current",
  case_file_id: null,
  bucket_id: null,
  document_id: "20",
  bucket_document_id: null,
  file_binary_id: null,
  document_representation_id: null,
  document_segment_id: null,
  page_no: null,
  char_start: null,
  char_end: null,
  direct_process_number: null,
  direct_occurrence_reference: null,
  direct_occurrence_date: null,
  direct_document_reference: "Ref 10",
  direct_processor_key: null,
  direct_processor_version: null,
  current_observation_key: "observation-10",
  observed_in_kind: "source_record",
  source_field: "document.document_procinfo",
  observer_key: "metadata-ingester",
  observer_version: "v1",
  normalization_identity: "normalizer-v1",
  namespace_hint: "source_document_reference",
  role_hint: "source_recorded_identifier",
  target_candidates_json: [],
  confidence: "high",
  review_state: "unreviewed",
  metadata_json: {},
  reviewer_key: null,
  ...overrides,
});

test("lookup parser freezes defaults and rejects unknown, duplicate, and invalid parameters", () => {
  assert.deepEqual(parseRecordedReferenceLookup(new URLSearchParams("value=Ref+10")), {
    value: "Ref 10", scope: "full", lifecycle: "current", limit: 50, offset: 0,
  });
  const cases = [
    ["scope=full", "REFERENCE_VALUE_REQUIRED"],
    ["value=+", "INVALID_REFERENCE_VALUE"],
    ["value=x&scope=other", "INVALID_REFERENCE_SCOPE"],
    ["value=x&lifecycle=history", "INVALID_REFERENCE_LIFECYCLE"],
    ["value=x&limit=0", "INVALID_REFERENCE_LIMIT"],
    ["value=x&offset=-1", "INVALID_REFERENCE_OFFSET"],
    ["value=x&extra=y", "UNKNOWN_QUERY_PARAMETER"],
    ["value=x&value=y", "DUPLICATE_QUERY_PARAMETER"],
  ];
  for (const [query, code] of cases) {
    assert.equal(parseRecordedReferenceLookup(new URLSearchParams(query)).error[0], code);
  }
});

test("observation mapping deduplicates binaries by SHA while retaining every context", () => {
  const sha = "a".repeat(64);
  const contexts = [
    { observation_id: "10", document_id: "20", bucket_document_id: "30", case_file_id: "1", bucket_id: "2", binaries: [{ file_binary_id: "40", sha256: sha }] },
    { observation_id: "10", document_id: "20", bucket_document_id: "31", case_file_id: "1", bucket_id: "3", binaries: [{ file_binary_id: "40", sha256: sha }] },
  ];
  const item = buildRecordedReferenceObservation(row(), contexts);
  assert.equal(item.direct_anchor.kind, "document");
  assert.equal(item.associated_contexts.length, 2);
  assert.equal(item.associated_binaries.length, 1);
  assert.equal(item.associated_binaries[0].sha256, sha);
  assert.equal(item.associated_binaries[0].contexts.length, 2);
  assert.equal(item.associated_binaries[0].open_action.href, `/api/consultation/binaries/${sha}`);
});

test("missing-file contexts do not create invented binary entries or open actions", () => {
  const item = buildRecordedReferenceObservation(row(), [{
    observation_id: "10", document_id: "20", bucket_document_id: "30",
    case_file_id: "1", bucket_id: "2", binaries: [],
  }]);
  assert.equal(item.binary_association_state, "all_associated_files_missing");
  assert.deepEqual(item.associated_binaries, []);
  assert.equal(item.associated_contexts[0].file_availability, "missing");
});

test("historical items expose their current replacement and lifecycle events", () => {
  const item = buildRecordedReferenceObservation(row({
    lifecycle_state: "superseded", current_observation_key: "current-key",
  }), [], [{
    transition_kind: "reconcile_legacy_pilot", from_state: "current",
    to_state: "superseded", occurred_at: "2026-09-03T10:00:00Z",
    related_observation_key: "current-key",
  }]);
  assert.equal(item.lifecycle.current_observation_key, "current-key");
  assert.equal(item.lifecycle.events[0].related_observation_key, "current-key");
});

test("historical items do not describe a merely related retired observation as current", () => {
  const item = buildRecordedReferenceObservation(row({
    lifecycle_state: "superseded", current_observation_key: null,
  }), [], [{
    transition_kind: "reconcile_legacy_pilot", from_state: "current",
    to_state: "superseded", occurred_at: "2026-09-03T10:00:00Z",
    related_observation_key: "retired-related-key",
  }]);
  assert.equal(item.lifecycle.current_observation_key, null);
  assert.equal(item.lifecycle.events[0].related_observation_key, "retired-related-key");
});

test("lookup uses observation pagination and fetches contexts only for returned rows", async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql: String(sql), params });
    if (calls.length === 1) return { rows: [row(), row({ id: "11", observation_key: "probe" })] };
    return { rows: [] };
  } };
  const payload = await lookupRecordedReferences(client, "ref 10", {
    scope: "pilot", lifecycle: "current", limit: 1, offset: 4,
  });
  assert.deepEqual(calls[0].params, ["REF 10", "current", "pilot", 2, "citius-reference-index-pilot", 4]);
  assert.deepEqual(calls[1].params, [["10"]]);
  assert.equal(calls.every(({ sql }) => /^\s*(SELECT|WITH)\b/u.test(sql)), true);
  assert.deepEqual(payload.pagination, {
    unit: "observations", limit: 1, offset: 4, returned: 1,
    has_more: true, next_offset: 5,
  });
  assert.equal(payload.result_state, "matches");
});

test("no-match result reflects declared coverage instead of claiming corpus absence", async () => {
  const client = { query: async () => ({ rows: [] }) };
  const pilot = await lookupRecordedReferences(client, "none", { scope: "pilot" });
  const full = await lookupRecordedReferences(client, "none", { scope: "full" });
  assert.equal(pilot.result_state, "no_matches_within_coverage");
  assert.equal(full.result_state, "coverage_unavailable_or_incomplete");
});
