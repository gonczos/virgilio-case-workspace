import assert from "node:assert/strict";
import test from "node:test";
import { buildReferenceNeighbourhoodGraph, parseReferenceGraphOptions } from "../app/reference-graph-api.mjs";

const context = { document_id: 12, bucket_id: 4, process_number: "P1",
  occurrence_reference: "105398957", occurrence_date: "2017-03-01",
  document_reference: "DOC-12", file_availability: "available",
  binary_sha256s: ["a".repeat(64)] };
const observation = (key, origin, anchor, contexts = [context]) => ({
  observation_key: key, reference: { raw_value: "105398957" }, origin,
  lifecycle: { state: "current" }, direct_anchor: anchor,
  associated_contexts: contexts, provenance: {}, human_review: null,
});
const lookup = {
  query: { raw_value: "105398957", normalized_value: "105398957", scope: "pilot", lifecycle: "current" },
  coverage: { status: "complete_for_declared_sources" },
  observations: [
    observation("occ", "court_metadata", { kind: "occurrence", bucket_id: 4,
      occurrence_reference: "105398957", occurrence_date: "2017-03-01" }),
    observation("citation", "document_text", { kind: "document_text",
      document_representation_id: 8, processor_key: "literal-pdf-text", char_start: 20, char_end: 29 }),
  ],
};

test("reference graph keeps observations and anchors distinct", () => {
  const graph = buildReferenceNeighbourhoodGraph(lookup);
  assert.ok(graph.nodes.some((node) => node.id === "reference:105398957"));
  assert.ok(graph.nodes.some((node) => node.id === "observation:occ"));
  assert.ok(graph.nodes.some((node) => node.id === "observation:citation"));
  assert.ok(graph.nodes.some((node) => node.id === "representation:8"));
  assert.equal(graph.edges.every((edge) => ["observed", "source_recorded"].includes(edge.basis)), true);
  assert.equal(graph.edges.some((edge) => /target|resolved/u.test(edge.kind)), false);
});

test("reference graph deduplicates binaries while retaining occurrence contexts", () => {
  const graph = buildReferenceNeighbourhoodGraph(lookup);
  assert.equal(graph.nodes.filter((node) => node.kind === "binary").length, 1);
  assert.ok(graph.nodes.some((node) => node.id === "occurrence:4"));
  assert.equal(graph.fixture.truncated, false);
  const distances = new Map([["reference:105398957", 0]]);
  for (let depth = 0; depth < 2; depth += 1) {
    for (const edge of graph.edges) {
      if (distances.get(edge.source) === depth && !distances.has(edge.target)) distances.set(edge.target, depth + 1);
    }
  }
  assert.equal(graph.nodes.every((node) => distances.has(node.id)), true);
});

test("missing contexts do not gain binary nodes or open actions", () => {
  const missing = structuredClone(lookup);
  missing.observations = [observation("missing", "court_metadata", { kind: "document", document_id: 22 }, [{
    ...context, document_id: 22, file_availability: "missing", binary_sha256s: [],
  }])];
  const graph = buildReferenceNeighbourhoodGraph(missing);
  assert.equal(graph.nodes.some((node) => node.kind === "binary"), false);
  assert.equal(graph.nodes.some((node) => node.open_action), false);
});

test("reference graph output ordering is deterministic", () => {
  assert.deepEqual(buildReferenceNeighbourhoodGraph(lookup), buildReferenceNeighbourhoodGraph(lookup));
});

test("graph request options are frozen to pilot current and reject unknown parameters", () => {
  assert.deepEqual(parseReferenceGraphOptions(new URLSearchParams()), { scope: "pilot", lifecycle: "current" });
  assert.equal(parseReferenceGraphOptions(new URLSearchParams("scope=full")).error[0], "INVALID_GRAPH_SCOPE");
  assert.equal(parseReferenceGraphOptions(new URLSearchParams("lifecycle=include_history")).error[0], "INVALID_GRAPH_LIFECYCLE");
  assert.equal(parseReferenceGraphOptions(new URLSearchParams("depth=3")).error[0], "UNKNOWN_QUERY_PARAMETER");
  assert.equal(parseReferenceGraphOptions(new URLSearchParams("scope=pilot&scope=pilot")).error[0], "DUPLICATE_QUERY_PARAMETER");
});
