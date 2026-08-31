import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Client } from "pg";

import { isBinaryStoreError, LocalBinaryStore } from "./binary-store.mjs";

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function getBinaryRowBySha(client, sha256) {
  const result = await client.query(
    `
      SELECT
        id,
        sha256,
        mime_type,
        file_extension,
        storage_package_id,
        storage_rel_path,
        actual_size_bytes
      FROM casework.file_binary
      WHERE sha256 = $1
    `,
    [sha256],
  );
  return result.rows[0] ?? null;
}

function mapBinaryStoreErrorToHttp(binaryStoreError, sha256) {
  switch (binaryStoreError.code) {
    case "binary_missing":
      return { statusCode: 404, payload: { error: "binary_file_missing", sha256 } };
    case "binary_locator_invalid":
      if (String(binaryStoreError.message).includes("does not have a resolvable storage path")) {
        return { statusCode: 404, payload: { error: "binary_path_unavailable", sha256 } };
      }
      return { statusCode: 400, payload: { error: "invalid_storage_path", sha256 } };
    case "binary_size_mismatch":
    case "binary_sha256_mismatch":
      return { statusCode: 500, payload: { error: "binary_materialization_failed", sha256 } };
    default:
      return { statusCode: 500, payload: { error: "binary_materialization_failed", sha256 } };
  }
}

function releaseAfterResponse(response, materializedBinary) {
  let released = false;
  const release = async () => {
    if (released) {
      return;
    }
    released = true;
    try {
      await materializedBinary.release();
    } catch (error) {
      console.error("[gateway] failed to release materialized binary");
      console.error(error);
    }
  };
  response.on("close", () => {
    void release();
  });
  return release;
}

export function createGatewayHandler({ client, binaryStore }) {
  return async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (requestUrl.pathname === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      const match = requestUrl.pathname.match(/^\/binary\/([0-9a-f]{64})$/u);
      if (!match) {
        sendJson(response, 404, { error: "not_found" });
        return;
      }

      const sha256 = match[1];
      const row = await getBinaryRowBySha(client, sha256);
      if (!row) {
        sendJson(response, 404, { error: "binary_not_found", sha256 });
        return;
      }

      let materializedBinary;
      try {
        materializedBinary = await binaryStore.materialize(row);
      } catch (error) {
        if (isBinaryStoreError(error)) {
          const mapped = mapBinaryStoreErrorToHttp(error, sha256);
          sendJson(response, mapped.statusCode, mapped.payload);
          return;
        }
        throw error;
      }

      const release = releaseAfterResponse(response, materializedBinary);
      response.statusCode = 200;
      response.setHeader("Content-Type", row.mime_type ?? "application/octet-stream");
      response.setHeader("Content-Length", String(row.actual_size_bytes));
      const extension = row.file_extension ? String(row.file_extension).replace(/^\./u, "") : "bin";
      response.setHeader("Content-Disposition", `inline; filename="${sha256}.${extension}"`);

      if (request.method === "HEAD") {
        response.end();
        await release();
        return;
      }

      const stream = fs.createReadStream(materializedBinary.localPath);
      stream.on("error", (error) => {
        console.error("[gateway] failed while streaming binary response");
        console.error(error);
        response.destroy(error);
      });
      stream.pipe(response);
    } catch (error) {
      sendJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function createGatewayServer({ client, binaryStore }) {
  return createServer(createGatewayHandler({ client, binaryStore }));
}

export async function main() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(moduleDir, "..");
  loadDotEnv(path.join(workspaceRoot, ".env"));

  const client = new Client({
    host: process.env.PGHOST ?? "db",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.POSTGRES_DB ?? process.env.PGDATABASE,
    user: process.env.POSTGRES_USER ?? process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD,
  });
  await client.connect();

  const server = createGatewayServer({
    client,
    binaryStore: new LocalBinaryStore({ workspaceRoot }),
  });
  const port = process.env.FILE_GATEWAY_PORT ? Number(process.env.FILE_GATEWAY_PORT) : 8090;
  server.listen(port, () => {
    console.log(`[gateway] listening on ${port}`);
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[gateway] fatal error");
    console.error(error);
    process.exitCode = 1;
  });
}
