import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCourtRecordQuery, queryCourtRecords } from "../app/court-records-api.mjs";

const sha256 = "a".repeat(64);

function row(overrides = {}) {
  return {
    total_count: "1", bucket_document_id: "40", bucket_document_observation_count: 1,
    has_intra_bucket_duplication: false, bucket_document_confidence: "observed_stable",
    court_id: "1", country_id: "PT", court_source_system: "citius", tribunal_name: "Tribunal A",
    unit_name: "Juízo B", source_court_id: "T1", source_unit_id: "U1", source_client_id: "C1",
    court_confidence: "observed_stable", case_file_id: "2", case_source_system: "citius",
    process_number: "13608/14.8T2SNT", source_process_id: "P1", case_classification: "Família",
    case_status: "active", registration_date: "2014-07-10", decision_date: null,
    parent_case_file_id: null, is_base_case: true, case_scope_status: "included",
    case_confidence: "observed_stable", bucket_id: "3", bucket_source_system: "citius",
    source_bucket_id: "B1", occurrence_reference: "85759502", occurrence_date: "2016-01-02",
    designation: "Requerimento", presenter: "Mandatário", modal_title: null,
    source_document_count: 1, bucket_confidence: "observed_stable", document_id: "4",
    document_source_system: "citius", source_document_reference: "D1", document_name: "Requerimento",
    document_anchor_title: null, document_date: "2016-01-02", document_type: "PDF",
    document_type_from_attr: "application/pdf", document_identity_class: "imported_source_keyed",
    claimed_size_bytes: "123", document_confidence: "observed_stable",
    binaries: [{ document_binary_id: 5, file_binary_id: 6, sha256, mime_type: "application/pdf",
      file_extension: ".pdf", size_bytes: 123, retention_status: "retained",
      integrity_check_status: "verified", machine_readability_status: "text_pdf", is_primary: true,
      match_confidence: "exact", source_observation_count: 1 }],
    ...overrides,
  };
}

test("court-record query validates dates, identifiers, pagination, and unknown filters", () => {
  assert.equal(normalizeCourtRecordQuery({ process_number: " P1 " }).process_number, "P1");
  assert.equal(normalizeCourtRecordQuery({ binary_sha256: sha256.toUpperCase() }).binary_sha256, sha256);
  assert.throws(() => normalizeCourtRecordQuery({ date_from: "2026-02-30" }), { code: "INVALID_COURT_RECORD_FILTER" });
  assert.throws(() => normalizeCourtRecordQuery({ date_from: "2026-03-02", date_to: "2026-03-01" }), { code: "INVALID_COURT_RECORD_FILTER" });
  assert.throws(() => normalizeCourtRecordQuery({ unexpected: true }), { code: "UNKNOWN_COURT_RECORD_FILTER" });
});

test("court-record results preserve occurrence identity, binaries, and recorded structural relations", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [row()] }; } };
  const result = await queryCourtRecords(client, { process_number: "13608/14.8T2SNT", date_from: "2016-01-01" });
  assert.equal(result.items[0].record_identity.bucket_document_id, 40);
  assert.equal(result.items[0].occurrence.reference, "85759502");
  assert.equal(result.items[0].binaries[0].sha256, sha256);
  assert.equal(result.items[0].relationships[2].kind, "represented_by");
  assert.equal(result.items[0].relationships.every((relation) => relation.basis === "source_recorded"), true);
  assert.equal(calls[0].params[6], "13608/14.8T2SNT");
  assert.equal(calls[0].params[12], "2016-01-01");
});

test("court-record results keep missing files without inventing binary identities", async () => {
  const client = { query: async () => ({ rows: [row({ binaries: [] })] }) };
  const result = await queryCourtRecords(client, { file_availability: "missing" });
  assert.deepEqual(result.items[0].binaries, []);
  assert.equal(result.items[0].file_state.status, "missing");
  assert.equal(result.items[0].relationships.some((relation) => relation.target.kind === "binary"), false);
});

test("court-record pagination reports an out-of-range empty page without inventing a total", async () => {
  const client = { query: async () => ({ rows: [] }) };
  const result = await queryCourtRecords(client, { limit: 10, offset: 20 });
  assert.deepEqual(result.pagination, {
    unit: "bucket_document_occurrence_records", limit: 10, offset: 20,
    returned: 0, total_matching: null, has_more: false, next_offset: null,
  });
});
