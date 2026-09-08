import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { bearerChallenge, createTokenValidator, oauthProtectedResourceMetadata, sessionCookie } from "../app/auth-v1.mjs";

async function withJwks(work) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test", alg: "RS256", use: "sig" };
  const server = createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await work({ privateKey, jwksUri: `http://127.0.0.1:${server.address().port}/jwks` });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function token(privateKey, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    scope: "openid consultation.read",
    realm_access: { roles: ["consultation_user"] },
    ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer("https://auth.example.test/realms/consultation")
    .setAudience("consultation-api")
    .setSubject("user-1")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

test("V1 token validation enforces issuer, audience, scope, role, and five-minute lifetime", async () => {
  await withJwks(async ({ privateKey, jwksUri }) => {
    const validate = createTokenValidator({
      issuer: "https://auth.example.test/realms/consultation",
      audience: "consultation-api",
      jwksUri,
    });
    const accepted = await validate(await token(privateKey));
    assert.equal(accepted.principal.subject, "user-1");
    await assert.rejects(async () => validate(await token(privateKey, { scope: "openid" })), /consultation\.read/u);
    await assert.rejects(async () => validate(await token(privateKey, { realm_access: { roles: [] } })), /consultation_user/u);
    const now = Math.floor(Date.now() / 1000);
    const tooLong = await new SignJWT({ scope: "consultation.read", realm_access: { roles: ["consultation_user"] } })
      .setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer("https://auth.example.test/realms/consultation")
      .setAudience("consultation-api").setSubject("user-1").setIssuedAt(now).setExpirationTime(now + 600).sign(privateKey);
    await assert.rejects(() => validate(tooLong), /lifetime/u);
  });
});

test("V1 cookie and MCP protected-resource metadata expose the frozen contract", () => {
  assert.equal(sessionCookie("opaque"), "__Host-consultation_v1=opaque; Path=/; Secure; HttpOnly; SameSite=Lax");
  const resource = "https://mcp.example.test/mcp/v1";
  assert.deepEqual(oauthProtectedResourceMetadata({ resource, issuer: "https://auth.example.test/realms/consultation" }), {
    resource,
    authorization_servers: ["https://auth.example.test/realms/consultation"],
    scopes_supported: ["consultation.read"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://mcp.example.test/docs/mcp/v1",
  });
  assert.match(bearerChallenge("https://mcp.example.test/.well-known/oauth-protected-resource/mcp/v1"), /resource_metadata=/u);
});
