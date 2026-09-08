import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { createBffAuth, isAuthError, loadAuthV1Config, sessionCookie } from "./auth-v1.mjs";
import { getConsultationBinaryDetail, getRepresentationContent, isValidSha256, listConsultationBinaries, parsePositiveInteger } from "./consultation-store.mjs";
import { queryCourtRecords } from "./court-records-api.mjs";
import { createDbClient, getWorkspaceRoot, loadDotEnv } from "./processing-common.mjs";
import { REFERENCE_LOOKUP_DEFAULT_LIMIT, REFERENCE_LOOKUP_MAX_LIMIT, REFERENCE_LOOKUP_MAX_OFFSET, lookupRecordedReferences } from "./reference-observation-api.mjs";
import { searchReferencePilot } from "./reference-consultation-read.mjs";
import { isRepresentationArtifactError } from "./representation-artifacts.mjs";

const PRIVATE_CACHE_CONTROL = "private, no-store";

export function materializeOpenApi(openApi, { apiPublicUrl, oidcMetadata }) {
  const publicUrl = new URL(apiPublicUrl);
  const authorizationUrl = new URL(oidcMetadata.authorization_endpoint);
  const tokenUrl = new URL(oidcMetadata.token_endpoint);
  const materialized = structuredClone(openApi);
  materialized.servers = [{ url: publicUrl.toString().replace(/\/$/u, "") }];
  const flow = materialized.components?.securitySchemes?.oauth2?.flows?.authorizationCode;
  if (!flow) throw new Error("OpenAPI contract is missing the OAuth authorization-code flow");
  flow.authorizationUrl = authorizationUrl.toString();
  flow.tokenUrl = tokenUrl.toString();
  return materialized;
}

function json(response, request, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": PRIVATE_CACHE_CONTROL,
    ...headers,
  });
  response.end(request.method === "HEAD" ? undefined : JSON.stringify(body));
}

function errorResponse(response, request, statusCode, code, message, headers = {}) {
  json(response, request, statusCode, { error: { code, message } }, headers);
}

function text(response, request, statusCode, contentType, body) {
  response.writeHead(statusCode, { "Content-Type": contentType, "Cache-Control": PRIVATE_CACHE_CONTROL });
  response.end(request.method === "HEAD" ? undefined : body);
}

function queryObject(searchParams) {
  const result = {};
  for (const key of searchParams.keys()) {
    if (searchParams.getAll(key).length > 1) throw Object.assign(new Error(`${key} must be supplied at most once`), { code: "DUPLICATE_QUERY_PARAMETER" });
    result[key] = searchParams.get(key);
  }
  return result;
}

function requireOnly(searchParams, permitted) {
  for (const key of searchParams.keys()) {
    if (!permitted.has(key)) throw Object.assign(new Error(`unknown query parameter: ${key}`), { code: "UNKNOWN_QUERY_PARAMETER" });
    if (searchParams.getAll(key).length > 1) throw Object.assign(new Error(`${key} must be supplied at most once`), { code: "DUPLICATE_QUERY_PARAMETER" });
  }
}

function versionBinaryUrls(value) {
  if (Array.isArray(value)) return value.map(versionBinaryUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, versionBinaryUrls(child)]));
  }
  if (typeof value === "string" && /^\/binary\/[0-9a-f]{64}$/u.test(value)) {
    return `/api/v1/binaries/${value.slice("/binary/".length)}/content`;
  }
  return value;
}

