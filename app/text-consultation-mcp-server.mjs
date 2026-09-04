import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import {
  attachClientLifecycleLogging,
  createDbClient,
  getWorkspaceRoot,
  loadDotEnv,
} from "./processing-common.mjs";
import { createTextConsultationMcpTools } from "./text-consultation-mcp-tools.mjs";
import { createOperationalLogger, errorFields } from "./consultation-operational-logger.mjs";

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const TOOL_CONFIGS = [
  {
    name: "search_document_text",
    description: "Search existing indexed document text. Results preserve binary, representation, processor, location, and procedural context provenance.",
    inputSchema: {
      query: z.string().trim().min(1),
      scope: z.enum(["full", "pilot"]).default("full"),
      order: z.enum(["relevance", "earliest_occurrence_asc", "latest_occurrence_desc"]).default("relevance"),
      limit: z.number().int().min(1).max(20).default(10),
      offset: z.number().int().min(0).default(0),
    },
  },
  {
    name: "query_court_records",
    description: "Query occurrence-centred court metadata with explicit court, case, bucket, source-document, binary, and recorded-relation identities.",
    inputSchema: {
      court_id: z.number().int().min(1).optional(),
      case_file_id: z.number().int().min(1).optional(),
      bucket_id: z.number().int().min(1).optional(),
      bucket_document_id: z.number().int().min(1).optional(),
      document_id: z.number().int().min(1).optional(),
      file_binary_id: z.number().int().min(1).optional(),
      process_number: z.string().trim().min(1).optional(),
      occurrence_reference: z.string().trim().min(1).optional(),
      source_bucket_id: z.string().trim().min(1).optional(),
      source_document_reference: z.string().trim().min(1).optional(),
      document_name_contains: z.string().trim().min(1).optional(),
      document_type: z.string().trim().min(1).optional(),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
      binary_sha256: z.string().regex(/^[0-9a-fA-F]{64}$/u).optional(),
      file_availability: z.enum(["available", "missing"]).optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).max(1_000_000).default(0),
    },
  },
  {
    name: "get_binary_details",
    description: "Get read-only identity, procedural context, available representations, evidence, and processing summary for one SHA-256 binary.",
    inputSchema: {
      sha256: z.string().regex(/^[0-9a-fA-F]{64}$/u),
    },
  },
  {
    name: "get_representation_content",
    description: "Read one existing processor-attributed representation in an available format, with bounded content and exact lineage metadata.",
    inputSchema: {
      representation_id: z.number().int().min(1),
      format: z.enum(["text", "markdown", "complete-text", "native-json"]),
      offset: z.number().int().min(0).default(0),
      max_characters: z.number().int().min(1).max(50000).default(12000),
    },
  },
];

function safeToolError(error) {
  const safeCodes = new Set([
    "INVALID_ARGUMENTS", "UNKNOWN_ARGUMENT", "INVALID_ARGUMENT", "SEARCH_QUERY_REQUIRED",
    "INVALID_SEARCH_SCOPE", "INVALID_SEARCH_ORDER", "INVALID_SHA256",
      "INVALID_REPRESENTATION_ID", "INVALID_REPRESENTATION_FORMAT", "NOT_FOUND",
      "INVALID_COURT_RECORD_FILTER", "UNKNOWN_COURT_RECORD_FILTER",
    "UNKNOWN_TOOL", "representation_format_not_available", "invalid_representation_format",
  ]);
  const code = safeCodes.has(error?.code) ? error.code : "CONSULTATION_READ_FAILED";
  const message = code === "CONSULTATION_READ_FAILED"
    ? "The consultation read failed. Check the local server logs."
    : String(error.message ?? code);
  return { error: { code, message } };
}

function textResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError,
  };
}

export function createTextConsultationMcpServer({ callTool, operationalLogger = null }) {
  if (typeof callTool !== "function") throw new TypeError("callTool function is required");
  const server = new McpServer({
    name: "virgilio-text-consultation",
    version: "0.1.0",
  });
  for (const tool of TOOL_CONFIGS) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    }, async (args) => {
      const startedAt = performance.now();
      try {
        const result = await callTool(tool.name, args);
        operationalLogger?.info("tool_call_completed", {
          tool_name: tool.name, status: "success", duration_ms: Math.round(performance.now() - startedAt),
        });
        return textResult(result);
      } catch (error) {
        operationalLogger?.error("tool_call_completed", {
          tool_name: tool.name, status: "error", duration_ms: Math.round(performance.now() - startedAt),
          ...errorFields(error),
        });
        return textResult(safeToolError(error), true);
      }
    });
  }
  return server;
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const operationalLogger = createOperationalLogger({ service: "text-consultation-mcp-stdio" });
  const client = createDbClient("text-consultation-mcp-v1");
  const lifecycle = attachClientLifecycleLogging(client, {
    logPrefix: "[text-consultation-mcp]",
    logger: console,
  });
  await client.connect();
  const server = createTextConsultationMcpServer({
    callTool: createTextConsultationMcpTools({ client, workspaceRoot }),
    operationalLogger,
  });
  const shutdown = async () => {
    lifecycle.dispose();
    await server.close();
    await client.end();
    await operationalLogger.close();
  };
  process.once("SIGINT", () => { shutdown().finally(() => { process.exitCode = 130; }); });
  process.once("SIGTERM", () => { shutdown().finally(() => { process.exitCode = 143; }); });
  await server.connect(new StdioServerTransport());
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[text-consultation-mcp] fatal startup error");
    console.error(error);
    process.exitCode = 1;
  });
}
