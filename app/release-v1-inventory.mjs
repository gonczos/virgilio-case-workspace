import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createDbClient, getWorkspaceRoot, loadDotEnv } from "./processing-common.mjs";

const DEFAULT_PACKAGE_ID = "tribunais-portable-case-package-13608-14-8t2snt-2026-08-30T05-26-33-368Z";
const DEFAULT_OUTPUT = path.join("release", "consultation-v1", "baseline");
const DEFAULT_CONTRACTS = path.join("release", "consultation-v1", "contracts");
const INVENTORY_VERSION = "1.0.0";

export const DATABASE_ASSERTION_QUERIES = Object.freeze({
  table_counts: `
    SELECT table_name, row_count FROM (
      SELECT 'bucket' AS table_name, count(*)::bigint AS row_count FROM casework.bucket
      UNION ALL SELECT 'bucket_document', count(*)::bigint FROM casework.bucket_document
      UNION ALL SELECT 'case_file', count(*)::bigint FROM casework.case_file
      UNION ALL SELECT 'case_workspace', count(*)::bigint FROM casework.case_workspace
      UNION ALL SELECT 'document', count(*)::bigint FROM casework.document
      UNION ALL SELECT 'document_binary', count(*)::bigint FROM casework.document_binary
      UNION ALL SELECT 'document_representation', count(*)::bigint FROM casework.document_representation
      UNION ALL SELECT 'document_segment', count(*)::bigint FROM casework.document_segment
      UNION ALL SELECT 'file_binary', count(*)::bigint FROM casework.file_binary
      UNION ALL SELECT 'import_batch', count(*)::bigint FROM casework.import_batch
      UNION ALL SELECT 'import_execution', count(*)::bigint FROM casework.import_execution
      UNION ALL SELECT 'processing_job', count(*)::bigint FROM casework.processing_job
      UNION ALL SELECT 'reference_observation', count(*)::bigint FROM casework.reference_observation
      UNION ALL SELECT 'reference_observation_review', count(*)::bigint FROM casework.reference_observation_review
      UNION ALL SELECT 'source_capture', count(*)::bigint FROM casework.source_capture
      UNION ALL SELECT 'source_observation', count(*)::bigint FROM casework.source_observation
    ) AS counts ORDER BY table_name
  `,
  binary_state: `
    SELECT retention_status, coalesce(integrity_check_status, '<null>') AS integrity_check_status,
           count(*)::bigint AS row_count, sum(actual_size_bytes)::bigint AS total_bytes
    FROM casework.file_binary GROUP BY retention_status, integrity_check_status
    ORDER BY retention_status, integrity_check_status
  `,
  processing_state: `
    SELECT status, count(*)::bigint AS row_count
    FROM casework.processing_job GROUP BY status ORDER BY status
  `,
  representation_state: `
    SELECT representation_kind, processor_key, processor_version,
           count(*)::bigint AS row_count,
           count(DISTINCT file_binary_id)::bigint AS binary_count
    FROM casework.document_representation
    GROUP BY representation_kind, processor_key, processor_version
    ORDER BY representation_kind, processor_key, processor_version
  `,
  segment_state: `
    SELECT segment_kind, count(*)::bigint AS row_count,
           count(*) FILTER (WHERE text_content IS NOT NULL AND text_content <> '')::bigint AS nonempty_count,
           count(DISTINCT document_representation_id)::bigint AS representation_count
    FROM casework.document_segment GROUP BY segment_kind ORDER BY segment_kind
  `,
  reference_state: `
    SELECT observed_in_kind, observer_key, observer_version, review_state,
           count(*)::bigint AS row_count
    FROM casework.reference_observation
    GROUP BY observed_in_kind, observer_key, observer_version, review_state
    ORDER BY observed_in_kind, observer_key, observer_version, review_state
  `,
  import_batches: `
    SELECT package_id, package_kind, source_system, schema_version, producer,
           created_at_source, imported_at, case_count, document_count, file_binary_count
    FROM casework.import_batch ORDER BY package_id
  `,
  import_executions: `
    SELECT id, import_batch_id, execution_key, importer_key, importer_version,
           input_sha256, source_label, started_at, finished_at, status,
           reused_capture, counts_json
    FROM casework.import_execution ORDER BY id
  `,
});

