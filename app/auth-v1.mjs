import crypto from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";

const DEFAULT_ACCESS_TOKEN_MAX_SECONDS = 300;
const DEFAULT_SESSION_IDLE_SECONDS = 30 * 60;
const DEFAULT_SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;
const CLOCK_TOLERANCE_SECONDS = 5;
const SESSION_COOKIE = "__Host-consultation_v1";

function authError(code, message, statusCode = 401) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function requiredString(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function randomToken(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

function parseScopes(value) {
  return new Set(String(value ?? "").split(/\s+/u).filter(Boolean));
}

function rolesFromPayload(payload) {
  const realmRoles = Array.isArray(payload.realm_access?.roles) ? payload.realm_access.roles : [];
  const directRoles = Array.isArray(payload.roles) ? payload.roles : [];
  return [...new Set([...realmRoles, ...directRoles].map(String))];
}

function principalFromPayload(payload) {
  return {
    issuer: String(payload.iss),
    subject: String(payload.sub),
    display_name: payload.name ? String(payload.name) : payload.preferred_username ? String(payload.preferred_username) : null,
    roles: rolesFromPayload(payload),
    scopes: [...parseScopes(payload.scope)].sort(),
    authenticated_at: payload.auth_time
      ? new Date(Number(payload.auth_time) * 1000).toISOString()
      : new Date(Number(payload.iat) * 1000).toISOString(),
  };
}

function assertTokenLifetime(payload, maximumSeconds) {
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    throw authError("INVALID_TOKEN", "access token must contain integer iat and exp claims");
  }
  if (payload.exp - payload.iat > maximumSeconds + CLOCK_TOLERANCE_SECONDS) {
    throw authError("INVALID_TOKEN", "access token lifetime exceeds the accepted maximum");
  }
}

export function loadAuthV1Config(env = process.env) {
  const issuer = requiredString(env.OIDC_ISSUER, "OIDC_ISSUER").replace(/\/$/u, "");
  return {
    issuer,
    clientId: requiredString(env.OIDC_CLIENT_ID, "OIDC_CLIENT_ID"),
    clientSecret: String(env.OIDC_CLIENT_SECRET ?? "").trim(),
    redirectUri: String(env.OIDC_REDIRECT_URI ?? "").trim(),
    apiAudience: requiredString(env.OIDC_API_AUDIENCE, "OIDC_API_AUDIENCE"),
    mcpAudience: requiredString(env.OIDC_MCP_AUDIENCE, "OIDC_MCP_AUDIENCE"),
    requiredScope: env.OIDC_REQUIRED_SCOPE?.trim() || "consultation.read",
    requiredRole: env.OIDC_REQUIRED_ROLE?.trim() || "consultation_user",
    accessTokenMaxSeconds: Number(env.OIDC_ACCESS_TOKEN_MAX_SECONDS ?? DEFAULT_ACCESS_TOKEN_MAX_SECONDS),
    sessionIdleSeconds: Number(env.BFF_SESSION_IDLE_SECONDS ?? DEFAULT_SESSION_IDLE_SECONDS),
    sessionAbsoluteSeconds: Number(env.BFF_SESSION_ABSOLUTE_SECONDS ?? DEFAULT_SESSION_ABSOLUTE_SECONDS),
  };
}

export async function discoverOidc(issuer, fetchImpl = fetch) {
  const response = await fetchImpl(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`OIDC discovery failed with status ${response.status}`);
  const metadata = await response.json();
  if (metadata.issuer !== issuer) throw new Error("OIDC discovery issuer mismatch");
  for (const field of ["authorization_endpoint", "token_endpoint", "jwks_uri"]) {
    if (!metadata[field]) throw new Error(`OIDC discovery is missing ${field}`);
  }
  return metadata;
}

export function createTokenValidator({
  issuer,
  audience,
  requiredScope = "consultation.read",
  requiredRole = "consultation_user",
  maximumLifetimeSeconds = DEFAULT_ACCESS_TOKEN_MAX_SECONDS,
  jwksUri,
}) {
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  return async function validateToken(token) {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }));
    } catch {
      throw authError("INVALID_TOKEN", "access token is invalid or expired");
    }
    assertTokenLifetime(payload, maximumLifetimeSeconds);
    if (!parseScopes(payload.scope).has(requiredScope)) {
      throw authError("INSUFFICIENT_SCOPE", `${requiredScope} is required`, 403);
    }
    if (requiredRole && !rolesFromPayload(payload).includes(requiredRole)) {
      throw authError("FORBIDDEN", `${requiredRole} role is required`, 403);
    }
    return { payload, principal: principalFromPayload(payload), token };
  };
}

