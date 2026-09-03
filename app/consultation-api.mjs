import process from "node:process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDbClient,
  getWorkspaceRoot,
  loadDotEnv,
} from "./processing-common.mjs";
import {
  getExtractionCoverageReport,
  getConsultationBinaryDetail,
  getRepresentationContent,
  isValidSha256,
  listConsultationBinaries,
  parsePositiveInteger,
} from "./consultation-store.mjs";
import {
  isRepresentationArtifactError,
} from "./representation-artifacts.mjs";
import {
  lookupReferencePilot,
  searchReferencePilot,
} from "./reference-index-pilot.mjs";
import {
  REFERENCE_LOOKUP_DEFAULT_LIMIT,
  REFERENCE_LOOKUP_MAX_LIMIT,
  REFERENCE_LOOKUP_MAX_OFFSET,
  lookupRecordedReferences,
} from "./reference-observation-api.mjs";

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, contentType, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", contentType);
  response.end(body);
}

function sendContractError(response, code, message) {
  sendJson(response, 400, { error: { code, message } });
}

const REFERENCE_LOOKUP_PARAMETERS = new Set(["value", "scope", "lifecycle", "limit", "offset"]);

export function parseRecordedReferenceLookup(searchParams) {
  for (const key of searchParams.keys()) {
    if (!REFERENCE_LOOKUP_PARAMETERS.has(key)) {
      return { error: ["UNKNOWN_QUERY_PARAMETER", `unknown query parameter: ${key}`] };
    }
    if (searchParams.getAll(key).length > 1) {
      return { error: ["DUPLICATE_QUERY_PARAMETER", `${key} must be supplied at most once`] };
    }
  }
  if (!searchParams.has("value")) {
    return { error: ["REFERENCE_VALUE_REQUIRED", "value is required"] };
  }
  const value = searchParams.get("value") ?? "";
  if (!value.trim()) {
    return { error: ["INVALID_REFERENCE_VALUE", "value must contain a reference"] };
  }
  const scope = searchParams.get("scope") ?? "full";
  if (!["pilot", "full"].includes(scope)) {
    return { error: ["INVALID_REFERENCE_SCOPE", "scope must be pilot or full"] };
  }
  const lifecycle = searchParams.get("lifecycle") ?? "current";
  if (!["current", "include_history"].includes(lifecycle)) {
    return { error: ["INVALID_REFERENCE_LIFECYCLE", "lifecycle must be current or include_history"] };
  }
  const limit = parsePositiveInteger(searchParams.get("limit"), REFERENCE_LOOKUP_DEFAULT_LIMIT, {
    min: 1, max: REFERENCE_LOOKUP_MAX_LIMIT,
  });
  if (limit === null) {
    return { error: ["INVALID_REFERENCE_LIMIT", `limit must be an integer from 1 through ${REFERENCE_LOOKUP_MAX_LIMIT}`] };
  }
  const offset = parsePositiveInteger(searchParams.get("offset"), 0, {
    min: 0, max: REFERENCE_LOOKUP_MAX_OFFSET,
  });
  if (offset === null) {
    return { error: ["INVALID_REFERENCE_OFFSET", `offset must be an integer from 0 through ${REFERENCE_LOOKUP_MAX_OFFSET}`] };
  }
  return { value, scope, lifecycle, limit, offset };
}

function mapConsultationError(error) {
  switch (error?.code) {
    case "INVALID_SHA256":
      return { statusCode: 400, payload: { error: "invalid_sha256" } };
    case "INVALID_REPRESENTATION_ID":
      return { statusCode: 400, payload: { error: "invalid_representation_id" } };
    case "INVALID_REPRESENTATION_FORMAT":
      return { statusCode: 400, payload: { error: "invalid_representation_format" } };
    case "NOT_FOUND":
      if (String(error.message).includes("file_binary")) {
        return { statusCode: 404, payload: { error: "binary_not_found" } };
      }
      if (String(error.message).includes("document_representation")) {
        return { statusCode: 404, payload: { error: "representation_not_found" } };
      }
      return { statusCode: 404, payload: { error: "not_found" } };
    default:
      if (isRepresentationArtifactError(error)) {
        if (error.code === "invalid_representation_format") {
          return { statusCode: 400, payload: { error: "invalid_representation_format" } };
        }
        if (error.code === "representation_format_not_available") {
          return { statusCode: 404, payload: { error: "representation_format_not_available" } };
        }
        return { statusCode: 500, payload: { error: "representation_artifact_failed" } };
      }
      return { statusCode: 500, payload: { error: "consultation_query_failed" } };
  }
}

