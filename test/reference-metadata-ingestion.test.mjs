import assert from "node:assert/strict";
import test from "node:test";

import {
  NORMALIZATION_IDENTITY,
  buildMetadataObservationKey,
  buildSourceAssertionKey,
  ingestMetadataReferences,
  materializeDesiredObservation,
  planMetadataReferenceIngestion,
} from "../app/reference-metadata-ingestion.mjs";

const source = (overrides = {}) => ({
  observation_origin: "court_metadata",
  source_field: "document.document_procinfo",
  identifier_type: "source_document_reference",
  source_record_id: "10",
  raw_value: " REF-10 ",
  case_file_id: null,
  bucket_id: null,
  document_id: 10,
  anchored_occurrence_date: null,
  process_number: null,
  occurrence_contexts: [],
  available_file_count: 1,
  missing_file_count: 0,
  ...overrides,
});

const existing = (desired, overrides = {}) => ({
  id: 100,
  observation_key: desired.observation_key,
  source_assertion_key: desired.source_assertion_key,
  raw_value: desired.raw_value,
  normalized_value: desired.normalized_value,
  normalization_identity: desired.normalization_identity,
  lifecycle_state: "current",
  observer_key: "app/reference-metadata-ingestion.mjs",
  observer_version: "v1",
  metadata_json: {},
  has_review: false,
  ...overrides,
});

test("metadata identities are deterministic and preserve raw-value identity", () => {
  const first = materializeDesiredObservation(source());
  const repeat = materializeDesiredObservation(source());
  const reformatted = materializeDesiredObservation(source({ raw_value: "REF-10" }));
  assert.equal(first.source_assertion_key, repeat.source_assertion_key);
  assert.equal(first.observation_key, repeat.observation_key);
  assert.equal(first.normalized_value, reformatted.normalized_value);
  assert.notEqual(first.observation_key, reformatted.observation_key);
});

test("association states distinguish no direct, missing, available, and mixed files", () => {
  assert.equal(materializeDesiredObservation(source({
    source_field: "case_file.processo", identifier_type: "process_number",
    case_file_id: 1, document_id: null,
  })).binary_association_state, "no_direct_binary_association");
  assert.equal(materializeDesiredObservation(source({ available_file_count: 0, missing_file_count: 1 })).binary_association_state, "all_associated_files_missing");
  assert.equal(materializeDesiredObservation(source()).binary_association_state, "all_associated_files_available");
  assert.equal(materializeDesiredObservation(source({ available_file_count: 2, missing_file_count: 1 })).binary_association_state, "mixed_file_availability");
});

test("document observations retain every occurrence context without borrowing a date", () => {
  const contexts = [
    { bucket_document_id: 1, occurrence_reference: "A", occurrence_date: "2020-01-01", process_number: "P" },
    { bucket_document_id: 2, occurrence_reference: "B", occurrence_date: "2021-01-01", process_number: "P-A" },
  ];
  const desired = materializeDesiredObservation(source({ occurrence_contexts: contexts }));
  assert.deepEqual(desired.occurrence_contexts, contexts);
  assert.equal(desired.anchored_occurrence_date, null);
  assert.equal(desired.document_id, 10);
});

test("planner inserts, refreshes, retires disappeared values, and reconciles only matching pilot metadata", () => {
  const desired = materializeDesiredObservation(source());
  const retired = materializeDesiredObservation(source({ source_record_id: "11", document_id: 11, raw_value: "OLD" }));
  const plan = planMetadataReferenceIngestion(
    [source()],
    [existing(desired), existing(retired, { id: 101 })],
    [
      { id: 201, lifecycle_state: "current", raw_label: "document.document_procinfo", document_id: 10, bucket_id: 4 },
      { id: 202, lifecycle_state: "current", raw_label: "document.document_procinfo", document_id: 999, bucket_id: 4 },
    ],
  );
  assert.deepEqual(plan.operations.map((item) => item.kind), [
    "refresh", "retire_source_absent", "reconcile_legacy_pilot",
  ]);
});

