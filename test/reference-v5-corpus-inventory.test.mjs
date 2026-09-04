import assert from "node:assert/strict";
import test from "node:test";
import { buildCorpusInventory, buildEligibilityEvidence, classifyRepresentations, extractInventoryPredictions, planCorpusLifecycle } from "../app/reference-v5-corpus-inventory.mjs";

const segment = (overrides = {}) => ({ representation_id: 1, file_binary_id: 2, processor_key: "docling", processor_version: "2.123.1-c5.2", document_segment_id: 3, sequence_no: 0, text_content: "DOC Nº12", ...overrides });

test("eligibility uses only the exact allowlist and nonempty segment rule", () => {
  const result = classifyRepresentations([segment(), segment({ representation_id: 2, document_segment_id: 4, processor_version: "test", text_content: "DOC 1" }), segment({ representation_id: 3, document_segment_id: 5, text_content: "" })]);
  assert.equal(result.eligible.length, 1);
  assert.deepEqual(result.exclusions.map((row) => row.reason_code), ["PROCESSOR_IDENTITY_NOT_ALLOWLISTED", "NO_NONEMPTY_STORED_SEGMENT"]);
});

test("corpus prediction retains exact segment and extractor provenance", () => {
  const eligible = classifyRepresentations([segment()]).eligible;
  const rows = extractInventoryPredictions(eligible);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].raw_value, "DOC Nº12");
  assert.equal(rows[0].char_start, 0);
  assert.equal(rows[0].char_end, 8);
  assert.ok(rows[0].observation_key);
  assert.ok(rows[0].representation_content_sha256);
  assert.ok(rows[0].segment_content_sha256);
  assert.equal(rows[0].label_provenance.representation_label_char_start, 0);
  assert.equal(rows[0].label_provenance.representation_label_char_end, 6);
});

