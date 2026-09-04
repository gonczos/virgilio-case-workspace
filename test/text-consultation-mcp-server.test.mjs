import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createTextConsultationMcpServer } from "../app/text-consultation-mcp-server.mjs";

async function connectedPair(callTool, operationalLogger = null) {
  const server = createTextConsultationMcpServer({ callTool, operationalLogger });
  const client = new Client({ name: "mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("MCP initialize and tools/list expose the implemented MVP tools", async (context) => {
  const pair = await connectedPair(async () => ({}));
  context.after(async () => { await pair.client.close(); await pair.server.close(); });
  const response = await pair.client.listTools();
  assert.deepEqual(response.tools.map((tool) => tool.name), [
    "search_document_text", "query_court_records", "get_binary_details", "get_representation_content",
  ]);
  assert.ok(response.tools.every((tool) => tool.annotations?.readOnlyHint === true));
});

test("tools/call delegates validated arguments and returns JSON text", async (context) => {
  const calls = [];
  const pair = await connectedPair(async (name, args) => {
    calls.push({ name, args });
    return { ok: true, scope: args.scope };
  });
  context.after(async () => { await pair.client.close(); await pair.server.close(); });
  const response = await pair.client.callTool({
    name: "search_document_text",
    arguments: { query: "despacho" },
  });
  assert.equal(response.isError, false);
  assert.deepEqual(JSON.parse(response.content[0].text), { ok: true, scope: "full" });
  assert.deepEqual(calls, [{
    name: "search_document_text",
    args: { query: "despacho", scope: "full", order: "relevance", limit: 10, offset: 0 },
  }]);
});

test("invalid protocol input is rejected without calling the application layer", async (context) => {
  let called = false;
  const pair = await connectedPair(async () => { called = true; });
  context.after(async () => { await pair.client.close(); await pair.server.close(); });
  const response = await pair.client.callTool({
    name: "get_representation_content",
    arguments: { representation_id: 1, format: "text", max_characters: 50001 },
  });
  assert.equal(response.isError, true);
  assert.equal(called, false);
});

test("application errors are sanitized into MCP tool errors", async (context) => {
  const events = [];
  const operationalLogger = { error: (event, fields) => events.push({ event, fields }), info: () => {} };
  const pair = await connectedPair(async () => { throw new Error("C:/secret/path"); }, operationalLogger);
  context.after(async () => { await pair.client.close(); await pair.server.close(); });
  const response = await pair.client.callTool({
    name: "get_binary_details",
    arguments: { sha256: "a".repeat(64) },
  });
  assert.equal(response.isError, true);
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.error.code, "CONSULTATION_READ_FAILED");
  assert.doesNotMatch(payload.error.message, /secret/u);
  assert.equal(events[0].event, "tool_call_completed");
  assert.equal(events[0].fields.tool_name, "get_binary_details");
  assert.equal(events[0].fields.status, "error");
  assert.doesNotMatch(events[0].fields.error_message, /C:\/secret/u);
});
