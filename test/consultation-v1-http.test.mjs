import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createConsultationV1Handler, materializeOpenApi, versionBinaryUrls } from "../app/consultation-v1-api.mjs";
import { createMcpV1HttpHandler } from "../app/text-consultation-mcp-v1-http-server.mjs";

test("V1 URL conversion preserves nested database timestamps in JSON responses", () => {
  const created = new Date("2026-09-08T12:34:56.000Z");
  const hash = "a".repeat(64);
  const input = { items: [{ created_at: created, original_binary_url: `/binary/${hash}`, absent: null }] };
  assert.deepEqual(JSON.parse(JSON.stringify(versionBinaryUrls(input))), {
    items: [{ created_at: created.toISOString(), original_binary_url: `/api/v1/binaries/${hash}/content`, absent: null }],
  });
  assert.equal(input.items[0].created_at, created);
});

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

test("V1 login admission failures return 429 with Retry-After", async () => {
  const auth = {
    metadata: { issuer: "https://auth.example.test/realms/consultation" },
    beginLogin: async () => {
      throw Object.assign(new Error("too many login requests"), {
        code: "LOGIN_RATE_LIMITED", statusCode: 429, retryAfterSeconds: 37,
      });
    },
  };
  await serve(apiHandler(auth), async (base) => {
    const response = await fetch(`${base}/api/v1/auth/login`, { redirect: "manual" });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "37");
    assert.equal((await response.json()).error.code, "LOGIN_RATE_LIMITED");
  });
});

test("V1 callback accepts provider error fields without reflecting their contents", async () => {
  let received;
  const auth = {
    metadata: { issuer: "https://auth.example.test/realms/consultation" },
    completeLogin: async (parameters) => {
      received = parameters;
      throw Object.assign(new Error("identity provider did not complete login; start a new login"), { code: "LOGIN_FAILED", statusCode: 401 });
    },
  };
  await serve(apiHandler(auth), async (base) => {
    const response = await fetch(`${base}/api/v1/auth/callback?state=state&error=access_denied&error_description=private-detail&error_uri=https%3A%2F%2Fexample.invalid`, { redirect: "manual" });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error.code, "LOGIN_FAILED");
    assert.doesNotMatch(JSON.stringify(body), /private-detail|example.invalid/u);
    assert.deepEqual(received, { code: null, state: "state", error: "access_denied" });
    assert.equal(response.headers.get("set-cookie"), null);
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

test("V1 OpenAPI discovery uses configured public and identity-provider URLs", () => {
  const template = {
    servers: [{ url: "https://consultation.example.invalid" }],
    components: { securitySchemes: { oauth2: { flows: { authorizationCode: {
      authorizationUrl: "https://auth.example.invalid/auth",
      tokenUrl: "https://auth.example.invalid/token",
    } } } } },
  };
  const result = materializeOpenApi(template, {
    apiPublicUrl: "https://api.example.test/",
    oidcMetadata: {
      authorization_endpoint: "https://identity.example.test/realms/consultation/auth",
      token_endpoint: "https://identity.example.test/realms/consultation/token",
    },
  });
  assert.equal(result.servers[0].url, "https://api.example.test");
  assert.equal(result.components.securitySchemes.oauth2.flows.authorizationCode.authorizationUrl, "https://identity.example.test/realms/consultation/auth");
  assert.equal(template.servers[0].url, "https://consultation.example.invalid");
});
