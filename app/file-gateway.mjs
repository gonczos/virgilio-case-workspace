import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Client } from "pg";

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

async function main() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(moduleDir, "..");
  const importsRoot = path.join(workspaceRoot, "data", "imports");
  loadDotEnv(path.join(workspaceRoot, ".env"));

  const client = new Client({
    host: process.env.PGHOST ?? "db",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.POSTGRES_DB ?? process.env.PGDATABASE,
    user: process.env.POSTGRES_USER ?? process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD,
  });
  await client.connect();

  const port = process.env.FILE_GATEWAY_PORT ? Number(process.env.FILE_GATEWAY_PORT) : 8090;

  const server = createServer(async (request, response) => {
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
      const result = await client.query(
        `
          SELECT
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

      if (result.rowCount !== 1) {
        sendJson(response, 404, { error: "binary_not_found", sha256 });
        return;
      }

      const row = result.rows[0];
      if (!row.storage_package_id || !row.storage_rel_path) {
        sendJson(response, 404, { error: "binary_path_unavailable", sha256 });
        return;
      }

      const resolvedPath = path.resolve(importsRoot, row.storage_package_id, row.storage_rel_path);
      const allowedRoot = path.resolve(importsRoot);
      if (!resolvedPath.startsWith(allowedRoot)) {
        sendJson(response, 400, { error: "invalid_storage_path", sha256 });
        return;
      }

      if (!fs.existsSync(resolvedPath)) {
        sendJson(response, 404, { error: "binary_file_missing", sha256 });
        return;
      }

      response.statusCode = 200;
      response.setHeader("Content-Type", row.mime_type ?? "application/octet-stream");
      response.setHeader("Content-Length", String(row.actual_size_bytes));
      const extension = row.file_extension ? String(row.file_extension).replace(/^\./u, "") : "bin";
      response.setHeader("Content-Disposition", `inline; filename="${sha256}.${extension}"`);

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      fs.createReadStream(resolvedPath).pipe(response);
    } catch (error) {
      sendJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.listen(port, () => {
    console.log(`[gateway] listening on ${port}`);
  });
}

main().catch((error) => {
  console.error("[gateway] fatal error");
  console.error(error);
  process.exitCode = 1;
});
