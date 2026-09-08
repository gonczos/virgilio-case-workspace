import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { getConsultationBinaryDetail, getRepresentationContent, listConsultationBinaries } from "./consultation-store.mjs";
import { queryCourtRecords } from "./court-records-api.mjs";
import { createDbClient, getWorkspaceRoot, loadDotEnv } from "./processing-common.mjs";
import { lookupRecordedReferences } from "./reference-observation-api.mjs";
import { searchReferencePilot } from "./reference-index-pilot.mjs";
import { createTextConsultationMcpTools } from "./text-consultation-mcp-tools.mjs";

const FIXTURE_PATH = path.join("release", "consultation-v1", "contracts", "golden-v1.json");
const SAMPLE_SHA256 = "02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e";
const SAMPLE_REPRESENTATION_ID = 1;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function jsonText(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
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

async function capturedError(operation) {
  try {
    await operation();
    throw new Error("expected operation to fail");
  } catch (error) {
    if (error.message === "expected operation to fail") throw error;
    return { error: { code: String(error.code ?? "CONSULTATION_READ_FAILED"), message: String(error.message) } };
  }
}

export async function buildGoldenFixture(client, workspaceRoot) {
  const callMcp = createTextConsultationMcpTools({ client, workspaceRoot });
  const representation = await getRepresentationContent(client, SAMPLE_REPRESENTATION_ID, "text", { workspaceRoot });
  const http = {
    "GET /api/v1/health": {
      status: 200,
      headers: { "cache-control": "private, no-store", "content-type": "application/json; charset=utf-8" },
      body: { status: "ok", service: "virgilio-consultation-api", contract_version: "v1" },
    },
    "GET /api/v1/binaries?limit=1&offset=0": versionBinaryUrls(await listConsultationBinaries(client, {
      workspaceRoot, limit: 1, offset: 0,
    })),
    [`GET /api/v1/binaries/${SAMPLE_SHA256}`]: versionBinaryUrls(await getConsultationBinaryDetail(
      client, SAMPLE_SHA256, { workspaceRoot },
    )),
    "GET /api/v1/court-records?case_file_id=1&limit=1&offset=0": await queryCourtRecords(client, {
      case_file_id: 1, limit: 1, offset: 0,
    }),
    "GET /api/v1/references/lookup?value=13608%2F14.8T2SNT&scope=full&lifecycle=current&limit=1&offset=0":
      await lookupRecordedReferences(client, "13608/14.8T2SNT", {
        scope: "full", lifecycle: "current", limit: 1, offset: 0,
      }),
    "GET /api/v1/search?q=tribunal&scope=full&sort=relevance&limit=1&offset=0":
      await searchReferencePilot(client, "tribunal", { scope: "full", sort: "relevance", limit: 1, offset: 0 }),
    [`GET /api/v1/representations/${SAMPLE_REPRESENTATION_ID}/content?format=text`]: {
      status: 200,
      content_type: representation.contentType,
      utf8_bytes: Buffer.byteLength(representation.body, "utf8"),
      content_sha256: sha256Text(representation.body),
    },
    "error invalid sha256": { status: 400, body: { error: { code: "INVALID_SHA256", message: "sha256 must contain 64 hexadecimal characters" } } },
    "error not found": { status: 404, body: { error: { code: "NOT_FOUND", message: "requested object was not found" } } },
    "error unauthorized": { status: 401, body: { error: { code: "UNAUTHORIZED", message: "authentication required" } } },
    "error forbidden": { status: 403, body: { error: { code: "FORBIDDEN", message: "consultation.read is required" } } },
    "error login rate limited": {
      status: 429,
      headers: { "retry-after": "60" },
      body: { error: { code: "LOGIN_RATE_LIMITED", message: "too many login requests" } },
    },
  };
  const mcp = {
    search_document_text: await callMcp("search_document_text", {
      query: "tribunal", scope: "full", order: "relevance", limit: 1, offset: 0,
    }),
    query_court_records: await callMcp("query_court_records", { case_file_id: 1, limit: 1, offset: 0 }),
    get_binary_details: await callMcp("get_binary_details", { sha256: SAMPLE_SHA256 }),
    get_representation_content: await callMcp("get_representation_content", {
      representation_id: SAMPLE_REPRESENTATION_ID, format: "text", offset: 0, max_characters: 200,
    }),
    error_unknown_argument: await capturedError(() => callMcp("search_document_text", { query: "tribunal", extra: true })),
    error_invalid_sha256: await capturedError(() => callMcp("get_binary_details", { sha256: "bad" })),
  };
  return {
    fixture_kind: "consultation_v1_wire_contract_golden",
    fixture_version: "1.0.0",
    application_contract_version: "v1",
    sample_identity: { sha256: SAMPLE_SHA256, representation_id: SAMPLE_REPRESENTATION_ID, case_file_id: 1 },
    http,
    mcp,
  };
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const client = createDbClient("consultation-v1-contract-fixtures");
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const fixture = await buildGoldenFixture(client, workspaceRoot);
    await client.query("COMMIT");
    const outputPath = path.join(workspaceRoot, FIXTURE_PATH);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, jsonText(fixture), "utf8");
    console.log(JSON.stringify({ output: FIXTURE_PATH, sha256: sha256Text(jsonText(fixture)) }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[release-v1-contract-fixtures] ${error.message}`);
    process.exitCode = 1;
  });
}
