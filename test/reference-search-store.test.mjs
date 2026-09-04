import assert from "node:assert/strict";
import test from "node:test";

import {
  buildObservationKey,
  extractLabelledReferences,
  lookupReference,
  normalizeReferenceValue,
  searchPassages,
  upsertReferenceReview,
} from "../app/reference-search-store.mjs";
import { searchReferencePilot } from "../app/reference-index-pilot.mjs";

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
  for (const row of rows) {
    assert.equal(
      text.slice(row.label_provenance.label_char_start, row.label_provenance.label_char_end),
      row.raw_label,
    );
  }
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
  assert.deepEqual(calls[0].params, ["REF-123", null]);
  assert.match(calls[0].sql, /ro\.normalized_value = \$1/u);
  assert.match(calls[0].sql, /reference_observation_review/u);
  assert.match(calls[0].sql, /AS review/u);
});

test("pilot search keeps its SHA boundary and caps its binary-page limit", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  await searchPassages(client, "despacho", { limit: 900, sha256s: ["abc", "def"] });
  assert.deepEqual(calls[0].params, ["despacho", 100, ["abc", "def"], 0, "relevance"]);
  assert.match(calls[0].sql, /ds\.search_vector @@/u);
  assert.match(calls[0].sql, /fb\.sha256 = ANY\(\$3::text\[\]\)/u);
  assert.match(calls[0].sql, /passage_reference_observations/u);
  assert.match(calls[0].sql, /contextual_reference_observations/u);
  assert.match(calls[0].sql, /source_processor_key/u);
  assert.match(calls[0].sql, /observer_version/u);
});

test("full-corpus text search removes the fixture SHA filter and reports a binary cap", async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return {
        rows: Array.from({ length: 3 }, (_value, index) => ({
          sha256: String.fromCharCode(97 + index).repeat(64),
          page_no: null,
          location_kind: "document_level",
          passage_reference_observations: [],
          contextual_reference_observations: [],
        })),
      };
    },
  };

  const result = await searchReferencePilot(client, "despacho", { limit: 2, scope: "full" });
  assert.deepEqual(calls[0].params, ["despacho", 3, null, 0, "relevance"]);
  assert.deepEqual(result.query, {
    text: "despacho", limit: 2, offset: 0, scope: "full", sort: "relevance",
  });
  assert.deepEqual(result.result_summary, {
    requested_offset: 0,
    pagination_unit: "binary",
    binary_limit: 2,
    returned_passage_count: 2,
    distinct_binary_count: 2,
    capped: true,
    has_more: true,
    next_offset: 2,
  });
});

test("text search advances its server offset by returned binaries", async () => {
  const calls = [];
  const client = {
    query: async (_sql, params) => {
      calls.push(params);
      return { rows: [{
        sha256: "a".repeat(64),
        page_no: null,
        location_kind: "document_level",
        passage_reference_observations: [],
        contextual_reference_observations: [],
      }] };
    },
  };
  const result = await searchReferencePilot(client, "term", { limit: 2, offset: 50, scope: "full" });
  assert.deepEqual(calls[0], ["term", 3, null, 50, "relevance"]);
  assert.equal(result.result_summary.requested_offset, 50);
  assert.equal(result.result_summary.returned_passage_count, 1);
  assert.equal(result.result_summary.next_offset, 51);
  assert.equal(result.result_summary.has_more, false);
});

test("chronological binary ordering is applied before pagination with null dates last", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  await searchPassages(client, "term", {
    limit: 20,
    offset: 40,
    sort: "earliest_occurrence_asc",
  });
  assert.deepEqual(calls[0].params, ["term", 20, null, 40, "earliest_occurrence_asc"]);
  assert.match(calls[0].sql, /MIN\(b\.bucket_date\) AS earliest_occurrence_date/u);
  assert.match(calls[0].sql, /earliest_occurrence_date END ASC NULLS LAST/u);
  assert.match(calls[0].sql, /selected_binaries/u);
});

test("human review is written through a separate review-owned upsert", async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ reference_observation_id: params[0] }] };
    },
  };
  await upsertReferenceReview(client, {
    reference_observation_id: 42,
    namespace_hint: "citius_occurrence_reference",
    target_candidates: [{ kind: "occurrence", bucket_document_id: 7 }],
    resolution_state: "resolved",
    confidence: "high",
    review_state: "reviewed",
    review_note: "Checked against the source record",
    reviewer_key: "test-reviewer",
  });
  assert.match(calls[0].sql, /INSERT INTO casework\.reference_observation_review/u);
  assert.match(calls[0].sql, /ON CONFLICT \(reference_observation_id\)/u);
  assert.deepEqual(calls[0].params.slice(0, 2), [42, "citius_occurrence_reference"]);
  assert.equal(calls[0].params[4], "resolved");
});

