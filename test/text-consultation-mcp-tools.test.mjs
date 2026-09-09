import assert from "node:assert/strict";
import test from "node:test";

import { compactBinaryDetail, createTextConsultationMcpTools, TEXT_CONSULTATION_MCP_TOOLS } from "../app/text-consultation-mcp-tools.mjs";

const sha256 = "a".repeat(64);

test("publishes the bounded read-only text and court-metadata consultation tools", () => {
  assert.deepEqual(TEXT_CONSULTATION_MCP_TOOLS.map((tool) => tool.name), [
    "hello", "search_document_text", "query_court_records", "get_binary_details", "get_representation_content",
  ]);
});

test("hello verifies the V1 MCP application layer without querying case data", async () => {
  let queried = false;
  const call = createTextConsultationMcpTools({ client: { query: async () => { queried = true; } } });
  assert.deepEqual(await call("hello"), {
    status: "ok",
    message: "Hello from Virgilio Consultation MCP.",
    service: "virgilio-consultation-mcp",
    contract_version: "v1",
    data_access: "none",
  });
  assert.equal(queried, false);
  await assert.rejects(call("hello", { extra: true }), { code: "UNKNOWN_ARGUMENT" });
});

test("binary details omit the local download URL and declare content unavailable through MCP", () => {
  const result = compactBinaryDetail({
    binary: { sha256, original_binary_url: `/binary/${sha256}`, mime_type: "application/pdf" },
    context: {}, representations: {}, evidence: {}, processing: { summary: {} }, attention: {}, provenance: {},
  });
  assert.equal("original_binary_url" in result.binary, false);
  assert.equal(result.binary.sha256, sha256);
  assert.equal(result.semantics.original_binary_content_available_through_this_mcp, false);
});

test("text search defaults to full scope and removes reference-observation payloads", async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{
      sha256, document_representation_id: 4, segment_id: 8,
      representation_kind: "text_interpretation", processor_key: "docling", processor_version: "2",
      segment_kind: "document", sequence_no: 1, page_no: null, char_start: 0, char_end: 20,
      location_kind: "document_level", headline: "a [[match]]", rank: 0.3,
      binary_relevance_rank: 0.3, earliest_occurrence_date: "2020-01-02",
      latest_occurrence_date: "2021-03-04", source_contexts: [{ process_number: "P1" }],
      passage_reference_observations: [{ should_not_leak: true }],
      contextual_reference_observations: [{ should_not_leak: true }],
    }] };
  } };
  const call = createTextConsultationMcpTools({ client, workspaceRoot: "C:/workspace" });
  const result = await call("search_document_text", { query: "match" });
  assert.equal(result.query.scope, "full");
  assert.equal(result.items[0].representation.processor_key, "docling");
  assert.equal(result.items[0].source_contexts[0].process_number, "P1");
  assert.equal("passage_reference_observations" in result.items[0], false);
  assert.equal(calls[0].params[2], null);
});

test("court-record tool delegates validated filters to the shared read model", async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  } };
  const call = createTextConsultationMcpTools({ client, workspaceRoot: "C:/workspace" });
  const result = await call("query_court_records", {
    process_number: "13608/14.8T2SNT", file_availability: "missing", limit: 5,
  });
  assert.equal(result.read_model, "court_occurrence_document_records");
  assert.equal(result.query.process_number, "13608/14.8T2SNT");
  assert.equal(result.query.file_availability, "missing");
  assert.equal(calls.length, 1);
});

test("representation content is Unicode-bounded and retains processor lineage", async () => {
  const representation = {
      id: 7, file_binary_id: 3, representation_kind: "text_interpretation",
      representation_source_kind: "processor", representation_variant_key: "readable",
      processor_key: "xberg", processor_version: "1.2", based_on_representation_id: null,
      produced_by_job_id: 9,
  };
  const client = { query: async (sql) => {
    if (sql.includes("FROM casework.document_representation AS dr")) {
      return { rowCount: 1, rows: [representation] };
    }
    return { rowCount: 1, rows: [{ text_content: "A😀BC", sequence_no: 1 }] };
  } };
  const call = createTextConsultationMcpTools({ client, workspaceRoot: "C:/workspace" });
  const result = await call("get_representation_content", {
    representation_id: 7, format: "text", offset: 1, max_characters: 2,
  });
  assert.equal(result.content, "😀B");
  assert.equal(result.total_characters, 4);
  assert.equal(result.next_offset, 3);
  assert.equal(result.representation.processor_key, "xberg");
});

test("rejects unknown tools, unknown arguments, and oversized responses before querying", async () => {
  let queried = false;
  const call = createTextConsultationMcpTools({ client: { query: async () => { queried = true; } } });
  await assert.rejects(call("search_document_text", { query: "x", extra: true }), { code: "UNKNOWN_ARGUMENT" });
  await assert.rejects(call("get_representation_content", {
    representation_id: 1, format: "text", max_characters: 50001,
  }), { code: "INVALID_ARGUMENT" });
  await assert.rejects(call("unknown", {}), { code: "UNKNOWN_TOOL" });
  assert.equal(queried, false);
});