function mapReadError(error) {
  if (isAuthError(error)) return { status: error.statusCode, code: error.code, message: error.message };
  const safe = new Set([
    "INVALID_SHA256", "INVALID_REPRESENTATION_ID", "INVALID_REPRESENTATION_FORMAT",
    "INVALID_COURT_RECORD_FILTER", "UNKNOWN_COURT_RECORD_FILTER", "UNKNOWN_QUERY_PARAMETER",
    "DUPLICATE_QUERY_PARAMETER", "NOT_FOUND", "representation_format_not_available",
    "invalid_representation_format", "INVALID_PAGINATION", "REFERENCE_VALUE_REQUIRED",
    "INVALID_REFERENCE_SCOPE", "INVALID_REFERENCE_LIFECYCLE", "SEARCH_QUERY_REQUIRED",
    "INVALID_SEARCH_SCOPE", "INVALID_SEARCH_SORT",
  ]);
  if (safe.has(error?.code)) {
    const notFound = error.code === "NOT_FOUND" || error.code === "representation_format_not_available";
    return { status: notFound ? 404 : 400, code: String(error.code).toUpperCase(), message: String(error.message) };
  }
  if (isRepresentationArtifactError(error)) return { status: 500, code: "REPRESENTATION_ARTIFACT_FAILED", message: "representation could not be read" };
  return { status: 500, code: "CONSULTATION_READ_FAILED", message: "consultation read failed" };
}

async function proxyBinary({ request, response, requestUrl, gatewayUrl, internalToken }) {
  const upstream = await fetch(`${gatewayUrl}${requestUrl.pathname.replace(/^\/api\/v1/u, "/internal/v1")}`, {
    method: request.method,
    headers: { Authorization: `Bearer ${internalToken}` },
  });
  response.statusCode = upstream.status;
  response.setHeader("Cache-Control", PRIVATE_CACHE_CONTROL);
  for (const header of ["content-type", "content-length", "content-disposition"]) {
    const value = upstream.headers.get(header);
    if (value) response.setHeader(header, value);
  }
  if (request.method === "HEAD" || !upstream.body) {
    response.end();
    return;
  }
  Readable.fromWeb(upstream.body).pipe(response);
}

