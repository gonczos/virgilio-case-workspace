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

export function createTextConsultationMcpServer({ callTool }) {
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
      try {
        return textResult(await callTool(tool.name, args));
      } catch (error) {
        return textResult(safeToolError(error), true);
      }
    });
  }
  return server;
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const client = createDbClient("text-consultation-mcp-v1");
  const lifecycle = attachClientLifecycleLogging(client, {
    logPrefix: "[text-consultation-mcp]",
    logger: console,
  });
  await client.connect();
  const server = createTextConsultationMcpServer({
    callTool: createTextConsultationMcpTools({ client, workspaceRoot }),
  });
  const shutdown = async () => {
    lifecycle.dispose();
    await server.close();
    await client.end();
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
