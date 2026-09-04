import assert from "node:assert/strict";
import test from "node:test";
import { selectPredictionAuditSample, verifyAuthorizedInventory } from "../app/build-reference-v5-corpus-audit-sample.mjs";

const rows = Array.from({ length: 240 }, (_, index) => ({ observation_key: `key-${String(index).padStart(3, "0")}`, processor_key: ["docling", "pdf_literal_text", "xberg"][index % 3], processor_version: "v", reference_family: ["local_attachment", "physical_folio", "unclassified"][index % 3], rule_key: `rule-${index % 8}`, document_representation_id: index % 25, file_binary_id: index % 40 }));

test("audit selection is deterministic, capped, and retains overlapping strata", () => {
  const fixture = new Set(rows.slice(0, 30).map((row) => row.observation_key));
  const reused = new Set(Array.from({ length: 20 }, (_, index) => index));
  const first = selectPredictionAuditSample(rows, fixture, reused, 180);
  const second = selectPredictionAuditSample([...rows].reverse(), fixture, reused, 180);
  assert.equal(first.length, 180);
  assert.deepEqual(first, second);
  assert.ok(first.some((row) => row.selection_strata.length > 1));
  assert.ok(first.every((row) => new Set(row.selection_strata).size === row.selection_strata.length));
  assert.deepEqual([...new Set(first.map((row) => row.rule_key))].sort(), [...new Set(rows.map((row) => row.rule_key))].sort());
});

test("audit builder rejects a tampered authorized inventory", () => {
  assert.throws(() => verifyAuthorizedInventory(Buffer.from('{"deterministic_payload_sha256":"9803e4fce557c815754f408a28f523653960eb783c63674d0c5860ed5abe94c0"}')), /AUTHORIZED_INVENTORY_FILE_SHA256_MISMATCH/u);
});
