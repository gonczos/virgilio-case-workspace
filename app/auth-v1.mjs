import crypto from "node:crypto";
import net from "node:net";

import { createRemoteJWKSet, jwtVerify } from "jose";

const DEFAULT_ACCESS_TOKEN_MAX_SECONDS = 300;
const DEFAULT_SESSION_IDLE_SECONDS = 30 * 60;
const DEFAULT_SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;
const DEFAULT_MAX_PENDING_LOGINS = 4096;
const DEFAULT_MAX_SESSIONS = 2048;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_LOGIN_RATE_LIMIT_PER_CLIENT = 10;
const DEFAULT_LOGIN_RATE_LIMIT_GLOBAL = 60;
const DEFAULT_LOGIN_RATE_LIMIT_MAX_CLIENTS = 256;
const DEFAULT_LOGIN_STATE_TTL_SECONDS = 60 * 60;
const CLOCK_TOLERANCE_SECONDS = 5;
const SESSION_COOKIE = "__Host-consultation_v1";

function authError(code, message, statusCode = 401) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function loginRateLimitError(retryAfterSeconds) {
  const error = authError("LOGIN_RATE_LIMITED", "too many login requests", 429);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function requiredString(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function positiveIntegerSetting(value, name, fallback, { maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return parsed;
}

function optionalOrigin(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = new URL(normalized);
  if (!new Set(["http:", "https:"]).has(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an HTTP(S) origin without a path, query, or fragment`);
  }
  return parsed.origin;
}

function clientAddress(request) {
  const cloudflareAddress = String(request?.headers?.["cf-connecting-ip"] ?? "").trim();
  if (net.isIP(cloudflareAddress)) return cloudflareAddress;
  const remoteAddress = String(request?.socket?.remoteAddress ?? "unknown");
  return remoteAddress.startsWith("::ffff:") ? remoteAddress.slice(7) : remoteAddress;
}

export function createLoginRateLimiter({
  windowSeconds,
  perClientMax,
  globalMax,
  maxTrackedClients,
  now = () => Date.now(),
}) {
  const windowMs = windowSeconds * 1000;
  let globalWindow = { startedAt: now(), count: 0 };
  const clients = new Map();

  function resetExpired(timestamp) {
    if (timestamp - globalWindow.startedAt >= windowMs) globalWindow = { startedAt: timestamp, count: 0 };
    for (const [key, value] of clients) {
      if (timestamp - value.startedAt >= windowMs) clients.delete(key);
    }
  }

  function retryAfter(startedAt, timestamp) {
    return Math.max(1, Math.ceil((startedAt + windowMs - timestamp) / 1000));
  }

  return {
    admit(request) {
      const timestamp = now();
      resetExpired(timestamp);
      if (globalWindow.count >= globalMax) throw loginRateLimitError(retryAfter(globalWindow.startedAt, timestamp));
      const key = clientAddress(request);
      let client = clients.get(key);
      if (!client) {
        if (clients.size >= maxTrackedClients) {
          const oldestKey = clients.keys().next().value;
          clients.delete(oldestKey);
        }
        client = { startedAt: timestamp, count: 0 };
        clients.set(key, client);
      }
      if (client.count >= perClientMax) throw loginRateLimitError(retryAfter(client.startedAt, timestamp));
      client.count += 1;
      globalWindow.count += 1;
    },
  };
}

export function oidcBackchannelUrl(publicUrl, backchannelOrigin) {
  if (!backchannelOrigin) return publicUrl;
  const target = new URL(publicUrl);
  return new URL(`${target.pathname}${target.search}`, `${backchannelOrigin}/`).toString();
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
  const config = {
    issuer,
    clientId: requiredString(env.OIDC_CLIENT_ID, "OIDC_CLIENT_ID"),
    clientSecret: String(env.OIDC_CLIENT_SECRET ?? "").trim(),
    redirectUri: String(env.OIDC_REDIRECT_URI ?? "").trim(),
    apiAudience: requiredString(env.OIDC_API_AUDIENCE, "OIDC_API_AUDIENCE"),
    mcpAudience: requiredString(env.OIDC_MCP_AUDIENCE, "OIDC_MCP_AUDIENCE"),
    requiredScope: env.OIDC_REQUIRED_SCOPE?.trim() || "consultation.read",
    requiredRole: env.OIDC_REQUIRED_ROLE?.trim() || "consultation_user",
    backchannelOrigin: optionalOrigin(env.OIDC_BACKCHANNEL_BASE_URL, "OIDC_BACKCHANNEL_BASE_URL"),
    maxPendingLogins: positiveIntegerSetting(env.BFF_MAX_PENDING_LOGINS, "BFF_MAX_PENDING_LOGINS", DEFAULT_MAX_PENDING_LOGINS, { maximum: 10_000 }),
    loginStateTtlSeconds: positiveIntegerSetting(env.BFF_LOGIN_STATE_TTL_SECONDS, "BFF_LOGIN_STATE_TTL_SECONDS", DEFAULT_LOGIN_STATE_TTL_SECONDS, { maximum: 3600 }),
    maxSessions: positiveIntegerSetting(env.BFF_MAX_SESSIONS, "BFF_MAX_SESSIONS", DEFAULT_MAX_SESSIONS, { maximum: 100_000 }),
    loginRateLimitWindowSeconds: positiveIntegerSetting(env.LOGIN_RATE_LIMIT_WINDOW_SECONDS, "LOGIN_RATE_LIMIT_WINDOW_SECONDS", DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS, { maximum: 3600 }),
    loginRateLimitPerClient: positiveIntegerSetting(env.LOGIN_RATE_LIMIT_PER_CLIENT, "LOGIN_RATE_LIMIT_PER_CLIENT", DEFAULT_LOGIN_RATE_LIMIT_PER_CLIENT, { maximum: 10_000 }),
    loginRateLimitGlobal: positiveIntegerSetting(env.LOGIN_RATE_LIMIT_GLOBAL, "LOGIN_RATE_LIMIT_GLOBAL", DEFAULT_LOGIN_RATE_LIMIT_GLOBAL, { maximum: 10_000 }),
    loginRateLimitMaxClients: positiveIntegerSetting(env.LOGIN_RATE_LIMIT_MAX_CLIENTS, "LOGIN_RATE_LIMIT_MAX_CLIENTS", DEFAULT_LOGIN_RATE_LIMIT_MAX_CLIENTS, { maximum: 100_000 }),
    accessTokenMaxSeconds: positiveIntegerSetting(
      env.OIDC_ACCESS_TOKEN_MAX_SECONDS,
      "OIDC_ACCESS_TOKEN_MAX_SECONDS",
      DEFAULT_ACCESS_TOKEN_MAX_SECONDS,
      { maximum: DEFAULT_ACCESS_TOKEN_MAX_SECONDS },
    ),
    sessionIdleSeconds: positiveIntegerSetting(env.BFF_SESSION_IDLE_SECONDS, "BFF_SESSION_IDLE_SECONDS", DEFAULT_SESSION_IDLE_SECONDS),
    sessionAbsoluteSeconds: positiveIntegerSetting(env.BFF_SESSION_ABSOLUTE_SECONDS, "BFF_SESSION_ABSOLUTE_SECONDS", DEFAULT_SESSION_ABSOLUTE_SECONDS),
  };
  if (config.sessionIdleSeconds > config.sessionAbsoluteSeconds) {
    throw new Error("BFF_SESSION_IDLE_SECONDS must not exceed BFF_SESSION_ABSOLUTE_SECONDS");
  }
  if (config.loginRateLimitPerClient > config.loginRateLimitGlobal) {
    throw new Error("LOGIN_RATE_LIMIT_PER_CLIENT must not exceed LOGIN_RATE_LIMIT_GLOBAL");
  }
  if (config.loginRateLimitMaxClients < config.loginRateLimitGlobal * 2) {
    throw new Error("LOGIN_RATE_LIMIT_MAX_CLIENTS must be at least twice LOGIN_RATE_LIMIT_GLOBAL");
  }
  const maximumAdmissionsDuringLoginTtl = config.loginRateLimitGlobal
    * (Math.ceil(config.loginStateTtlSeconds / config.loginRateLimitWindowSeconds) + 1);
  if (maximumAdmissionsDuringLoginTtl > config.maxPendingLogins) {
    throw new Error("login rate-limit settings can exceed BFF_MAX_PENDING_LOGINS during the login-state lifetime");
  }
  return config;
}

export async function discoverOidc(issuer, fetchImpl = fetch, discoveryUrl = `${issuer}/.well-known/openid-configuration`) {
  const response = await fetchImpl(discoveryUrl, {
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
    if (typeof payload.sub !== "string" || !payload.sub.trim()) {
      throw authError("INVALID_TOKEN", "access token must contain a subject");
    }
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

export async function createBffAuth({
  config,
  fetchImpl = fetch,
  now = () => Date.now(),
  maxPendingLogins = config.maxPendingLogins ?? DEFAULT_MAX_PENDING_LOGINS,
  maxSessions = config.maxSessions ?? DEFAULT_MAX_SESSIONS,
  onIdTokenFailure = (reason) => console.error("[consultation-auth] ID-token validation failed:", reason),
}) {
  requiredString(config.clientSecret, "OIDC_CLIENT_SECRET");
  requiredString(config.redirectUri, "OIDC_REDIRECT_URI");
  const metadata = await discoverOidc(
    config.issuer,
    fetchImpl,
    oidcBackchannelUrl(`${config.issuer}/.well-known/openid-configuration`, config.backchannelOrigin),
  );
  const tokenEndpoint = oidcBackchannelUrl(metadata.token_endpoint, config.backchannelOrigin);
  const jwksUri = oidcBackchannelUrl(metadata.jwks_uri, config.backchannelOrigin);
  const validateAccessToken = createTokenValidator({
    issuer: config.issuer,
    audience: config.apiAudience,
    requiredScope: config.requiredScope,
    requiredRole: config.requiredRole,
    maximumLifetimeSeconds: config.accessTokenMaxSeconds,
    jwksUri,
  });
  const idTokenJwks = createRemoteJWKSet(new URL(jwksUri));
  const pending = new Map();
  const sessions = new Map();
  const loginRateLimiter = createLoginRateLimiter({
    windowSeconds: config.loginRateLimitWindowSeconds ?? DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    perClientMax: config.loginRateLimitPerClient ?? DEFAULT_LOGIN_RATE_LIMIT_PER_CLIENT,
    globalMax: config.loginRateLimitGlobal ?? DEFAULT_LOGIN_RATE_LIMIT_GLOBAL,
    maxTrackedClients: config.loginRateLimitMaxClients ?? DEFAULT_LOGIN_RATE_LIMIT_MAX_CLIENTS,
    now,
  });

  function cleanup() {
    const timestamp = now();
    for (const [state, item] of pending) if (item.expiresAt <= timestamp) pending.delete(state);
    for (const [id, item] of sessions) {
      if (item.absoluteExpiresAt <= timestamp || item.idleExpiresAt <= timestamp) sessions.delete(id);
    }
  }

  async function beginLogin(returnTo = "/", request = null) {
    cleanup();
    loginRateLimiter.admit(request);
    if (pending.size >= maxPendingLogins || sessions.size >= maxSessions) {
      throw authError("AUTH_CAPACITY_REACHED", "authentication capacity is temporarily exhausted", 503);
    }
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
    pending.set(state, { nonce, verifier, returnTo: validateReturnTo(returnTo), expiresAt: now() + config.loginStateTtlSeconds * 1000 });
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

  async function completeLogin({ code, state, error: providerError }) {
    cleanup();
    const pendingLogin = pending.get(String(state));
    pending.delete(String(state));
    if (!pendingLogin || pendingLogin.expiresAt <= now()) throw authError("INVALID_LOGIN_STATE", "login state is invalid or expired", 400);
    if (providerError) throw authError("LOGIN_FAILED", "identity provider did not complete login; start a new login", 401);
    if (sessions.size >= maxSessions) throw authError("AUTH_CAPACITY_REACHED", "authentication capacity is temporarily exhausted", 503);
    const tokens = await tokenRequest(tokenEndpoint, config, {
      grant_type: "authorization_code",
      code: requiredString(code, "authorization code"),
      redirect_uri: config.redirectUri,
      code_verifier: pendingLogin.verifier,
      resource: config.apiAudience,
    }, fetchImpl);
    const access = await validateAccessToken(tokens.access_token);
    if (!tokens.id_token) throw authError("INVALID_ID_TOKEN", "identity token is missing");
    let failureReason = "verification_failed";
    try {
      const verifiedId = await jwtVerify(tokens.id_token, idTokenJwks, {
        issuer: config.issuer,
        audience: config.clientId,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });
      if (verifiedId.payload.nonce !== pendingLogin.nonce) {
        failureReason = "nonce_mismatch";
        throw new Error("nonce mismatch");
      }
      if (!verifiedId.payload.sub || verifiedId.payload.sub !== access.payload.sub) {
        failureReason = "subject_mismatch";
        throw new Error("subject mismatch");
      }
    } catch (error) {
      const safeCodes = new Set(["ERR_JWT_EXPIRED", "ERR_JWT_CLAIM_VALIDATION_FAILED", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "ERR_JWKS_NO_MATCHING_KEY", "ERR_JWKS_TIMEOUT"]);
      onIdTokenFailure(safeCodes.has(error.code) ? error.code : failureReason);
      throw authError("INVALID_ID_TOKEN", "identity token is invalid");
    }
    if (!tokens.refresh_token) throw authError("REFRESH_TOKEN_REQUIRED", "identity provider did not issue a refresh token");
    if (sessions.size >= maxSessions) throw authError("AUTH_CAPACITY_REACHED", "authentication capacity is temporarily exhausted", 503);
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
        const tokens = await tokenRequest(tokenEndpoint, config, {
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

  function beginLogout(request) {
    const url = new URL(requiredString(metadata.end_session_endpoint, "OIDC end-session endpoint"));
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("post_logout_redirect_uri", new URL("/signed-out", config.redirectUri).toString());
    destroy(request);
    return url.toString();
  }

  return { beginLogin, completeLogin, authenticate, destroy, beginLogout, metadata, validateAccessToken };
}

export async function createBearerAuth({ config, audience, fetchImpl = fetch }) {
  const metadata = await discoverOidc(
    config.issuer,
    fetchImpl,
    oidcBackchannelUrl(`${config.issuer}/.well-known/openid-configuration`, config.backchannelOrigin),
  );
  const validate = createTokenValidator({
    issuer: config.issuer,
    audience,
    requiredScope: config.requiredScope,
    requiredRole: config.requiredRole,
    maximumLifetimeSeconds: config.accessTokenMaxSeconds,
    jwksUri: oidcBackchannelUrl(metadata.jwks_uri, config.backchannelOrigin),
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
  };
}

export function bearerChallenge(resourceMetadataUrl, scope = "consultation.read") {
  return `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scope}"`;
}

export function isAuthError(error) {
  return Number.isInteger(error?.statusCode) && typeof error?.code === "string";
}