test("A to B to A supersedes current B and reactivates historical A without losing its review", () => {
  const rowA = source({ raw_value: "A" });
  const desiredA = materializeDesiredObservation(rowA);
  const desiredB = materializeDesiredObservation(source({ raw_value: "B" }));
  const plan = planMetadataReferenceIngestion([rowA], [
    existing(desiredA, { id: 1, lifecycle_state: "superseded", has_review: true }),
    existing(desiredB, { id: 2, lifecycle_state: "current" }),
  ], []);
  assert.deepEqual(plan.operations.map((item) => item.kind), ["supersede", "reactivate"]);
  assert.equal(plan.counts.retained_reviewed, 1);
});

test("same raw value under a changed normalization identity creates a separate observation", () => {
  const desired = materializeDesiredObservation(source({ raw_value: "A" }));
  const oldIdentity = { ...desired, normalization_identity: "older-rules" };
  oldIdentity.observation_key = buildMetadataObservationKey(oldIdentity);
  const plan = planMetadataReferenceIngestion([source({ raw_value: "A" })], [existing(oldIdentity)], []);
  assert.deepEqual(plan.operations.map((item) => item.kind), ["insert", "supersede"]);
  assert.equal(desired.normalization_identity, NORMALIZATION_IDENTITY);
});

test("planner leaves document-text and external-register observations active", () => {
  const plan = planMetadataReferenceIngestion([], [
    { id: 1, lifecycle_state: "current", observer_key: "labelled-reference-extractor", source_assertion_key: null },
    { id: 2, lifecycle_state: "current", observer_key: "virgilio-imported-source-record", source_assertion_key: null },
  ], []);
  assert.deepEqual(plan.operations, []);
});

test("dry-run issues only the three read queries", async () => {
  const queries = [];
  const client = { query: async (sql) => {
    queries.push(String(sql));
    return { rows: [] };
  } };
  const result = await ingestMetadataReferences(client);
  assert.equal(result.mode, "dry_run");
  assert.equal(result.mutation_statements_issued, false);
  assert.equal(queries.length, 3);
  assert.ok(queries.every((sql) => /^\s*SELECT/.test(sql)));
});

test("failed write rolls back and reports zero committed changes", async () => {
  const queries = [];
  let selectNumber = 0;
  const client = { query: async (sql) => {
    const text = String(sql).trim();
    queries.push(text);
    if (text.startsWith("SELECT")) {
      selectNumber += 1;
      return { rows: selectNumber === 1 ? [source()] : [] };
    }
    if (text.startsWith("INSERT INTO casework.reference_observation (")) throw new Error("synthetic failure");
    return { rows: [] };
  } };
  await assert.rejects(
    ingestMetadataReferences(client, { write: true }),
    (error) => {
      assert.equal(error.message, "synthetic failure");
      assert.equal(error.ingestion_result.attempted.insert, 1);
      assert.equal(error.ingestion_result.committed.insert, 0);
      assert.equal(error.ingestion_result.mutation_statements_issued, true);
      return true;
    },
  );
  assert.ok(queries.includes("BEGIN ISOLATION LEVEL REPEATABLE READ"));
  assert.ok(queries.includes("ROLLBACK"));
  assert.ok(!queries.includes("COMMIT"));
});

test("write mode builds its plan after opening the transaction", async () => {
  const queries = [];
  const client = { query: async (sql) => {
    queries.push(String(sql).trim());
    return { rows: [] };
  } };
  const result = await ingestMetadataReferences(client, { write: true });
  assert.equal(queries[0], "BEGIN ISOLATION LEVEL REPEATABLE READ");
  assert.match(queries[1], /^SELECT/);
  assert.match(queries[2], /^SELECT/);
  assert.match(queries[3], /^SELECT/);
  assert.equal(queries.at(-1), "COMMIT");
  assert.equal(result.desired_observation_count, 0);
  assert.equal(result.mutation_statements_issued, false);
});

test("source assertion identity includes field, type, origin, and source record", () => {
  const base = source();
  const key = buildSourceAssertionKey(base);
  for (const changed of [
    { source_field: "bucket.reference_number" },
    { identifier_type: "occurrence_reference" },
    { observation_origin: "external_register" },
    { source_record_id: "11" },
  ]) assert.notEqual(buildSourceAssertionKey({ ...base, ...changed }), key);
});
