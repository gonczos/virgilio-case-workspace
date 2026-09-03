import assert from "node:assert/strict";
import test from "node:test";

import {
  buildObservationKey,
  extractLabelledReferences,
  lookupReference,
  normalizeReferenceValue,
  searchPassages,
} from "../app/reference-search-store.mjs";

test("normalizes reference values without discarding punctuation", () => {
  assert.equal(normalizeReferenceValue("  re 140653198pt "), "RE 140653198PT");
  assert.equal(normalizeReferenceValue("13608/14.8T2SNT-A.L1"), "13608/14.8T2SNT-A.L1");
});

test("extracts labelled self and cited references with locations", () => {
  const text = "REFª: 33348144. Em cumprimento do despacho sob a ref. 105398957, prossiga.";
  const rows = extractLabelledReferences(text);
  assert.deepEqual(rows.map((row) => [row.raw_value, row.role_hint]), [
    ["33348144", "labelled_reference"],
    ["105398957", "cited_reference"],
  ]);
  assert.equal(text.slice(rows[0].char_start, rows[0].char_end), "33348144");
  assert.match(rows[1].context_text, /despacho/u);
});

test("does not treat unlabelled numbers as references", () => {
  assert.deepEqual(extractLabelledReferences("Processo 13608/14.8T2SNT em 10-09-2019"), []);
  assert.deepEqual(extractLabelledReferences("o documento referido pela parte"), []);
});

test("recognizes an accented Citius reference label", () => {
  assert.deepEqual(
    extractLabelledReferences("REFERÊNCIA CITIUS N.º 12345678").map((row) => row.raw_value),
    ["12345678"],
  );
});

test("observation keys are stable and distinguish observation locations", () => {
  const base = {
    raw_value: "33348144",
    raw_label: "REFª",
    observed_in_kind: "segment",
    document_segment_id: 7,
    char_start: 10,
    char_end: 18,
    observer_key: "test",
    observer_version: "v1",
  };
  assert.equal(buildObservationKey(base), buildObservationKey({ ...base }));
  assert.notEqual(buildObservationKey(base), buildObservationKey({ ...base, char_start: 11 }));
});

test("pilot fixture remains below its hard binary ceiling", async () => {
  const fixture = JSON.parse(await (await import("node:fs/promises")).readFile(
    new URL("./fixtures/reference-index-pilot.json", import.meta.url), "utf8",
  ));
  const distinct = new Set(fixture.selection.map((row) => row.sha256));
  assert.ok(distinct.size <= fixture.maximum_distinct_binaries);
  assert.equal(distinct.size, 15);
});

test("exact lookup normalizes the value without guessing a namespace", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  await lookupReference(client, "  ref-123 ");
  assert.deepEqual(calls[0].params, ["REF-123"]);
  assert.match(calls[0].sql, /ro\.normalized_value = \$1/u);
});

test("pilot search keeps its SHA boundary and caps its result limit", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  await searchPassages(client, "despacho", { limit: 900, sha256s: ["abc", "def"] });
  assert.deepEqual(calls[0].params, ["despacho", 100, ["abc", "def"]]);
  assert.match(calls[0].sql, /ds\.search_vector @@/u);
  assert.match(calls[0].sql, /fb\.sha256 = ANY\(\$3::text\[\]\)/u);
});