const SCHEMA_FINGERPRINT_QUERIES = Object.freeze({
  relations: `
    SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind,
           coalesce(pg_get_viewdef(c.oid, true), '') AS view_definition
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'casework'
      AND c.relkind IN ('r','p','v','m','S')
    ORDER BY n.nspname, c.relname
  `,
  columns: `
    SELECT table_schema, table_name, ordinal_position, column_name, data_type,
           udt_schema, udt_name, is_nullable, column_default, is_identity,
           identity_generation, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_schema = 'casework'
    ORDER BY table_schema, table_name, ordinal_position
  `,
  constraints: `
    SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
           con.contype, pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'casework'
    ORDER BY n.nspname, c.relname, con.conname
  `,
  indexes: `
    SELECT schemaname AS schema_name, tablename AS table_name, indexname,
           indexdef AS definition
    FROM pg_indexes WHERE schemaname = 'casework'
    ORDER BY schemaname, tablename, indexname
  `,
});

function parseArgs(argv) {
  const values = { mode: "generate" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "generate" || arg === "verify") values.mode = arg;
    else if (arg === "--output") values.output = argv[++index];
    else if (arg === "--package") values.package = argv[++index];
    else if (arg === "--contracts") values.contracts = argv[++index];
    else if (arg === "--database-snapshot") values.databaseSnapshot = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return values;
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function jsonText(value) {
  return `${JSON.stringify(stableJson(value), null, 2)}\n`;
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fsSync.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function listFiles(rootPath, current = "") {
  const entries = await fs.readdir(path.join(rootPath, current), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const relativePath = current ? path.join(current, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(rootPath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function mapLimit(items, limit, mapper) {
  const result = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return result;
}

async function inventoryFiles(workspaceRoot, relativePaths) {
  const normalized = [...new Set(relativePaths.map((item) => item.replace(/\\/gu, "/")))].sort();
  return mapLimit(normalized, 12, async (relativePath) => {
    const absolutePath = path.resolve(workspaceRoot, relativePath);
    const relativeCheck = path.relative(workspaceRoot, absolutePath);
    if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
      throw new Error(`inventory path escapes workspace: ${relativePath}`);
    }
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) throw new Error(`inventory path is not a file: ${relativePath}`);
    return { path: relativePath, size_bytes: stat.size, sha256: await sha256File(absolutePath) };
  });
}

function normalizeDbValue(value) {
  if (Array.isArray(value)) return value.map(normalizeDbValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDbValue(item)]));
  }
  if (typeof value === "string" && /^-?[0-9]+$/u.test(value)) {
    const number = Number(value);
    if (Number.isSafeInteger(number)) return number;
  }
  return value;
}

async function databaseState(client) {
  const assertions = {};
  for (const [name, query] of Object.entries(DATABASE_ASSERTION_QUERIES)) {
    assertions[name] = normalizeDbValue((await client.query(query)).rows);
  }
  const catalog = {};
  for (const [name, query] of Object.entries(SCHEMA_FINGERPRINT_QUERIES)) {
    catalog[name] = normalizeDbValue((await client.query(query)).rows);
  }
  const catalogText = jsonText(catalog);
  return {
    assertions,
    query_definition_sha256: sha256Buffer(Buffer.from(jsonText(DATABASE_ASSERTION_QUERIES))),
    normalized_schema_sha256: sha256Buffer(Buffer.from(catalogText)),
  };
}

async function representationFiles(client, workspaceRoot) {
  const rows = (await client.query(`
    SELECT DISTINCT artifact_rel_path FROM casework.document_representation
    WHERE artifact_rel_path IS NOT NULL ORDER BY artifact_rel_path
  `)).rows;
  const files = [];
  for (const row of rows) {
    const relativeDirectory = String(row.artifact_rel_path).replace(/\\/gu, "/");
    const absoluteDirectory = path.resolve(workspaceRoot, relativeDirectory);
    const relativeCheck = path.relative(workspaceRoot, absoluteDirectory);
    if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
      throw new Error(`representation path escapes workspace: ${relativeDirectory}`);
    }
    for (const child of await listFiles(absoluteDirectory)) {
      files.push(path.posix.join(relativeDirectory, child.replace(/\\/gu, "/")));
    }
  }
  return files;
}

function currentGitCommit(workspaceRoot) {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot, encoding: "utf8" }).trim();
}