test("extracts coordinated procedural continuation with inherited-label provenance", () => {
  const text = "referência citius: 122170551 e 122178618 respectivamente";
  const rows = extractLabelledReferences(text);
  assert.deepEqual(rows.map((row) => row.raw_value), ["122170551", "122178618"]);
  assert.equal(rows[0].label_provenance.kind, "direct");
  assert.equal(rows[1].rule_key, "procedural-coordination-respectivamente-v1");
  assert.deepEqual(rows[1].label_provenance, {
    kind: "inherited_from_coordinated_expression",
    source_label: "referência citius",
    label_char_start: 0,
    label_char_end: 17,
    coordination_cue: "respectivamente",
    preceding_value: "122170551",
  });
  assert.equal(text.slice(rows[1].char_start, rows[1].char_end), "122178618");
});

test("extracts atomic coordinated attachments without repairing raw text", () => {
  const text = "com os Doc nº Doc 25 e 25 A tradução";
  const rows = extractLabelledReferences(text);
  assert.deepEqual(rows.map((row) => row.raw_value), ["Doc nº Doc 25", "25 A"]);
  assert.deepEqual(rows.map((row) => row.parsed_reference_value), ["25", "25A"]);
  assert.equal(rows[0].rule_key, "local-attachment-duplicated-doc-v1");
  assert.equal(rows[0].transcription_status, "possible_duplicated_label_anomaly");
  assert.equal(rows[1].rule_key, "local-attachment-coordination-v1");
  assert.equal(rows[1].label_provenance.kind, "inherited_from_coordinated_expression");
  assert.equal(text.slice(rows[0].char_start, rows[0].char_end), "Doc nº Doc 25");
  assert.equal(text.slice(rows[1].char_start, rows[1].char_end), "25 A");
});

test("narrow coordination and attachment rules do not recognize dates", () => {
  const dates = "26.10.2015 22/05/2017 15 /07/2017 4.04.2018 21/12/ 2018 21/07/ 2020 15-072020 10.9.2018 8.8.2018 22.03.2021 29.01.2020 10.02.2020";
  assert.deepEqual(extractLabelledReferences(dates), []);
});

test("v5 extracts only the reviewed structured folio, attachment, and register forms", () => {
  const text = "fls.1 a fls 308; Anexo nº 13 - DOC Nº12; DOCNº19; Registo: 702380056723040; Registo n.° 1684/2020";
  const rows = extractLabelledReferences(text);
  assert.deepEqual(rows.map((row) => [row.raw_value, row.rule_key]), [
    ["fls.1", "physical-folio-fls-v1"],
    ["fls 308", "physical-folio-fls-v1"],
    ["Anexo nº 13", "local-attachment-anexo-v1"],
    ["DOC Nº12", "local-attachment-doc-v1"],
    ["DOCNº19", "local-attachment-doc-v1"],
    ["Registo: 702380056723040", "external-register-colon-v1"],
    ["Registo n.° 1684/2020", "external-register-numbered-v1"],
  ]);
  for (const row of rows) assert.equal(text.slice(row.char_start, row.char_end), row.raw_value);
  assert.ok(rows.every((row) => row.label_provenance.kind === "direct"));
});

test("v5 narrowly inherits the damaged French piece label", () => {
  const text = "Nmr P.V. 01663 1 Année 2020 Nmr piéce · 4 Nº feuillet 1 / 1";
  const rows = extractLabelledReferences(text);
  assert.deepEqual(rows.map((row) => row.raw_value), ["4"]);
  assert.equal(rows[0].rule_key, "local-attachment-french-damaged-piece-v1");
  assert.equal(rows[0].parsed_attachment_number, "4");
  assert.equal(rows[0].label_provenance.kind, "inherited_from_damaged_table_label");
});

test("v5 structured rules preserve protected negatives", () => {
  const protectedText = "1 folha 1 folh 2/129 Nº feuillet 1 / 1 2020 69.* Esq.* 4.3ng/mL ponto III. deste requerimento; DOC N 12; Anexo n 13; DOC 14; Anexo 15";
  assert.deepEqual(extractLabelledReferences(protectedText), []);
});
