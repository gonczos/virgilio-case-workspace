import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { bearerChallenge, createBearerAuth, isAuthError, loadAuthV1Config, oauthProtectedResourceMetadata } from "./auth-v1.mjs";
import { createOperationalLogger, errorFields } from "./consultation-operational-logger.mjs";
import { attachClientLifecycleLogging, createDbClient, getWorkspaceRoot, loadDotEnv } from "./processing-common.mjs";
import { createTextConsultationMcpServer } from "./text-consultation-mcp-server.mjs";
import { createTextConsultationMcpTools } from "./text-consultation-mcp-tools.mjs";

const MAX_REQUEST_BYTES = 256 * 1024;
const PRIVATE_CACHE_CONTROL = "private, no-store";

function json(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": PRIVATE_CACHE_CONTROL, ...headers });
  response.end(JSON.stringify(body));
}

function normalizeHost(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  try { return new URL(`http://${raw}`).hostname.toLowerCase(); }
  catch { return ""; }
}

function allowedHostSet(value, publicUrl) {
  return new Set([
    new URL(publicUrl).hostname.toLowerCase(), "localhost", "127.0.0.1", "::1",
    ...String(value ?? "").split(",").map(normalizeHost).filter(Boolean),
  ]);
}

async function readJsonBody(request, maximumBytes = MAX_REQUEST_BYTES) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > maximumBytes) throw Object.assign(new Error("request too large"), { code: "REQUEST_TOO_LARGE" });
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maximumBytes) throw Object.assign(new Error("request too large"), { code: "REQUEST_TOO_LARGE" });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("request must contain valid JSON"), { code: "INVALID_JSON" }); }
}

export function createMcpV1HttpHandler({
  callTool,
  auth,
  publicUrl,
  issuer,
  requiredScope = "consultation.read",
  allowedHosts,
  operationalLogger = null,
}) {
  const resource = new URL(publicUrl).toString().replace(/\/$/u, "");
  if (!resource.endsWith("/mcp/v1")) throw new Error("MCP_PUBLIC_URL must end with /mcp/v1");
  const metadataPath = "/.well-known/oauth-protected-resource/mcp/v1";
  const metadataUrl = `${new URL(resource).origin}${metadataPath}`;
  const metadata = oauthProtectedResourceMetadata({ resource, issuer, scope: requiredScope });
  const permittedHosts = allowedHostSet(allowedHosts, resource);
  return async function handler(request, response) {
    const requestUrl = new URL(request.url ?? "/", resource);
    if (!permittedHosts.has(normalizeHost(request.headers.host))) {
      json(response, 403, { error: { code: "HOST_NOT_ALLOWED", message: "request host is not allowed" } });
      return;
    }
    if ((requestUrl.pathname === metadataPath || requestUrl.pathname === "/.well-known/oauth-protected-resource") && request.method === "GET") {
      json(response, 200, metadata);
      return;
    }
    if (requestUrl.pathname === "/mcp/v1/health" && request.method === "GET") {
      json(response, 200, { status: "ok", service: "virgilio-consultation-mcp", contract_version: "v1" });
      return;
    }
    if (requestUrl.pathname !== "/mcp/v1") {
      json(response, 404, { error: { code: "NOT_FOUND", message: "route not found" } });
      return;
    }
    if (request.method !== "POST") {
      json(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "only POST is supported" } }, { Allow: "POST" });
      return;
    }
    try {
      await auth.authenticate(request);
    } catch (error) {
      const forbidden = isAuthError(error) && error.statusCode === 403;
      json(response, forbidden ? 403 : 401, { error: { code: error.code ?? "UNAUTHORIZED", message: error.message ?? "authentication required" } }, {
        "WWW-Authenticate": bearerChallenge(metadataUrl, requiredScope),
      });
      return;
    }
    response.setHeader("Cache-Control", PRIVATE_CACHE_CONTROL);
    const mcpServer = createTextConsultationMcpServer({ callTool, operationalLogger, serverName: "virgilio-consultation-mcp-v1", serverVersion: "1.0.0" });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await transport.close();
      await mcpServer.close();
    };
    response.once("close", () => void close());
    try {
      const body = await readJsonBody(request);
      await mcpServer.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch (error) {
      operationalLogger?.error("mcp_v1_request_failed", errorFields(error));
      if (!response.headersSent) {
        const tooLarge = error?.code === "REQUEST_TOO_LARGE";
        json(response, tooLarge ? 413 : 400, { error: {
          code: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST",
          message: tooLarge ? "request exceeds the configured limit" : "request could not be processed",
        } });
      }
      await close();
    }
  };
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const config = loadAuthV1Config();
  const publicUrl = String(process.env.MCP_PUBLIC_URL ?? "");
  const auth = await createBearerAuth({ config, audience: config.mcpAudience });
  const client = createDbClient("consultation-mcp-v1");
  const lifecycle = attachClientLifecycleLogging(client, { logPrefix: "[consultation-mcp-v1]", logger: console });
  await client.connect();
  const operationalLogger = createOperationalLogger({
    service: "consultation-mcp-v1",
    logPath: path.resolve(workspaceRoot, process.env.MCP_LOG_PATH ?? "data/processing-runtime/consultation-mcp-v1.log"),
  });
  const handler = createMcpV1HttpHandler({
    callTool: createTextConsultationMcpTools({ client, workspaceRoot }),
    auth,
    publicUrl,
    issuer: config.issuer,
    requiredScope: config.requiredScope,
    allowedHosts: process.env.MCP_ALLOWED_HOSTS,
    operationalLogger,
  });
  const server = createServer((request, response) => void handler(request, response));
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = Number(process.env.MCP_PORT ?? 8092);
  server.listen(port, host, () => console.log(`[consultation-mcp-v1] listening on ${host}:${port}/mcp/v1`));
  const shutdown = () => new Promise((resolve) => server.close(resolve)).finally(async () => {
    lifecycle.dispose();
    await client.end();
    await operationalLogger.close();
  });
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("[consultation-mcp-v1] fatal startup error");
    process.exitCode = 1;
  });
}
