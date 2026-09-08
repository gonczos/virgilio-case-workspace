import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { isBinaryStoreError, LocalBinaryStore } from "./binary-store.mjs";
import { createDbClient, getWorkspaceRoot, loadDotEnv } from "./processing-common.mjs";

const CONTENT_ROUTE = /^\/internal\/v1\/binaries\/([0-9a-f]{64})\/content$/u;

function json(response, request, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(request.method === "HEAD" ? undefined : JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function binaryRow(client, sha256) {
  const result = await client.query(`
    SELECT id, sha256, mime_type, file_extension, storage_package_id,
           storage_rel_path, actual_size_bytes
    FROM casework.file_binary WHERE sha256 = $1
  `, [sha256]);
  return result.rows[0] ?? null;
}

function mapStoreError(error) {
  if (error.code === "binary_missing") return [404, "BINARY_FILE_MISSING"];
  if (error.code === "binary_locator_invalid") return [404, "BINARY_PATH_UNAVAILABLE"];
  return [500, "BINARY_MATERIALIZATION_FAILED"];
}

export function createFileGatewayV1Handler({ client, binaryStore, internalToken }) {
  if (String(internalToken ?? "").length < 32) throw new Error("INTERNAL_GATEWAY_TOKEN must contain at least 32 characters");
  return async function handler(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://internal");
    if (requestUrl.pathname === "/internal/v1/health" && request.method === "GET") {
      json(response, request, 200, { status: "ok", service: "virgilio-file-gateway", contract_version: "v1" });
      return;
    }
    if (!new Set(["GET", "HEAD"]).has(request.method)) {
      response.setHeader("Allow", "GET, HEAD");
      json(response, request, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "only GET and HEAD are supported" } });
      return;
    }
    if (!safeEqual(request.headers.authorization, `Bearer ${internalToken}`)) {
      response.setHeader("WWW-Authenticate", "Bearer");
      json(response, request, 401, { error: { code: "UNAUTHORIZED", message: "valid internal bearer token required" } });
      return;
    }
    const match = CONTENT_ROUTE.exec(requestUrl.pathname);
    if (!match) {
      json(response, request, 404, { error: { code: "NOT_FOUND", message: "route not found" } });
      return;
    }
    try {
      const row = await binaryRow(client, match[1]);
      if (!row) {
        json(response, request, 404, { error: { code: "BINARY_NOT_FOUND", message: "binary not found" } });
        return;
      }
      let materialized;
      try {
        materialized = await binaryStore.materialize(row);
      } catch (error) {
        if (!isBinaryStoreError(error)) throw error;
        const [status, code] = mapStoreError(error);
        json(response, request, status, { error: { code, message: "binary could not be materialized" } });
        return;
      }
      response.statusCode = 200;
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("Content-Type", row.mime_type ?? "application/octet-stream");
      response.setHeader("Content-Length", String(row.actual_size_bytes));
      const extension = String(row.file_extension ?? "bin").replace(/^\./u, "");
      response.setHeader("Content-Disposition", `inline; filename="${row.sha256}.${extension}"`);
      if (request.method === "HEAD") {
        response.end();
        await materialized.release();
        return;
      }
      const stream = fs.createReadStream(materialized.localPath);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        void materialized.release();
      };
      stream.once("error", () => response.destroy());
      response.once("close", release);
      response.once("finish", release);
      stream.pipe(response);
    } catch {
      json(response, request, 500, { error: { code: "INTERNAL_ERROR", message: "binary request failed" } });
    }
  };
}

export async function main() {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const client = createDbClient("file-gateway-v1");
  await client.connect();
  const handler = createFileGatewayV1Handler({
    client,
    binaryStore: new LocalBinaryStore({ workspaceRoot }),
    internalToken: process.env.INTERNAL_GATEWAY_TOKEN,
  });
  const server = createServer((request, response) => void handler(request, response));
  const host = process.env.FILE_GATEWAY_HOST ?? "127.0.0.1";
  const port = Number(process.env.FILE_GATEWAY_PORT ?? 8090);
  server.listen(port, host, () => console.log(`[file-gateway-v1] listening on ${host}:${port}`));
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("[file-gateway-v1] fatal startup error");
    process.exitCode = 1;
  });
}
