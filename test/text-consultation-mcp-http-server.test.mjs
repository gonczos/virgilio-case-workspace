import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { createTextConsultationMcpHttpHandler } from "../app/text-consultation-mcp-http-server.mjs";

const TOKEN = "test-token-that-is-at-least-thirty-two-characters";

async function startTestServer(callTool = async () => ({ ok: true }), operationalLogger = null) {
  const handler = createTextConsultationMcpHttpHandler({ callTool, token: TOKEN, operationalLogger });
  const server = createServer((request, response) => { void handler(request, response); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("HTTP MCP requires a bearer token", async (context) => {
  const events = [];
  const logger = { warn: (event, fields) => events.push({ event, fields }), info: () => {}, error: () => {} };
  const server = await startTestServer(async () => ({}), logger);
  context.after(server.close);
  const response = await fetch(`${server.baseUrl}/mcp`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), "Bearer");
  assert.deepEqual(events, [{
    event: "http_request_rejected",
    fields: { method: "POST", route: "/mcp", status_code: 401, error_code: "UNAUTHORIZED" },
  }]);
});

test("HTTP MCP refuses a short configured token", () => {
  assert.throws(
    () => createTextConsultationMcpHttpHandler({ callTool: async () => ({}), token: "too-short" }),
    /at least 32 characters/u,
  );
});

test("HTTP MCP enforces its private loopback binding boundary", () => {
  assert.throws(
    () => createTextConsultationMcpHttpHandler({ callTool: async () => ({}), token: TOKEN, bindHost: "0.0.0.0" }),
    /loopback host/u,
  );
});

test("HTTP MCP rejects unlisted Host headers", async (context) => {
  const server = await startTestServer();
  context.after(server.close);
  const statusCode = await new Promise((resolve, reject) => {
    const target = new URL(`${server.baseUrl}/mcp`);
    const request = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Host: "attacker.example" },
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
    });
    request.once("error", reject);
    request.end("{}");
  });
  assert.equal(statusCode, 403);
});

test("HTTP MCP rejects malformed Host headers safely", async (context) => {
  const server = await startTestServer();
  context.after(server.close);
  const statusCode = await new Promise((resolve, reject) => {
    const target = new URL(`${server.baseUrl}/mcp`);
    const request = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, Host: "[" } }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
    });
    request.once("error", reject);
    request.end("{}");
  });
  assert.equal(statusCode, 403);
});

test("HTTP MCP protects its health route with the same bearer token", async (context) => {
  const server = await startTestServer();
  context.after(server.close);
  assert.equal((await fetch(`${server.baseUrl}/health`)).status, 401);
  assert.equal((await fetch(`${server.baseUrl}/health`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 200);
});

test("HTTP MCP rejects oversized request bodies before protocol dispatch", async (context) => {
  const server = await startTestServer();
  context.after(server.close);
  const response = await fetch(`${server.baseUrl}/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(256 * 1024) }),
  });
  assert.equal(response.status, 413);
});

test("HTTP MCP connects and exposes the implemented MVP tools", async (context) => {
  const server = await startTestServer();
  const client = new Client({ name: "http-mcp-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  });
  context.after(async () => { await client.close(); await server.close(); });
  await client.connect(transport);
  const result = await client.listTools();
  assert.deepEqual(result.tools.map((tool) => tool.name), [
    "search_document_text", "query_court_records", "get_binary_details", "get_representation_content",
  ]);
});

test("HTTP MCP dispatches tool calls through the shared read-only application layer", async (context) => {
  const calls = [];
  const server = await startTestServer(async (name, args) => { calls.push({ name, args }); return { ok: true }; });
  const client = new Client({ name: "http-mcp-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  });
  context.after(async () => { await client.close(); await server.close(); });
  await client.connect(transport);
  const result = await client.callTool({ name: "search_document_text", arguments: { query: "despacho" } });
  assert.equal(result.isError, false);
  assert.deepEqual(calls, [{ name: "search_document_text", args: { query: "despacho", scope: "full", order: "relevance", limit: 10, offset: 0 } }]);
});