test("fixture overlap remains fixture-owned and corpus retirement is ownership-limited", () => {
  const item = extractInventoryPredictions(classifyRepresentations([segment()]).eligible)[0];
  const storedLabel = Object.fromEntries(Object.entries(item.label_provenance).filter(([key]) => !key.startsWith("representation_label_")));
  const metadata = { observation_identity_version: "reference-text-observation-identity-v1", normalization_identity: "reference-normalization-nfkc-upper-v1", representation_content_sha256: item.representation_content_sha256, segment_content_sha256: item.segment_content_sha256, representation_char_start: item.representation_char_start, representation_char_end: item.representation_char_end, segment_char_start: item.char_start, segment_char_end: item.char_end, extractor_rule_key: item.rule_key, reference_family: item.reference_family, parsed_candidate: item.parsed_candidate, label_provenance: storedLabel, target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved" };
  const fixture = { id: 7, ...item, observed_in_kind: "segment", observer_version: "labelled-reference-v5", namespace_hint: null, target_candidates_json: [], confidence: "high", lifecycle_state: "current", metadata_json: { ...metadata, fixture_scope: "frozen-v5-expansion-and-foundation" } };
  const corpusAbsent = { id: 8, ...item, observer_version: "labelled-reference-v5", observation_key: "absent", lifecycle_state: "current", metadata_json: { ...metadata, corpus_rollout_scope: "labelled-reference-v5-corpus-rollout-v1" } };
  const plan = planCorpusLifecycle([item], [fixture, corpusAbsent], buildEligibilityEvidence(classifyRepresentations([segment()]).eligible));
  assert.deepEqual(plan.preexisting_fixture_covered, [item.observation_key]);
  assert.equal(plan.retire_source_absent.length, 1);
  assert.equal(plan.insert.length, 0);
});

test("altered or noncurrent fixture overlap blocks rather than changing ownership", () => {
  const item = extractInventoryPredictions(classifyRepresentations([segment()]).eligible)[0];
  const storedLabel = Object.fromEntries(Object.entries(item.label_provenance).filter(([key]) => !key.startsWith("representation_label_")));
  const base = { id: 7, ...item, observed_in_kind: "segment", observer_version: "labelled-reference-v5", namespace_hint: null, target_candidates_json: [], confidence: "high", lifecycle_state: "current", metadata_json: { observation_identity_version: "reference-text-observation-identity-v1", normalization_identity: "reference-normalization-nfkc-upper-v1", representation_content_sha256: item.representation_content_sha256, segment_content_sha256: item.segment_content_sha256, representation_char_start: item.representation_char_start, representation_char_end: item.representation_char_end, segment_char_start: item.char_start, segment_char_end: item.char_end, extractor_rule_key: item.rule_key, reference_family: item.reference_family, parsed_candidate: item.parsed_candidate, label_provenance: storedLabel, target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved", fixture_scope: "frozen-v5-expansion-and-foundation" } };
  assert.equal(planCorpusLifecycle([item], [{ ...base, raw_value: "changed" }]).blocked[0].reason_code, "FIXTURE_PROVENANCE_MISMATCH");
  assert.equal(planCorpusLifecycle([item], [{ ...base, role_hint: "changed" }]).blocked[0].reason_code, "FIXTURE_PROVENANCE_MISMATCH");
  assert.equal(planCorpusLifecycle([item], [{ ...base, metadata_json: { ...base.metadata_json, parsed_candidate: { changed: 1 } } }]).blocked[0].reason_code, "FIXTURE_PROVENANCE_MISMATCH");
  assert.equal(planCorpusLifecycle([item], [{ ...base, metadata_json: { ...base.metadata_json, label_provenance: { ...storedLabel, coordination_cue: "changed" } } }]).blocked[0].reason_code, "FIXTURE_PROVENANCE_MISMATCH");
  assert.equal(planCorpusLifecycle([item], [{ ...base, lifecycle_state: "superseded" }]).blocked[0].reason_code, "FIXTURE_OBSERVATION_NOT_CURRENT");
});

test("reactivation is limited to this corpus ownership", () => {
  const item = extractInventoryPredictions(classifyRepresentations([segment()]).eligible)[0];
  const foreign = { id: 9, ...item, observer_version: "labelled-reference-v5", lifecycle_state: "superseded", metadata_json: {} };
  assert.equal(planCorpusLifecycle([item], [foreign]).blocked[0].reason_code, "EXACT_KEY_FOREIGN_OR_UNOWNED");
});

test("source-absent retirement requires eligible hash-matched recomputation", () => {
  const item = extractInventoryPredictions(classifyRepresentations([segment()]).eligible)[0];
  const row = { id: 8, ...item, observer_version: "labelled-reference-v5", observation_key: "absent", lifecycle_state: "current", metadata_json: { corpus_rollout_scope: "labelled-reference-v5-corpus-rollout-v1", representation_content_sha256: item.representation_content_sha256, segment_content_sha256: item.segment_content_sha256 } };
  assert.equal(planCorpusLifecycle([], [row]).retained_excluded_or_unverified.length, 1);
  const drift = buildEligibilityEvidence(classifyRepresentations([segment({ text_content: "DOC Nº13" })]).eligible);
  assert.equal(planCorpusLifecycle([], [row], drift).blocked[0].reason_code, "SOURCE_HASH_DRIFT");
  const evidence = buildEligibilityEvidence(classifyRepresentations([segment()]).eligible);
  assert.equal(planCorpusLifecycle([], [row], evidence).retire_source_absent.length, 1);
});

test("ambiguous current predecessors block the projected plan", () => {
  const item = extractInventoryPredictions(classifyRepresentations([segment()]).eligible)[0];
  const old = (id) => ({ id, ...item, observation_key: `old-${id}`, observer_version: "labelled-reference-v4", lifecycle_state: "current", metadata_json: {} });
  const plan = planCorpusLifecycle([item], [old(1), old(2)]);
  assert.equal(plan.blocked[0].reason_code, "AMBIGUOUS_CURRENT_PREDECESSOR");
  assert.equal(plan.insert.length, 0);
});

test("inventory transaction is read-only and calls no mutation or sequence SQL", async () => {
  const calls = [];
  const client = { query: async (sql) => {
    const text = String(sql).trim(); calls.push(text);
    if (text.startsWith("SELECT transaction_timestamp")) return { rows: [{ value: "2026-09-04T00:00:00.000Z" }] };
    return { rows: [] };
  } };
  const result = await buildCorpusInventory(client);
  assert.equal(result.read_only_guarantee.mutation_statements_issued, false);
  assert.equal(result.read_only_guarantee.sequence_functions_called, false);
  assert.equal(calls[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.ok(calls.slice(1, -1).every((sql) => sql.startsWith("SELECT")));
  assert.ok(calls.every((sql) => !/nextval|setval|insert|update|delete|create\s+temp/iu.test(sql)));
});