export function createConsultationV1Handler({
  client,
  auth,
  workspaceRoot = getWorkspaceRoot(),
  sitePublicUrl,
  gatewayUrl,
  internalToken,
  openApi,
}) {
  const publicOrigin = new URL(sitePublicUrl).origin;
  return async function handler(request, response) {
    const requestUrl = new URL(request.url ?? "/", publicOrigin);
    try {
      if (requestUrl.pathname === "/api/v1/health" && request.method === "GET") {
        json(response, request, 200, { status: "ok", service: "virgilio-consultation-api", contract_version: "v1" });
        return;
      }
      if (requestUrl.pathname === "/api/v1/openapi.json" && request.method === "GET") {
        json(response, request, 200, openApi);
        return;
      }
      if (requestUrl.pathname === "/api/v1/auth/login" && request.method === "GET") {
        requireOnly(requestUrl.searchParams, new Set(["return_to"]));
        response.writeHead(302, { Location: await auth.beginLogin(requestUrl.searchParams.get("return_to") ?? "/"), "Cache-Control": PRIVATE_CACHE_CONTROL });
        response.end();
        return;
      }
      if (requestUrl.pathname === "/api/v1/auth/callback" && request.method === "GET") {
        requireOnly(requestUrl.searchParams, new Set(["code", "state", "session_state", "iss"]));
        if (requestUrl.searchParams.has("iss") && requestUrl.searchParams.get("iss") !== auth.metadata.issuer) {
          throw Object.assign(new Error("authorization response issuer mismatch"), { code: "INVALID_LOGIN_ISSUER", statusCode: 400 });
        }
        const completed = await auth.completeLogin({ code: requestUrl.searchParams.get("code"), state: requestUrl.searchParams.get("state") });
        response.writeHead(302, { Location: completed.returnTo, "Set-Cookie": sessionCookie(completed.sessionId), "Cache-Control": PRIVATE_CACHE_CONTROL });
        response.end();
        return;
      }
      if (requestUrl.pathname === "/api/v1/auth/logout") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          errorResponse(response, request, 405, "METHOD_NOT_ALLOWED", "only POST is supported");
          return;
        }
        if (request.headers.origin !== publicOrigin) {
          errorResponse(response, request, 403, "ORIGIN_NOT_ALLOWED", "request origin is not allowed");
          return;
        }
        await auth.authenticate(request);
        auth.destroy(request);
        response.writeHead(204, { "Set-Cookie": sessionCookie("", { clear: true }), "Cache-Control": PRIVATE_CACHE_CONTROL });
        response.end();
        return;
      }
      if (!new Set(["GET", "HEAD"]).has(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        errorResponse(response, request, 405, "METHOD_NOT_ALLOWED", "only GET and HEAD are supported");
        return;
      }
      const authentication = await auth.authenticate(request);
      if (requestUrl.pathname === "/api/v1/auth/session") {
        requireOnly(requestUrl.searchParams, new Set());
        json(response, request, 200, { principal: authentication.principal });
        return;
      }
      if (requestUrl.pathname === "/api/v1/binaries") {
        requireOnly(requestUrl.searchParams, new Set(["limit", "offset"]));
        const limit = parsePositiveInteger(requestUrl.searchParams.get("limit"), 200, { min: 1, max: 500 });
        const offset = parsePositiveInteger(requestUrl.searchParams.get("offset"), 0, { min: 0, max: 1_000_000 });
        if (limit === null || offset === null) throw Object.assign(new Error("pagination is invalid"), { code: "INVALID_PAGINATION" });
        json(response, request, 200, versionBinaryUrls(await listConsultationBinaries(client, { workspaceRoot, limit, offset })));
        return;
      }
      if (requestUrl.pathname === "/api/v1/court-records") {
        json(response, request, 200, await queryCourtRecords(client, queryObject(requestUrl.searchParams)));
        return;
      }
      if (requestUrl.pathname === "/api/v1/references/lookup") {
        requireOnly(requestUrl.searchParams, new Set(["value", "scope", "lifecycle", "limit", "offset"]));
        const value = String(requestUrl.searchParams.get("value") ?? "").trim();
        if (!value) throw Object.assign(new Error("value is required"), { code: "REFERENCE_VALUE_REQUIRED" });
        const scope = requestUrl.searchParams.get("scope") ?? "full";
        const lifecycle = requestUrl.searchParams.get("lifecycle") ?? "current";
        if (!new Set(["full", "pilot"]).has(scope)) throw Object.assign(new Error("scope must be full or pilot"), { code: "INVALID_REFERENCE_SCOPE" });
        if (!new Set(["current", "include_history"]).has(lifecycle)) throw Object.assign(new Error("lifecycle is invalid"), { code: "INVALID_REFERENCE_LIFECYCLE" });
        const limit = parsePositiveInteger(requestUrl.searchParams.get("limit"), REFERENCE_LOOKUP_DEFAULT_LIMIT, { min: 1, max: REFERENCE_LOOKUP_MAX_LIMIT });
        const offset = parsePositiveInteger(requestUrl.searchParams.get("offset"), 0, { min: 0, max: REFERENCE_LOOKUP_MAX_OFFSET });
        if (limit === null || offset === null) throw Object.assign(new Error("pagination is invalid"), { code: "INVALID_PAGINATION" });
        json(response, request, 200, await lookupRecordedReferences(client, value, { scope, lifecycle, limit, offset }));
        return;
      }
      if (requestUrl.pathname === "/api/v1/search") {
        requireOnly(requestUrl.searchParams, new Set(["q", "scope", "sort", "limit", "offset"]));
        const query = String(requestUrl.searchParams.get("q") ?? "").trim();
        if (!query) throw Object.assign(new Error("q is required"), { code: "SEARCH_QUERY_REQUIRED" });
        const scope = requestUrl.searchParams.get("scope") ?? "full";
        const sort = requestUrl.searchParams.get("sort") ?? "relevance";
        if (!new Set(["full", "pilot"]).has(scope)) throw Object.assign(new Error("scope must be full or pilot"), { code: "INVALID_SEARCH_SCOPE" });
        if (!new Set(["relevance", "earliest_occurrence_asc", "latest_occurrence_desc"]).has(sort)) throw Object.assign(new Error("sort is invalid"), { code: "INVALID_SEARCH_SORT" });
        const limit = parsePositiveInteger(requestUrl.searchParams.get("limit"), 20, { min: 1, max: 100 });
        const offset = parsePositiveInteger(requestUrl.searchParams.get("offset"), 0, { min: 0 });
        if (limit === null || offset === null) throw Object.assign(new Error("pagination is invalid"), { code: "INVALID_PAGINATION" });
        json(response, request, 200, await searchReferencePilot(client, query, { scope, sort, limit, offset }));
        return;
      }
      const binaryDetail = /^\/api\/v1\/binaries\/([0-9a-fA-F]{64})$/u.exec(requestUrl.pathname);
      if (binaryDetail) {
        requireOnly(requestUrl.searchParams, new Set());
        const sha256 = binaryDetail[1].toLowerCase();
        if (!isValidSha256(sha256)) throw Object.assign(new Error("sha256 is invalid"), { code: "INVALID_SHA256" });
        json(response, request, 200, versionBinaryUrls(await getConsultationBinaryDetail(client, sha256, { workspaceRoot })));
        return;
      }
      if (/^\/api\/v1\/binaries\/[0-9a-f]{64}\/content$/u.test(requestUrl.pathname)) {
        requireOnly(requestUrl.searchParams, new Set());
        await proxyBinary({ request, response, requestUrl, gatewayUrl, internalToken });
        return;
      }
      const representation = /^\/api\/v1\/representations\/([0-9]+)\/content$/u.exec(requestUrl.pathname);
      if (representation) {
        requireOnly(requestUrl.searchParams, new Set(["format"]));
        const content = await getRepresentationContent(client, representation[1], requestUrl.searchParams.get("format") ?? "text", { workspaceRoot });
        if (content.contentType.startsWith("application/json")) json(response, request, 200, content.body);
        else text(response, request, 200, content.contentType, content.body);
        return;
      }
      errorResponse(response, request, 404, "NOT_FOUND", "route not found");
    } catch (error) {
      const mapped = mapReadError(error);
      const headers = mapped.status === 401 ? { "WWW-Authenticate": "Bearer" } : {};
      errorResponse(response, request, mapped.status, mapped.code, mapped.message, headers);
    }
  };
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const config = loadAuthV1Config();
  const [auth, openApiTemplate] = await Promise.all([
    createBffAuth({ config }),
    fs.promises.readFile(path.join(workspaceRoot, "release", "consultation-v1", "contracts", "openapi-v1.yaml"), "utf8").then(YAML.parse),
  ]);
  const openApi = materializeOpenApi(openApiTemplate, {
    apiPublicUrl: process.env.API_PUBLIC_URL,
    oidcMetadata: auth.metadata,
  });
  const client = createDbClient("consultation-api-v1");
  await client.connect();
  const handler = createConsultationV1Handler({
    client, auth, workspaceRoot,
    sitePublicUrl: process.env.SITE_PUBLIC_URL,
    gatewayUrl: process.env.INTERNAL_GATEWAY_URL ?? "http://gateway:8090",
    internalToken: process.env.INTERNAL_GATEWAY_TOKEN,
    openApi,
  });
  const server = createServer((request, response) => void handler(request, response));
  const host = process.env.CONSULTATION_API_HOST ?? "127.0.0.1";
  const port = Number(process.env.CONSULTATION_API_PORT ?? 8091);
  server.listen(port, host, () => console.log(`[consultation-api-v1] listening on ${host}:${port}`));
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("[consultation-api-v1] fatal startup error");
    process.exitCode = 1;
  });
}
