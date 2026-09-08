import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createConsultationV1Handler } from "../app/consultation-v1-api.mjs";
import { createMcpV1HttpHandler } from "../app/text-consultation-mcp-v1-http-server.mjs";

async function serve(handler, work) {
  const server = createServer((request, response) => void handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function apiHandler(auth) {
  return createConsultationV1Handler({
    client: { query: async () => ({ rows: [] }) },
    auth,
    workspaceRoot: process.cwd(),
    sitePublicUrl: "https://consultation.example.test",
    gatewayUrl: "http://gateway.invalid",
    internalToken: "x".repeat(32),
    openApi: { openapi: "3.1.0" },
  });
}

test("V1 API exposes versioned health and protects consultation data", async () => {
  const auth = {
    metadata: { issuer: "https://auth.example.test/realms/consultation" },
    beginLogin: async () => "https://auth.example.test/login",
    authenticate: async () => { throw Object.assign(new Error("authentication required"), { code: "UNAUTHORIZED", statusCode: 401 }); },
  };
  await serve(apiHandler(auth), async (base) => {
    const health = await fetch(`${base}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "private, no-store");
    assert.equal((await health.json()).contract_version, "v1");
    const denied = await fetch(`${base}/api/v1/binaries`);
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).error.code, "UNAUTHORIZED");
  });
});

test("V1 BFF routes keep login and session operations in the API version", async () => {
  const auth = {
    metadata: { issuer: "https://auth.example.test/realms/consultation" },
    beginLogin: async (returnTo) => `https://auth.example.test/login?return_to=${encodeURIComponent(returnTo)}`,
    completeLogin: async () => ({ sessionId: "opaque", returnTo: "/binaries" }),
    authenticate: async () => ({ principal: { issuer: "issuer", subject: "subject", roles: [], scopes: [] } }),
    destroy: () => {},
  };
  await serve(apiHandler(auth), async (base) => {
    const login = await fetch(`${base}/api/v1/auth/login?return_to=%2Fbinaries`, { redirect: "manual" });
    assert.equal(login.status, 302);
    assert.match(login.headers.get("location"), /return_to=%2Fbinaries/u);
    const callback = await fetch(`${base}/api/v1/auth/callback?code=x&state=y`, { redirect: "manual" });
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("set-cookie"), /__Host-consultation_v1=opaque/u);
    const session = await fetch(`${base}/api/v1/auth/session`);
    assert.equal(session.status, 200);
    assert.equal((await session.json()).principal.subject, "subject");
  });
});

test("MCP V1 publishes protected-resource metadata and challenges unauthenticated calls", async () => {
  const handler = createMcpV1HttpHandler({
    callTool: async () => ({}),
    auth: { authenticate: async () => { throw Object.assign(new Error("valid bearer token required"), { code: "UNAUTHORIZED", statusCode: 401 }); } },
    publicUrl: "https://mcp.example.test/mcp/v1",
    issuer: "https://auth.example.test/realms/consultation",
  });
  await serve(handler, async (base) => {
    const metadata = await fetch(`${base}/.well-known/oauth-protected-resource/mcp/v1`, { headers: { Host: "mcp.example.test" } });
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).resource, "https://mcp.example.test/mcp/v1");
    const denied = await fetch(`${base}/mcp/v1`, { method: "POST", headers: { Host: "mcp.example.test", "Content-Type": "application/json" }, body: "{}" });
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get("www-authenticate"), /oauth-protected-resource\/mcp\/v1/u);
  });
});