async function buildInventory(options) {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const outputRoot = path.resolve(workspaceRoot, options.output ?? DEFAULT_OUTPUT);
  const packageRoot = path.resolve(workspaceRoot, options.package
    ?? path.join("data", "imports", DEFAULT_PACKAGE_ID));
  const contractsRoot = path.resolve(workspaceRoot, options.contracts ?? DEFAULT_CONTRACTS);
  if (!options.databaseSnapshot) throw new Error("--database-snapshot is required");
  const snapshotPath = path.resolve(workspaceRoot, options.databaseSnapshot);
  const client = createDbClient("consultation-v1-inventory");
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const packageFiles = (await listFiles(packageRoot)).map((item) =>
      path.relative(workspaceRoot, path.join(packageRoot, item)).replace(/\\/gu, "/"));
    const contractFiles = (await listFiles(contractsRoot)).map((item) =>
      path.relative(workspaceRoot, path.join(contractsRoot, item)).replace(/\\/gu, "/"));
    const artifactFiles = await representationFiles(client, workspaceRoot);
    const [sourceInventory, artifactInventory, contractInventory, dbState] = await Promise.all([
      inventoryFiles(workspaceRoot, packageFiles),
      inventoryFiles(workspaceRoot, artifactFiles),
      inventoryFiles(workspaceRoot, contractFiles),
      databaseState(client),
    ]);
    await client.query("COMMIT");
    const schemaFiles = [
      ...(await listFiles(path.join(workspaceRoot, "db", "init")))
        .map((item) => path.posix.join("db/init", item.replace(/\\/gu, "/"))),
      ...(await listFiles(path.join(workspaceRoot, "db", "migrations")))
        .map((item) => path.posix.join("db/migrations", item.replace(/\\/gu, "/"))),
    ];
    const schemaInventory = await inventoryFiles(workspaceRoot, schemaFiles);
    const inventories = {
      source_package: sourceInventory,
      representation_artifacts: artifactInventory,
      contracts: contractInventory,
      schema_files: schemaInventory,
    };
    const inventoryFilesContent = Object.fromEntries(Object.entries(inventories).map(([name, value]) => [
      name,
      { file: `${name}.json`, sha256: sha256Buffer(Buffer.from(jsonText(value))), files: value.length,
        bytes: value.reduce((sum, item) => sum + item.size_bytes, 0) },
    ]));
    const manifest = {
      manifest_kind: "consultation_v1_release_input",
      manifest_version: INVENTORY_VERSION,
      application_contract_version: "v1",
      source_git_commit: currentGitCommit(workspaceRoot),
      generator: {
        path: "app/release-v1-inventory.mjs",
        sha256: await sha256File(fileURLToPath(import.meta.url)),
      },
      database: {
        input_snapshot: {
          path: path.relative(workspaceRoot, snapshotPath).replace(/\\/gu, "/"),
          size_bytes: (await fs.stat(snapshotPath)).size,
          sha256: await sha256File(snapshotPath),
        },
        ...dbState,
      },
      inventories: inventoryFilesContent,
    };
    return { outputRoot, inventories, manifest };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function writeGenerated({ outputRoot, inventories, manifest }) {
  await fs.mkdir(outputRoot, { recursive: true });
  for (const [name, value] of Object.entries(inventories)) {
    await fs.writeFile(path.join(outputRoot, `${name}.json`), jsonText(value), "utf8");
  }
  await fs.writeFile(path.join(outputRoot, "manifest.json"), jsonText(manifest), "utf8");
}

async function verifyGenerated(generated) {
  const expected = JSON.parse(await fs.readFile(path.join(generated.outputRoot, "manifest.json"), "utf8"));
  const comparable = { ...generated.manifest, source_git_commit: expected.source_git_commit };
  if (jsonText(expected) !== jsonText(comparable)) throw new Error("release input manifest differs");
  for (const [name, value] of Object.entries(generated.inventories)) {
    const expectedInventory = JSON.parse(await fs.readFile(path.join(generated.outputRoot, `${name}.json`), "utf8"));
    if (jsonText(expectedInventory) !== jsonText(value)) throw new Error(`${name} inventory differs`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const generated = await buildInventory(options);
  if (options.mode === "generate") await writeGenerated(generated);
  else await verifyGenerated(generated);
  console.log(JSON.stringify({
    mode: options.mode,
    manifest: path.join(generated.outputRoot, "manifest.json"),
    source_files: generated.inventories.source_package.length,
    representation_files: generated.inventories.representation_artifacts.length,
    contract_files: generated.inventories.contracts.length,
  }));
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[release-v1-inventory] ${error.message}`);
    process.exitCode = 1;
  });
}
