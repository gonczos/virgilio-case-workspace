import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
  attachClientLifecycleLogging,
  createDbClient,
  getWorkspaceRoot,
  loadDotEnv,
} from "./processing-common.mjs";
import { createTextConsultationMcpServer } from "./text-consultation-mcp-server.mjs";
import { createTextConsultationMcpTools } from "./text-consultation-mcp-tools.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8092;
const MAX_REQUEST_BYTES = 256 * 1024;

function json(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function normalizeHost(value) {
  const host = String(value ?? "").trim().toLowerCase();
  const bracketed = /^\[([^\]]+)\](?::[0-9]+)?$/u.exec(host);
  if (bracketed) return bracketed[1];
  if ((host.match(/:/gu) ?? []).length > 1) return host;
  return host.split(":", 1)[0];
}

function parseAllowedHosts(value, bindHost) {
  const configured = String(value ?? "").split(",").map(normalizeHost).filter(Boolean);
  return new Set([...configured, normalizeHost(bindHost), "localhost", "127.0.0.1", "::1"]);
}

function assertPrivateHttpConfiguration({ token, bindHost }) {
  if (typeof token !== "string" || token.length < 32) {
    throw new Error("TEXT_CONSULTATION_MCP_HTTP_TOKEN must contain at least 32 characters");
  }
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(normalizeHost(bindHost))) {
    throw new Error("TEXT_CONSULTATION_MCP_HTTP_HOST must be a loopback host");
  }
}

async function readJsonBody(request, maximumBytes = MAX_REQUEST_BYTES) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    const error = new Error("request body exceeds the configured limit");
    error.code = "REQUEST_TOO_LARGE";
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error("request body exceeds the configured limit");
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("request body must be valid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function createTextConsultationMcpHttpHandler({
  callTool,
  token,
  bindHost = DEFAULT_HOST,
  allowedHosts,
  maximumRequestBytes = MAX_REQUEST_BYTES,
}) {
  if (typeof callTool !== "function") throw new TypeError("callTool function is required");
  assertPrivateHttpConfiguration({ token, bindHost });
  const permittedHosts = parseAllowedHosts(allowedHosts, bindHost);

  return async function handler(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (!permittedHosts.has(normalizeHost(request.headers.host))) {
      json(response, 403, { error: { code: "HOST_NOT_ALLOWED", message: "request host is not allowed" } });
      return;
    }
    const authorization = String(request.headers.authorization ?? "");
    const expected = `Bearer ${token}`;
    if (!safeEqual(authorization, expected)) {
      json(response, 401, { error: { code: "UNAUTHORIZED", message: "valid bearer token required" } }, {
        "WWW-Authenticate": "Bearer",
      });
      return;
    }
    if (requestUrl.pathname === "/health" && request.method === "GET") {
      json(response, 200, { status: "ok", service: "virgilio-text-consultation-mcp", version: "v1" });
      return;
    }
    if (requestUrl.pathname !== "/mcp") {
      json(response, 404, { error: { code: "NOT_FOUND", message: "route not found" } });
      return;
    }
    if (request.method !== "POST") {
      json(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "only POST is supported" } }, { Allow: "POST" });
      return;
    }

    const mcpServer = createTextConsultationMcpServer({ callTool });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await transport.close();
      await mcpServer.close();
    };
    response.once("close", () => { void close(); });
    try {
      const body = await readJsonBody(request, maximumRequestBytes);
      await mcpServer.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch (error) {
      if (!response.headersSent) {
        const tooLarge = error?.code === "REQUEST_TOO_LARGE";
        json(response, tooLarge ? 413 : 400, {
          error: {
            code: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST",
            message: tooLarge ? "request body exceeds the configured limit" : "request could not be processed",
          },
        });
      }
      await close();
    }
  };
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const host = process.env.TEXT_CONSULTATION_MCP_HTTP_HOST ?? DEFAULT_HOST;
  const port = Number(process.env.TEXT_CONSULTATION_MCP_HTTP_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("TEXT_CONSULTATION_MCP_HTTP_PORT is invalid");
  const token = process.env.TEXT_CONSULTATION_MCP_HTTP_TOKEN;
  assertPrivateHttpConfiguration({ token, bindHost: host });
  const client = createDbClient("text-consultation-mcp-http-v1");
  const lifecycle = attachClientLifecycleLogging(client, { logPrefix: "[text-consultation-mcp-http]", logger: console });
  let connected = false;
  let httpServer = null;
  const shutdown = () => new Promise((resolve) => {
    if (!httpServer?.listening) return resolve();
    httpServer.close(resolve);
  }).finally(async () => {
    lifecycle.dispose();
    if (connected) await client.end();
  });
  try {
    await client.connect();
    connected = true;
    const handler = createTextConsultationMcpHttpHandler({
      callTool: createTextConsultationMcpTools({ client, workspaceRoot }),
      token,
      bindHost: host,
      allowedHosts: process.env.TEXT_CONSULTATION_MCP_HTTP_ALLOWED_HOSTS,
    });
    httpServer = createServer((request, response) => {
      void handler(request, response).catch(() => {
        if (!response.headersSent) json(response, 500, { error: { code: "INTERNAL_ERROR", message: "request failed" } });
      });
    });
    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, host, resolve);
    });
    process.once("SIGINT", () => { void shutdown().finally(() => { process.exitCode = 130; }); });
    process.once("SIGTERM", () => { void shutdown().finally(() => { process.exitCode = 143; }); });
    console.error(`[text-consultation-mcp-http] listening on http://${host}:${port}/mcp`);
  } catch (error) {
    await shutdown();
    throw error;
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[text-consultation-mcp-http] fatal startup error");
    console.error(error);
    process.exitCode = 1;
  });
}