export function createConsultationHandler({ client, workspaceRoot = getWorkspaceRoot() }) {
  return async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (requestUrl.pathname === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 404, { error: "not_found" });
        return;
      }

      if (requestUrl.pathname === "/api/consultation/binaries") {
        const limit = parsePositiveInteger(requestUrl.searchParams.get("limit"), 200, { min: 1, max: 500 });
        const offset = parsePositiveInteger(requestUrl.searchParams.get("offset"), 0, { min: 0, max: 1000000 });
        if (limit === null || offset === null) {
          sendJson(response, 400, { error: "invalid_pagination" });
          return;
        }
        const payload = await listConsultationBinaries(client, {
          workspaceRoot,
          limit,
          offset,
        });
        sendJson(response, 200, payload);
        return;
      }

      if (requestUrl.pathname === "/api/consultation/reports/extraction-coverage") {
        const payload = await getExtractionCoverageReport(client);
        sendJson(response, 200, payload);
        return;
      }

      if (requestUrl.pathname === "/api/consultation/references/lookup") {
        try {
          decodeURIComponent((request.url ?? "").split("?", 2)[1] ?? "");
        } catch {
          sendContractError(response, "INVALID_REFERENCE_VALUE", "query parameters must be valid percent-encoded UTF-8");
          return;
        }
        const parsed = parseRecordedReferenceLookup(requestUrl.searchParams);
        if (parsed.error) {
          sendContractError(response, parsed.error[0], parsed.error[1]);
          return;
        }
        sendJson(response, 200, await lookupRecordedReferences(client, parsed.value, parsed));
        return;
      }

      if (requestUrl.pathname === "/api/consultation/reference-pilot/search") {
        const query = requestUrl.searchParams.get("q")?.trim() ?? "";
        const scope = requestUrl.searchParams.get("scope") ?? "pilot";
        const sort = requestUrl.searchParams.get("sort") ?? "relevance";
        const limit = parsePositiveInteger(requestUrl.searchParams.get("limit"), 20, { min: 1, max: 100 });
        const offset = parsePositiveInteger(requestUrl.searchParams.get("offset"), 0, { min: 0 });
        if (!query) {
          sendJson(response, 400, { error: "search_query_required" });
          return;
        }
        if (limit === null || offset === null) {
          sendJson(response, 400, { error: "invalid_pagination" });
          return;
        }
        if (scope !== "pilot" && scope !== "full") {
          sendJson(response, 400, { error: "invalid_search_scope" });
          return;
        }
        if (!["relevance", "earliest_occurrence_asc", "latest_occurrence_desc"].includes(sort)) {
          sendJson(response, 400, { error: "invalid_search_sort" });
          return;
        }
        sendJson(response, 200, await searchReferencePilot(client, query, {
          limit,
          offset,
          scope,
          sort,
        }));
        return;
      }

      const referenceMatch = requestUrl.pathname.match(/^\/api\/consultation\/reference-pilot\/references\/(.+)$/u);
      if (referenceMatch) {
        let value;
        try {
          value = decodeURIComponent(referenceMatch[1]).trim();
        } catch {
          sendJson(response, 400, { error: "invalid_reference_value" });
          return;
        }
        if (!value) {
          sendJson(response, 400, { error: "reference_value_required" });
          return;
        }
        sendJson(response, 200, await lookupReferencePilot(client, value));
        return;
      }

      const detailMatch = requestUrl.pathname.match(/^\/api\/consultation\/binaries\/([0-9a-fA-F]{64})$/u);
      if (detailMatch) {
        const normalizedSha256 = detailMatch[1].toLowerCase();
        if (!isValidSha256(normalizedSha256)) {
          sendJson(response, 400, { error: "invalid_sha256" });
          return;
        }
        const payload = await getConsultationBinaryDetail(client, normalizedSha256, { workspaceRoot });
        sendJson(response, 200, payload);
        return;
      }

      const representationMatch = requestUrl.pathname.match(/^\/api\/consultation\/representations\/([0-9]+)\/content$/u);
      if (representationMatch) {
        const format = requestUrl.searchParams.get("format");
        const content = await getRepresentationContent(client, representationMatch[1], format, { workspaceRoot });
        if (request.method === "HEAD") {
          response.statusCode = 200;
          response.setHeader("Content-Type", content.contentType);
          response.end();
          return;
        }
        if (content.contentType.startsWith("application/json")) {
          sendJson(response, 200, content.body);
          return;
        }
        sendText(response, 200, content.contentType, content.body);
        return;
      }

      if (requestUrl.pathname.startsWith("/api/consultation/binaries/")) {
        sendJson(response, 400, { error: "invalid_sha256" });
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      const mapped = mapConsultationError(error);
      sendJson(response, mapped.statusCode, mapped.payload);
    }
  };
}

export function createConsultationServer(options) {
  return createServer(createConsultationHandler(options));
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const client = createDbClient("consultation-api");
  await client.connect();
  const server = createConsultationServer({
    client,
    workspaceRoot,
  });
  const port = process.env.CONSULTATION_API_PORT ? Number(process.env.CONSULTATION_API_PORT) : 8091;
  server.listen(port, () => {
    console.log(`[consultation-api] listening on ${port}`);
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[consultation-api] fatal error");
    console.error(error);
    process.exitCode = 1;
  });
}
