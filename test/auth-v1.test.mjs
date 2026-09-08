import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { bearerChallenge, createBffAuth, createLoginRateLimiter, createTokenValidator, loadAuthV1Config, oauthProtectedResourceMetadata, oidcBackchannelUrl, sessionCookie } from "../app/auth-v1.mjs";

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

async function withOidc(work) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test", alg: "RS256", use: "sig" };
  let issuedTokens = null;
  const server = createServer((request, response) => {
    const issuer = `http://127.0.0.1:${server.address().port}`;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/.well-known/openid-configuration") {
      response.end(JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/auth`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
      }));
      return;
    }
    if (request.url === "/jwks") {
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (request.url === "/token" && issuedTokens) {
      response.end(JSON.stringify(issuedTokens));
      return;
    }
    response.writeHead(404).end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await work({
      issuer: `http://127.0.0.1:${server.address().port}`,
      privateKey,
      issue: (tokens) => { issuedTokens = tokens; },
    });
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
  });
  assert.match(bearerChallenge("https://mcp.example.test/.well-known/oauth-protected-resource/mcp/v1"), /resource_metadata=/u);
});

test("V1 authentication configuration rejects unsafe duration values", () => {
  const base = {
    OIDC_ISSUER: "https://auth.example.test/realms/consultation",
    OIDC_CLIENT_ID: "consultation-web",
    OIDC_API_AUDIENCE: "consultation-api",
    OIDC_MCP_AUDIENCE: "consultation-mcp",
  };
  assert.throws(() => loadAuthV1Config({ ...base, OIDC_ACCESS_TOKEN_MAX_SECONDS: "not-a-number" }), /positive integer/u);
  assert.throws(() => loadAuthV1Config({ ...base, OIDC_ACCESS_TOKEN_MAX_SECONDS: "301" }), /no greater than 300/u);
  assert.throws(() => loadAuthV1Config({ ...base, BFF_SESSION_IDLE_SECONDS: "60", BFF_SESSION_ABSOLUTE_SECONDS: "30" }), /must not exceed/u);
  assert.throws(() => loadAuthV1Config({ ...base, OIDC_BACKCHANNEL_BASE_URL: "http://keycloak:8080/path" }), /without a path/u);
  assert.throws(() => loadAuthV1Config({ ...base, LOGIN_RATE_LIMIT_PER_CLIENT: "61" }), /must not exceed LOGIN_RATE_LIMIT_GLOBAL/u);
  assert.throws(() => loadAuthV1Config({ ...base, LOGIN_RATE_LIMIT_MAX_CLIENTS: "59" }), /must be at least LOGIN_RATE_LIMIT_GLOBAL/u);
  assert.throws(() => loadAuthV1Config({ ...base, BFF_MAX_PENDING_LOGINS: "100" }), /can exceed BFF_MAX_PENDING_LOGINS/u);
});

test("V1 OIDC backchannel retains public paths on the internal Keycloak origin", () => {
  assert.equal(
    oidcBackchannelUrl(
      "https://auth.example.test/realms/consultation/protocol/openid-connect/token",
      "http://keycloak:8080",
    ),
    "http://keycloak:8080/realms/consultation/protocol/openid-connect/token",
  );
});

test("V1 login limiter enforces client and global windows and reports retry timing", () => {
  let timestamp = 0;
  const limiter = createLoginRateLimiter({
    windowSeconds: 60,
    perClientMax: 2,
    globalMax: 3,
    maxTrackedClients: 3,
    now: () => timestamp,
  });
  const request = (address) => ({ headers: { "cf-connecting-ip": address }, socket: { remoteAddress: "127.0.0.1" } });
  limiter.admit(request("203.0.113.1"));
  limiter.admit(request("203.0.113.1"));
  assert.throws(() => limiter.admit(request("203.0.113.1")), (error) => (
    error.code === "LOGIN_RATE_LIMITED" && error.statusCode === 429 && error.retryAfterSeconds === 60
  ));
  limiter.admit(request("203.0.113.2"));
  assert.throws(() => limiter.admit(request("203.0.113.3")), (error) => error.code === "LOGIN_RATE_LIMITED");
  timestamp = 60_000;
  assert.doesNotThrow(() => limiter.admit(request("203.0.113.3")));
});

test("V1 pending login state is bounded", async () => {
  const config = {
    ...loadAuthV1Config({
      OIDC_ISSUER: "https://auth.example.test/realms/consultation",
      OIDC_CLIENT_ID: "consultation-web",
      OIDC_API_AUDIENCE: "consultation-api",
      OIDC_MCP_AUDIENCE: "consultation-mcp",
    }),
    clientSecret: "secret",
    redirectUri: "https://consultation.example.test/api/v1/auth/callback",
  };
  const auth = await createBffAuth({
    config,
    maxPendingLogins: 1,
    fetchImpl: async () => new Response(JSON.stringify({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/auth`,
      token_endpoint: `${config.issuer}/token`,
      jwks_uri: `${config.issuer}/certs`,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  await auth.beginLogin("/");
  await assert.rejects(() => auth.beginLogin("/"), (error) => error.code === "AUTH_CAPACITY_REACHED" && error.statusCode === 503);
});

test("V1 login binds the ID-token subject to the access-token subject", async () => {
  await withOidc(async ({ issuer, privateKey, issue }) => {
    const clientId = "consultation-web";
    const config = {
      ...loadAuthV1Config({
        OIDC_ISSUER: issuer,
        OIDC_CLIENT_ID: clientId,
        OIDC_API_AUDIENCE: "consultation-api",
        OIDC_MCP_AUDIENCE: "consultation-mcp",
      }),
      clientSecret: "secret",
      redirectUri: "https://consultation.example.test/api/v1/auth/callback",
    };
    const auth = await createBffAuth({ config });
    const login = new URL(await auth.beginLogin("/binaries"));
    const now = Math.floor(Date.now() / 1000);
    const common = { alg: "RS256", kid: "test" };
    const accessToken = await new SignJWT({
      scope: "openid consultation.read",
      realm_access: { roles: ["consultation_user"] },
    }).setProtectedHeader(common).setIssuer(issuer).setAudience("consultation-api")
      .setSubject("access-user").setIssuedAt(now).setExpirationTime(now + 300).sign(privateKey);
    const idToken = await new SignJWT({ nonce: login.searchParams.get("nonce") })
      .setProtectedHeader(common).setIssuer(issuer).setAudience(clientId)
      .setSubject("different-user").setIssuedAt(now).setExpirationTime(now + 300).sign(privateKey);
    issue({ access_token: accessToken, id_token: idToken, refresh_token: "refresh" });
    await assert.rejects(
      () => auth.completeLogin({ code: "code", state: login.searchParams.get("state") }),
      (error) => error.code === "INVALID_ID_TOKEN" && /identity token is invalid/u.test(error.message),
    );
  });
});