function parseCookies(header) {
  const cookies = new Map();
  for (const item of String(header ?? "").split(";")) {
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    cookies.set(item.slice(0, separator).trim(), decodeURIComponent(item.slice(separator + 1).trim()));
  }
  return cookies;
}

export function sessionCookie(value, { clear = false } = {}) {
  const age = clear ? "; Max-Age=0" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Lax${age}`;
}

function validateReturnTo(value) {
  const route = String(value ?? "/");
  return route.startsWith("/") && !route.startsWith("//") && !route.includes("\\") ? route : "/";
}

async function tokenRequest(endpoint, config, parameters, fetchImpl) {
  const body = new URLSearchParams(parameters);
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw authError("TOKEN_EXCHANGE_FAILED", "identity-provider token exchange failed");
  return result;
}

export async function createBffAuth({ config, fetchImpl = fetch, now = () => Date.now() }) {
  requiredString(config.clientSecret, "OIDC_CLIENT_SECRET");
  requiredString(config.redirectUri, "OIDC_REDIRECT_URI");
  const metadata = await discoverOidc(config.issuer, fetchImpl);
  const validateAccessToken = createTokenValidator({
    issuer: config.issuer,
    audience: config.apiAudience,
    requiredScope: config.requiredScope,
    requiredRole: config.requiredRole,
    maximumLifetimeSeconds: config.accessTokenMaxSeconds,
    jwksUri: metadata.jwks_uri,
  });
  const idTokenJwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
  const pending = new Map();
  const sessions = new Map();

  function cleanup() {
    const timestamp = now();
    for (const [state, item] of pending) if (item.expiresAt <= timestamp) pending.delete(state);
    for (const [id, item] of sessions) {
      if (item.absoluteExpiresAt <= timestamp || item.idleExpiresAt <= timestamp) sessions.delete(id);
    }
  }

  async function beginLogin(returnTo = "/") {
    cleanup();
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
    pending.set(state, { nonce, verifier, returnTo: validateReturnTo(returnTo), expiresAt: now() + 5 * 60 * 1000 });
    const url = new URL(metadata.authorization_endpoint);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", `openid ${config.requiredScope}`);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("resource", config.apiAudience);
    return url.toString();
  }

  async function completeLogin({ code, state }) {
    cleanup();
    const pendingLogin = pending.get(String(state));
    pending.delete(String(state));
    if (!pendingLogin || pendingLogin.expiresAt <= now()) throw authError("INVALID_LOGIN_STATE", "login state is invalid or expired", 400);
    const tokens = await tokenRequest(metadata.token_endpoint, config, {
      grant_type: "authorization_code",
      code: requiredString(code, "authorization code"),
      redirect_uri: config.redirectUri,
      code_verifier: pendingLogin.verifier,
      resource: config.apiAudience,
    }, fetchImpl);
    const access = await validateAccessToken(tokens.access_token);
    if (!tokens.id_token) throw authError("INVALID_ID_TOKEN", "identity token is missing");
    try {
      const verifiedId = await jwtVerify(tokens.id_token, idTokenJwks, {
        issuer: config.issuer,
        audience: config.clientId,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });
      if (verifiedId.payload.nonce !== pendingLogin.nonce) throw new Error("nonce mismatch");
    } catch {
      throw authError("INVALID_ID_TOKEN", "identity token is invalid");
    }
    if (!tokens.refresh_token) throw authError("REFRESH_TOKEN_REQUIRED", "identity provider did not issue a refresh token");
    const id = randomToken(32);
    const timestamp = now();
    sessions.set(id, {
      id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      access,
      idleExpiresAt: timestamp + config.sessionIdleSeconds * 1000,
      absoluteExpiresAt: timestamp + config.sessionAbsoluteSeconds * 1000,
      refreshPromise: null,
    });
    return { sessionId: id, returnTo: pendingLogin.returnTo, principal: access.principal };
  }

  async function refresh(session) {
    if (session.refreshPromise) return session.refreshPromise;
    session.refreshPromise = (async () => {
      try {
        const tokens = await tokenRequest(metadata.token_endpoint, config, {
          grant_type: "refresh_token",
          refresh_token: session.refreshToken,
          resource: config.apiAudience,
        }, fetchImpl);
        session.accessToken = tokens.access_token;
        session.refreshToken = tokens.refresh_token ?? session.refreshToken;
        session.access = await validateAccessToken(session.accessToken);
        return session.access;
      } catch (error) {
        sessions.delete(session.id);
        throw error;
      } finally {
        session.refreshPromise = null;
      }
    })();
    return session.refreshPromise;
  }

  async function authenticate(request) {
    cleanup();
    const authorization = String(request.headers.authorization ?? "");
    if (authorization.startsWith("Bearer ")) return { ...await validateAccessToken(authorization.slice(7)), kind: "bearer" };
    const sessionId = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (!session) throw authError("UNAUTHORIZED", "authentication required");
    const timestamp = now();
    if (session.idleExpiresAt <= timestamp || session.absoluteExpiresAt <= timestamp) {
      sessions.delete(session.id);
      throw authError("UNAUTHORIZED", "session expired");
    }
    const expiresAt = Number(session.access.payload.exp) * 1000;
    const access = expiresAt - timestamp <= 30_000 ? await refresh(session) : await validateAccessToken(session.accessToken);
    session.access = access;
    session.idleExpiresAt = Math.min(session.absoluteExpiresAt, timestamp + config.sessionIdleSeconds * 1000);
    return { ...access, kind: "session", sessionId };
  }

  function destroy(request) {
    const sessionId = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
    if (sessionId) sessions.delete(sessionId);
  }

  return { beginLogin, completeLogin, authenticate, destroy, metadata, validateAccessToken };
}

export async function createBearerAuth({ config, audience, fetchImpl = fetch }) {
  const metadata = await discoverOidc(config.issuer, fetchImpl);
  const validate = createTokenValidator({
    issuer: config.issuer,
    audience,
    requiredScope: config.requiredScope,
    requiredRole: config.requiredRole,
    maximumLifetimeSeconds: config.accessTokenMaxSeconds,
    jwksUri: metadata.jwks_uri,
  });
  return {
    metadata,
    async authenticate(request) {
      const authorization = String(request.headers.authorization ?? "");
      if (!authorization.startsWith("Bearer ")) throw authError("UNAUTHORIZED", "valid bearer token required");
      return validate(authorization.slice(7));
    },
  };
}

export function oauthProtectedResourceMetadata({ resource, issuer, scope = "consultation.read" }) {
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: [scope],
    bearer_methods_supported: ["header"],
    resource_documentation: `${resource.replace(/\/mcp\/v1$/u, "")}/docs/mcp/v1`,
  };
}

export function bearerChallenge(resourceMetadataUrl, scope = "consultation.read") {
  return `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scope}"`;
}

export function isAuthError(error) {
  return Number.isInteger(error?.statusCode) && typeof error?.code === "string";
}
